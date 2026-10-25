"""غلّاف رقيق لواجهات ويندوز. كل الدوال آمنة الاستدعاء على غير ويندوز."""
from __future__ import annotations

import ctypes
import logging
from ctypes import wintypes

from .constants import IS_WIN

log = logging.getLogger(__name__)

WM_HOTKEY = 0x0312
MOUSEEVENTF_WHEEL = 0x0800
WDA_EXCLUDEFROMCAPTURE = 0x00000011

MOD_ALT, MOD_CONTROL, MOD_SHIFT, MOD_WIN, MOD_NOREPEAT = 0x1, 0x2, 0x4, 0x8, 0x4000
VK_ESCAPE = 0x1B
INPUT_MOUSE = 0


class MOUSEINPUT(ctypes.Structure):
    _fields_ = [
        ("dx", wintypes.LONG),
        ("dy", wintypes.LONG),
        ("mouseData", wintypes.DWORD),
        ("dwFlags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ctypes.c_void_p),
    ]


class _INPUTUNION(ctypes.Union):
    _fields_ = [("mi", MOUSEINPUT), ("pad", ctypes.c_byte * 32)]


class INPUT(ctypes.Structure):
    _fields_ = [("type", ctypes.c_ulong), ("u", _INPUTUNION)]


user32 = ctypes.WinDLL("user32", use_last_error=True) if IS_WIN else None

if IS_WIN:
    user32.SendInput.argtypes = [wintypes.UINT, ctypes.POINTER(INPUT), ctypes.c_int]
    user32.SendInput.restype = wintypes.UINT
    user32.SetCursorPos.argtypes = [ctypes.c_int, ctypes.c_int]
    user32.SetCursorPos.restype = wintypes.BOOL
    user32.GetCursorPos.argtypes = [ctypes.POINTER(wintypes.POINT)]
    user32.SetWindowDisplayAffinity.argtypes = [wintypes.HWND, wintypes.DWORD]
    user32.RegisterHotKey.argtypes = [wintypes.HWND, ctypes.c_int, wintypes.UINT, wintypes.UINT]
    user32.UnregisterHotKey.argtypes = [wintypes.HWND, ctypes.c_int]
    user32.GetAsyncKeyState.argtypes = [ctypes.c_int]
    user32.GetAsyncKeyState.restype = ctypes.c_short


def send_wheel(notches: int) -> bool:
    """notches سالب = تمرير للأسفل. يستخدم SendInput (لا mouse_event المهجورة)."""
    if not IS_WIN or not notches:
        return False
    inp = INPUT(type=INPUT_MOUSE)
    inp.u.mi = MOUSEINPUT(0, 0, (int(notches) * 120) & 0xFFFFFFFF, MOUSEEVENTF_WHEEL, 0, None)
    sent = user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))
    if sent != 1:
        log.debug("SendInput failed: %s", ctypes.get_last_error())
    return sent == 1


def cursor_pos() -> tuple[int, int]:
    if not IS_WIN:
        return (0, 0)
    point = wintypes.POINT()
    user32.GetCursorPos(ctypes.byref(point))
    return (point.x, point.y)


def set_cursor(x: int, y: int) -> None:
    if IS_WIN:
        user32.SetCursorPos(int(x), int(y))


def esc_pressed() -> bool:
    return bool(IS_WIN and (user32.GetAsyncKeyState(VK_ESCAPE) & 0x8000))


def exclude_from_capture(win_id: int) -> None:
    """يخفي نافذة من الالتقاط (ويندوز 10 2004+). فشله لا يعطّل شيئًا."""
    if not IS_WIN:
        return
    try:
        if not user32.SetWindowDisplayAffinity(wintypes.HWND(int(win_id)), WDA_EXCLUDEFROMCAPTURE):
            log.debug("SetWindowDisplayAffinity failed: %s", ctypes.get_last_error())
    except Exception:  # noqa: BLE001 - مجرد تحسين بصري
        log.debug("SetWindowDisplayAffinity unavailable", exc_info=True)


_KEYS = {
    "ctrl": MOD_CONTROL, "control": MOD_CONTROL,
    "shift": MOD_SHIFT, "alt": MOD_ALT, "win": MOD_WIN, "meta": MOD_WIN,
}


def parse_hotkey(sequence: str) -> tuple[int, int]:
    mods, vk = 0, 0
    for part in sequence.replace(" ", "").split("+"):
        token = part.lower()
        if token in _KEYS:
            mods |= _KEYS[token]
        elif len(token) == 1 and token.isalnum():
            vk = ord(token.upper())
        elif token.startswith("f") and token[1:].isdigit():
            vk = 0x70 + int(token[1:]) - 1
    return mods, vk


def register_hotkey(hwnd: int, hotkey_id: int, sequence: str) -> bool:
    if not IS_WIN:
        return False
    mods, vk = parse_hotkey(sequence)
    if not vk:
        log.warning("نص اختصار غير صالح: %s", sequence)
        return False
    ok = user32.RegisterHotKey(wintypes.HWND(int(hwnd)), hotkey_id, mods | MOD_NOREPEAT, vk)
    if not ok:
        log.warning("RegisterHotKey(%s) failed: %s", sequence, ctypes.get_last_error())
    return bool(ok)


def unregister_hotkey(hwnd: int, hotkey_id: int) -> None:
    if IS_WIN and hwnd:
        user32.UnregisterHotKey(wintypes.HWND(int(hwnd)), hotkey_id)
