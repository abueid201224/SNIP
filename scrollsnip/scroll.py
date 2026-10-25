"""عامل التمرير: كشف الإزاحة، لصق الجزء الجديد فقط، توقّف تلقائي عند النهاية."""
from __future__ import annotations

import logging
import threading
import time

import mss
from PySide6.QtCore import QObject, Signal, Slot

from . import winapi
from .constants import FRAME_INTERVAL_MS, MATCH_THRESHOLD, MAX_IMAGE_BYTES, MIN_SCROLL_PX
from .geometry import PhysicalRect
from .imaging import ScrollBuffer, detect_shift

log = logging.getLogger(__name__)


class ScrollWorker(QObject):
    progress = Signal(int, int)       # إطارات، الارتفاع
    notice = Signal(str)              # مفتاح نص
    finished = Signal(object)         # ndarray RGB
    failed = Signal(str)

    def __init__(self, rect: PhysicalRect, mode: str = "auto",
                 max_bytes: int = MAX_IMAGE_BYTES, interval_ms: int = FRAME_INTERVAL_MS) -> None:
        super().__init__()
        self._rect = rect
        self._mode = mode
        self._max_bytes = max_bytes
        self._interval = max(0.05, interval_ms / 1000.0)
        self._stop = threading.Event()

    @Slot()
    def request_stop(self) -> None:
        self._stop.set()

    @Slot()
    def run(self) -> None:
        try:
            self._run()
        except Exception as exc:  # noqa: BLE001 - يُبلَّغ للواجهة
            log.exception("فشل التمرير")
            self.failed.emit(str(exc))

    def _run(self) -> None:
        monitor = self._rect.as_mss()
        saved_cursor = winapi.cursor_pos()
        # mss غير آمن بين الخيوط: كائن جديد داخل الخيط
        with mss.mss() as sct:
            first = self._grab(sct, monitor)
            height, width = first.shape[:2]
            buffer = ScrollBuffer(width, height, self._max_bytes)
            buffer.start(first)

            prev_gray = self._gray(first)
            frames = 1
            idle = 0
            notches = 1
            truncated = False
            self.progress.emit(frames, buffer.height)

            center = (monitor["left"] + monitor["width"] // 2, monitor["top"] + monitor["height"] // 2)
            use_uia = self._mode == "auto" and self._uia_available()
            try:
                if self._mode == "auto":
                    winapi.set_cursor(*center)

                while not self._stop.is_set():
                    started = time.perf_counter()

                    if self._mode == "auto":
                        if not self._auto_scroll(center, notches, use_uia):
                            break
                    else:
                        time.sleep(self._interval)

                    if self._stop.is_set():
                        break

                    frame = self._grab(sct, monitor)
                    if frame is None:
                        continue
                    current_gray = self._gray(frame)
                    shift, score = detect_shift(prev_gray, current_gray)
                    prev_gray = current_gray

                    if shift < MIN_SCROLL_PX or score < MATCH_THRESHOLD:
                        idle += 1
                        if self._mode == "auto" and idle >= 2:  # بلغنا نهاية المحتوى
                            break
                        continue

                    idle = 0
                    if self._mode == "auto":
                        # معايرة تلقائية: نطلب ~55% من ارتفاع المنطقة لكل خطوة
                        notches = max(1, min(6, round(height * 0.55 / max(shift, 1))))

                    added = buffer.append(frame, shift)
                    if added <= 0:
                        truncated = True
                        break
                    frames += 1
                    self.progress.emit(frames, buffer.height)
                    if buffer.full:
                        truncated = True
                        break

                    if self._mode == "manual":
                        remaining = self._interval - (time.perf_counter() - started)
                        if remaining > 0:
                            time.sleep(remaining)
            finally:
                if self._mode == "auto":
                    winapi.set_cursor(*saved_cursor)

            if frames <= 1:
                self.notice.emit("no_scroll")
                self.finished.emit(None)
                return
            if truncated:
                self.notice.emit("limit")
            self.finished.emit(buffer.to_rgb())

    @staticmethod
    def _grab(sct, monitor):
        try:
            return __import__("numpy").array(sct.grab(monitor))
        except Exception:  # noqa: BLE001
            log.debug("grab failed", exc_info=True)
            return None

    @staticmethod
    def _gray(frame):
        import cv2

        return cv2.cvtColor(frame, cv2.COLOR_BGRA2GRAY)

    @staticmethod
    def _uia_available() -> bool:
        from . import uia

        return uia.available()

    def _auto_scroll(self, center: tuple[int, int], notches: int, use_uia: bool) -> bool:
        if use_uia:
            from . import uia

            if uia.scroll_down(*center):
                return True
        return winapi.send_wheel(-notches)
