"""التشغيل: DPI، تسجيل، قفل النسخة، شريط المهام، الاختصارات."""
from __future__ import annotations

import ctypes
import logging
import sys
from ctypes import wintypes
from logging.handlers import RotatingFileHandler

from PySide6.QtCore import QAbstractNativeEventFilter, QLockFile, QObject, QSettings, QTimer, Qt
from PySide6.QtGui import QColor, QIcon, QPainter, QPixmap
from PySide6.QtWidgets import QApplication, QMenu, QMessageBox, QSystemTrayIcon

from .constants import APP_NAME, DEFAULT_HOTKEYS, LOCK_PATH, LOG_PATH, ORG_NAME, IS_WIN
from .mainwindow import HomeWindow
from .theme import apply_theme
from . import winapi
from .i18n import translator

log = logging.getLogger(__name__)

HOTKEY_BASE_ID = 0xC0DE


def setup_logging() -> None:
    handler = RotatingFileHandler(LOG_PATH, maxBytes=1_000_000, backupCount=3, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)-7s %(name)s: %(message)s"))
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.addHandler(handler)
    if sys.stderr:
        root.addHandler(logging.StreamHandler())


def enable_per_monitor_dpi() -> None:
    """يجب أن يسبق إنشاء QApplication."""
    if not IS_WIN:
        return
    try:
        ctypes.windll.user32.SetProcessDpiAwarenessContext(ctypes.c_void_p(-4))  # PerMonitorV2
    except Exception:  # noqa: BLE001
        try:
            ctypes.windll.shcore.SetProcessDpiAwareness(2)
        except Exception:  # noqa: BLE001
            log.info("DPI awareness غير متاح على هذا الإصدار")


class HotkeyManager(QObject, QAbstractNativeEventFilter):
    def __init__(self, window: HomeWindow, mapping: dict[str, str]) -> None:
        super().__init__()
        self._window = window
        self._mapping = mapping
        self._by_id = {HOTKEY_BASE_ID + index: kind for index, kind in enumerate(mapping)}
        self._hwnd = 0
        QApplication.instance().installNativeEventFilter(self)

    def register(self) -> list[str]:
        hwnd = int(self._window.winId())
        if hwnd == self._hwnd:
            return []
        self.unregister()
        self._hwnd = hwnd
        failed = []
        for index, (kind, sequence) in enumerate(self._mapping.items()):
            if not winapi.register_hotkey(hwnd, HOTKEY_BASE_ID + index, sequence):
                failed.append(sequence)
        return failed

    def unregister(self) -> None:
        for hotkey_id in self._by_id:
            winapi.unregister_hotkey(self._hwnd, hotkey_id)

    def nativeEventFilter(self, event_type, message):
        if event_type in (b"windows_generic_MSG", b"windows_dispatcher_MSG"):
            try:
                msg = wintypes.MSG.from_address(int(message))
            except Exception:  # noqa: BLE001
                return False, 0
            if msg.message == winapi.WM_HOTKEY:
                kind = self._by_id.get(int(msg.wParam))
                if kind:
                    QTimer.singleShot(0, lambda: self._window.trigger(kind))
                    return True, 0
        return False, 0


def build_icon() -> QIcon:
    pixmap = QPixmap(64, 64)
    pixmap.fill(Qt.transparent)
    painter = QPainter(pixmap)
    painter.setRenderHint(QPainter.Antialiasing)
    painter.setBrush(QColor("#4f8cff"))
    painter.setPen(Qt.NoPen)
    painter.drawRoundedRect(4, 4, 56, 56, 14, 14)
    painter.setPen(QColor("#111318"))
    painter.setBrush(Qt.NoBrush)
    painter.drawRect(18, 18, 28, 28)
    painter.end()
    return QIcon(pixmap)


def create_tray(app: QApplication, window: HomeWindow) -> QSystemTrayIcon:
    tr = translator()
    tray = QSystemTrayIcon(build_icon(), app)
    menu = QMenu()
    show_action = menu.addAction(tr.t("show"))
    show_action.triggered.connect(lambda: (window.showNormal(), window.raise_(), window.activateWindow()))
    menu.addSeparator()
    quit_action = menu.addAction(tr.t("quit"))
    quit_action.triggered.connect(window.quit)
    tray.setContextMenu(menu)
    tray.setToolTip(APP_NAME)
    tray.activated.connect(
        lambda reason: window.showNormal() if reason == QSystemTrayIcon.Trigger else None)
    tr.changed.connect(lambda: (
        show_action.setText(tr.t("show")),
        quit_action.setText(tr.t("quit")),
        tray.setToolTip(APP_NAME),
    ))
    tray.show()
    app._tray = tray  # يمنع جمع القمامة
    return tray


def main() -> int:
    enable_per_monitor_dpi()
    setup_logging()

    app = QApplication(sys.argv)
    app.setOrganizationName(ORG_NAME)
    app.setApplicationName(APP_NAME)
    app.setQuitOnLastWindowClosed(False)  # لا نخرج فور النسخ

    settings = QSettings()
    tr = translator()
    tr.set_language(str(settings.value("language", "ar")))
    apply_theme(app, tr.is_rtl)

    lock = QLockFile(LOCK_PATH)
    lock.setStaleLockTime(0)
    if not lock.tryLock(100):
        QMessageBox.information(None, APP_NAME, tr.t("already_running"))
        return 1
    app._instance_lock = lock  # مرجع دائم، وإلا تحرّر القفل فورًا

    window = HomeWindow(settings)
    window.setWindowIcon(build_icon())
    window.show()

    tray_ok = QSystemTrayIcon.isSystemTrayAvailable()
    if tray_ok:
        create_tray(app, window)
    window.set_tray_available(tray_ok)

    manager = HotkeyManager(window, DEFAULT_HOTKEYS)
    for sequence in manager.register():
        window.statusBar().showMessage(tr.t("hotkey_fail", k=sequence), 8000)
    app.aboutToQuit.connect(manager.unregister)

    def excepthook(exc_type, exc_value, exc_tb):
        log.exception("استثناء غير معالَج", exc_info=(exc_type, exc_value, exc_tb))
        QMessageBox.critical(None, APP_NAME, tr.t("err", e=exc_value))

    sys.excepthook = excepthook
    return app.exec()
