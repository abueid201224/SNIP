from __future__ import annotations

import os
import sys
from pathlib import Path

IS_WIN = sys.platform == "win32"
APP_NAME = "ScrollSnip"
ORG_NAME = "ScrollSnip"

APP_DIR = Path(os.environ.get("LOCALAPPDATA") or Path.home()) / APP_NAME
APP_DIR.mkdir(parents=True, exist_ok=True)
LOG_PATH = APP_DIR / "scrollsnip.log"
LOCK_PATH = str(APP_DIR / "instance.lock")

# سقف الذاكرة بدل سقف البكسل: 24000px على شاشة 4K تعني ~350MB
MAX_IMAGE_BYTES = 256 * 1024 * 1024

FRAME_INTERVAL_MS = 120
MIN_SCROLL_PX = 3
MATCH_THRESHOLD = 0.90

DEFAULT_HOTKEYS = {
    "region": "Ctrl+Shift+S",
    "scroll": "Ctrl+Shift+W",
    "full": "Ctrl+Shift+F",
}

DEFAULT_SETTINGS = {
    "language": "ar",
    "delay": 0,
    "scroll_mode": "auto",
    "copy_auto": True,
    "save_auto": False,
    "save_dir": str(Path.home() / "Pictures" / APP_NAME),
}
