"""معالجة صور خالصة (بدون Qt) — قابلة للاختبار مباشرة."""
from __future__ import annotations

import cv2
import numpy as np


def detect_shift(prev_gray: np.ndarray, cur_gray: np.ndarray, target_width: int = 480) -> tuple[int, float]:
    """يرجع (d, score) حيث cur[y] ≈ prev[y + d] بالبكسل الأصلي.

    يعمل على صورة مصغّرة لأن matchTemplate على ارتفاع كامل مكلف جدًا.
    """
    if prev_gray is None or cur_gray is None:
        return 0, 0.0
    h, w = cur_gray.shape[:2]
    if h < 20 or w < 20:
        return 0, 0.0

    scale = min(1.0, target_width / float(w))
    if scale < 1.0:
        size = (max(8, int(w * scale)), max(8, int(h * scale)))
        cur = cv2.resize(cur_gray, size, interpolation=cv2.INTER_AREA)
        prev = cv2.resize(prev_gray, (size[0], prev_gray.shape[0] and max(8, int(prev_gray.shape[0] * scale))),
                          interpolation=cv2.INTER_AREA)
        if prev.shape[1] != cur.shape[1]:
            return 0, 0.0
    else:
        cur, prev = cur_gray, prev_gray

    hs = cur.shape[0]
    top, bottom = int(hs * 0.12), int(hs * 0.58)
    if bottom - top < 10 or prev.shape[0] <= bottom - top:
        return 0, 0.0

    template = cur[top:bottom]
    result = cv2.matchTemplate(prev, template, cv2.TM_CCOEFF_NORMED)
    _, score, _, location = cv2.minMaxLoc(result)
    return int(round((location[1] - top) / scale)), float(score)


class ScrollBuffer:
    """مخزن رأسي مخصّص مسبقًا: ذاكرة محدودة بلا إعادة تخصيص تربيعية."""

    def __init__(self, width: int, height: int, max_bytes: int) -> None:
        self.width = int(width)
        self.max_rows = max(int(height), int(max_bytes // max(1, width * 4)))
        self._buffer = np.empty((self.max_rows, self.width, 4), np.uint8)  # BGRA
        self._written = 0

    @property
    def height(self) -> int:
        return min(self._written, self.max_rows)

    @property
    def full(self) -> bool:
        return self._written >= self.max_rows

    def start(self, frame: np.ndarray) -> None:
        rows = min(frame.shape[0], self.max_rows)
        self._buffer[:rows] = frame[:rows]
        self._written = rows

    def append(self, frame: np.ndarray, rows: int) -> int:
        take = min(int(rows), self.max_rows - self._written, frame.shape[0])
        if take <= 0:
            return 0
        self._buffer[self._written:self._written + take] = frame[frame.shape[0] - take:]
        self._written += take
        return take

    def to_rgb(self) -> np.ndarray:
        view = self._buffer[:self.height]
        return np.ascontiguousarray(view[:, :, :3][:, :, ::-1])
