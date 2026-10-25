"""تحويل الإحداثيات منطقي (Qt/DIP) ↔ بكسل فعلي (mss)."""
from __future__ import annotations

import logging
from dataclasses import dataclass

import mss
from PySide6.QtCore import QRect
from PySide6.QtGui import QGuiApplication

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class PhysicalRect:
    left: int
    top: int
    width: int
    height: int

    def as_mss(self) -> dict:
        return {"left": self.left, "top": self.top, "width": self.width, "height": self.height}


def monitors() -> list[dict]:
    with mss.mss() as sct:
        return list(sct.monitors[1:])


def _match_monitor(screen, dpr: float) -> dict:
    geo = screen.geometry()
    found = monitors()
    want_w, want_h = geo.width() * dpr, geo.height() * dpr
    for mon in found:
        if abs(mon["width"] - want_w) <= 2 and abs(mon["height"] - want_h) <= 2:
            return mon
    log.warning("لم أطابق شاشة Qt بمراقب mss (dpr=%s) — سأستخدم الأقرب", dpr)
    return min(found, key=lambda m: abs(m["width"] - want_w) + abs(m["height"] - want_h))


def physical_rect(rect: QRect) -> PhysicalRect:
    """منطقة منطقية عالمية → بكسل فعلي، مع مراعاة الـ DPI وأصل الشاشة (قد يكون سالبًا)."""
    screen = QGuiApplication.screenAt(rect.center()) or QGuiApplication.primaryScreen()
    dpr = float(screen.devicePixelRatio() or 1.0)
    geo = screen.geometry()
    mon = _match_monitor(screen, dpr)

    left = mon["left"] + round((rect.x() - geo.x()) * dpr)
    top = mon["top"] + round((rect.y() - geo.y()) * dpr)
    width = round(rect.width() * dpr)
    height = round(rect.height() * dpr)

    right = mon["left"] + mon["width"]
    bottom = mon["top"] + mon["height"]
    left = max(mon["left"], min(left, right - 1))
    top = max(mon["top"], min(top, bottom - 1))
    width = max(1, min(width, right - left))
    height = max(1, min(height, bottom - top))
    return PhysicalRect(left, top, width, height)


def screen_physical(screen) -> PhysicalRect:
    dpr = float(screen.devicePixelRatio() or 1.0)
    mon = _match_monitor(screen, dpr)
    return PhysicalRect(mon["left"], mon["top"], mon["width"], mon["height"])
