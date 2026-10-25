"""mss + تحويل إلى QImage (BGR→RGB، والنسخ لفصل الذاكرة)."""
from __future__ import annotations

import cv2
import mss
import numpy as np
from PySide6.QtGui import QImage

from .geometry import PhysicalRect


def grab(rect: PhysicalRect) -> np.ndarray:
    """إطار BGRA للمنطقة المحددة فقط (لا الشاشة كاملة)."""
    with mss.mss() as sct:
        shot = sct.grab(rect.as_mss())
        return np.array(shot)  # نسخة مستقلة من ذاكرة mss


def bgra_to_rgb(frame: np.ndarray) -> np.ndarray:
    return np.ascontiguousarray(frame[:, :, :3][:, :, ::-1])


def gray(frame: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(frame, cv2.COLOR_BGRA2GRAY)


def rgb_to_qimage(rgb: np.ndarray) -> QImage:
    rgb = np.ascontiguousarray(rgb)
    height, width = rgb.shape[:2]
    image = QImage(rgb.data, width, height, rgb.strides[0], QImage.Format_RGB888)
    return image.copy()  # .copy() يقطع الاعتماد على مخزن numpy


def to_qimage(frame_bgra: np.ndarray) -> QImage:
    return rgb_to_qimage(bgra_to_rgb(frame_bgra))
