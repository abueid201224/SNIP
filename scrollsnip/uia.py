"""تمرير عبر UI Automation (ScrollPattern) — اختياري بالكامل.

الأفضل من حقن العجلة: لا يحرّك مؤشر المستخدم ولا يعاركه. أي فشل يعيد False
فيسقط العامل إلى SendInput. يتطلب comtypes.
"""
from __future__ import annotations

import logging

log = logging.getLogger(__name__)

_UIA_SCROLL_PATTERN_ID = 10004
_SCROLL_AMOUNT_NO_AMOUNT = 0
_SCROLL_AMOUNT_LARGE_INCREMENT = 2

_state: dict[str, object] = {"checked": False, "automation": None}


def _automation():
    if _state["checked"]:
        return _state["automation"]
    _state["checked"] = True
    try:
        import comtypes.client
        from comtypes.gen import UIAutomationClient as UIA  # noqa: F401

        _state["automation"] = comtypes.client.CreateObject(
            "{ff48dba4-60ef-4201-aa87-54103eef594e}", interface=UIA.IUIAutomation
        )
    except Exception as exc:  # noqa: BLE001
        log.info("UI Automation غير متاح: %s", exc)
        _state["automation"] = None
    return _state["automation"]


def available() -> bool:
    return _automation() is not None


def scroll_down(x: int, y: int) -> bool:
    automation = _automation()
    if automation is None:
        return False
    try:
        from ctypes import wintypes

        from comtypes.gen import UIAutomationClient as UIA

        element = automation.ElementFromPoint(wintypes.POINT(int(x), int(y)))
        if element is None:
            return False
        pattern = element.GetCurrentPattern(_UIA_SCROLL_PATTERN_ID)
        scroll = pattern.QueryInterface(UIA.IUIAutomationScrollPattern)
        if not scroll.CurrentVerticallyScrollable:
            return False
        scroll.Scroll(_SCROLL_AMOUNT_NO_AMOUNT, _SCROLL_AMOUNT_LARGE_INCREMENT)
        return True
    except Exception:  # noqa: BLE001 - أي عنصر لا يدعم النمط
        log.debug("UIA scroll failed", exc_info=True)
        return False
