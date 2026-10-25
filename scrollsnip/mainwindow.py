"""الواجهة الرئيسية: البطاقات، الخيارات، وشريط الحالة."""
from __future__ import annotations

import logging

from PySide6.QtCore import QSettings, QThread, QTimer, Qt, Signal
from PySide6.QtGui import QCursor, QGuiApplication
from PySide6.QtWidgets import (QApplication, QCheckBox, QComboBox, QFrame, QGridLayout,
                               QHBoxLayout, QLabel, QLineEdit, QMainWindow, QPushButton,
                               QVBoxLayout, QWidget)

from . import capture, winapi
from .constants import DEFAULT_SETTINGS, FRAME_INTERVAL_MS
from .editor import EditorWindow
from .geometry import physical_rect, screen_physical
from .i18n import translator
from .overlay import Countdown, RegionOverlay, ScrollHud
from .scroll import ScrollWorker

log = logging.getLogger(__name__)


class Card(QPushButton):
    def __init__(self, kind: str, glyph: str) -> None:
        super().__init__()
        self.setObjectName("card")
        self.setProperty("kind", kind)
        self.setCursor(Qt.PointingHandCursor)
        self.setMinimumHeight(140)
        self.glyph = QLabel(glyph)
        self.glyph.setObjectName("cardGlyph")
        self.title = QLabel()
        self.title.setObjectName("cardTitle")
        self.sub = QLabel()
        self.sub.setObjectName("muted")
        self.sub.setWordWrap(True)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(18, 16, 18, 16)
        layout.setSpacing(6)
        layout.addWidget(self.glyph)
        layout.addWidget(self.title)
        layout.addWidget(self.sub)
        layout.addStretch(1)

    def apply_direction(self, rtl: bool) -> None:
        align = Qt.AlignRight if rtl else Qt.AlignLeft
        for label in (self.glyph, self.title, self.sub):
            label.setAlignment(align)


class HomeWindow(QMainWindow):
    def __init__(self, settings: QSettings) -> None:
        super().__init__()
        self._tr = translator()
        self._settings = settings
        self._busy = False
        self._thread: QThread | None = None
        self._worker: ScrollWorker | None = None
        self._hud: ScrollHud | None = None
        self._editor: EditorWindow | None = None
        self._quitting = False
        self._tray = False
        self._build()
        self.retranslate()
        self._tr.changed.connect(self._on_language_changed)

    # ---------- بناء ----------
    def _build(self) -> None:
        root = QWidget()
        root.setObjectName("root")
        self.setCentralWidget(root)
        self.setMinimumWidth(760)
        self.resize(880, 620)

        outer = QVBoxLayout(root)
        outer.setContentsMargins(26, 22, 26, 18)
        outer.setSpacing(16)

        header = QHBoxLayout()
        self._title = QLabel("ScrollSnip")
        self._title.setObjectName("title")
        self._tagline = QLabel()
        self._tagline.setObjectName("muted")
        title_box = QVBoxLayout()
        title_box.setSpacing(2)
        title_box.addWidget(self._title)
        title_box.addWidget(self._tagline)
        header.addLayout(title_box, 1)
        self._lang_label = QLabel()
        self._lang_label.setObjectName("muted")
        self.lang_combo = QComboBox()
        self.lang_combo.addItem("العربية", "ar")
        self.lang_combo.addItem("English", "en")
        self.lang_combo.currentIndexChanged.connect(self._on_lang_picked)
        header.addWidget(self._lang_label)
        header.addWidget(self.lang_combo)
        outer.addLayout(header)

        cards = QHBoxLayout()
        cards.setSpacing(12)
        self.cards: dict[str, Card] = {
            "region": Card("region", "▣"),
            "scroll": Card("scroll", "↧"),
            "full": Card("full", "▤"),
        }
        for kind, card in self.cards.items():
            card.clicked.connect(lambda _=False, k=kind: self.trigger(k))
            cards.addWidget(card, 1)
        outer.addLayout(cards)

        panel = QFrame()
        panel.setObjectName("panel")
        grid = QGridLayout(panel)
        grid.setContentsMargins(18, 16, 18, 16)
        grid.setHorizontalSpacing(14)
        grid.setVerticalSpacing(12)

        self._delay_label = QLabel()
        self.delay_combo = QComboBox()
        for seconds in (0, 1, 2, 3, 5, 10):
            self.delay_combo.addItem("", seconds)
        self.delay_combo.setCurrentIndex(0)

        self._mode_label = QLabel()
        self.mode_combo = QComboBox()
        self.mode_combo.addItem("", "auto")
        self.mode_combo.addItem("", "manual")

        self.copy_auto = QCheckBox()
        self.save_auto = QCheckBox()

        grid.addWidget(self._delay_label, 0, 0)
        grid.addWidget(self.delay_combo, 0, 1)
        grid.addWidget(self._mode_label, 0, 2)
        grid.addWidget(self.mode_combo, 0, 3)
        grid.addWidget(self.copy_auto, 1, 0, 1, 2)
        grid.addWidget(self.save_auto, 1, 2, 1, 2)

        self._folder_label = QLabel()
        self.folder_edit = QLineEdit()
        self.folder_edit.setReadOnly(True)
        self._change_btn = QPushButton()
        self._open_btn = QPushButton()
        self._change_btn.clicked.connect(self._pick_folder)
        self._open_btn.clicked.connect(self._open_folder)
        folder_row = QHBoxLayout()
        folder_row.setSpacing(8)
        folder_row.addWidget(self.folder_edit, 1)
        folder_row.addWidget(self._change_btn)
        folder_row.addWidget(self._open_btn)
        grid.addWidget(self._folder_label, 2, 0)
        grid.addLayout(folder_row, 2, 1, 1, 3)
        grid.setColumnStretch(1, 1)
        grid.setColumnStretch(3, 1)
        outer.addWidget(panel)

        self._hotkeys = QLabel()
        self._hotkeys.setObjectName("muted")
        self._hotkeys.setAlignment(Qt.AlignCenter)
        outer.addWidget(self._hotkeys)
        outer.addStretch(1)

        self.statusBar().showMessage("")
        self._load_settings()

    def _load_settings(self) -> None:
        s = self._settings
        self.lang_combo.setCurrentIndex(0 if self._tr.language == "ar" else 1)
        index = self.delay_combo.findData(int(s.value("delay", DEFAULT_SETTINGS["delay"])))
        self.delay_combo.setCurrentIndex(max(0, index))
        index = self.mode_combo.findData(s.value("scroll_mode", DEFAULT_SETTINGS["scroll_mode"]))
        self.mode_combo.setCurrentIndex(max(0, index))
        self.copy_auto.setChecked(s.value("copy_auto", DEFAULT_SETTINGS["copy_auto"], bool))
        self.save_auto.setChecked(s.value("save_auto", DEFAULT_SETTINGS["save_auto"], bool))
        self.folder_edit.setText(s.value("save_dir", DEFAULT_SETTINGS["save_dir"]))
        self.delay_combo.currentIndexChanged.connect(self._persist)
        self.mode_combo.currentIndexChanged.connect(self._persist)
        self.copy_auto.toggled.connect(self._persist)
        self.save_auto.toggled.connect(self._persist)

    def _persist(self, *_args) -> None:
        s = self._settings
        s.setValue("delay", self.delay_combo.currentData())
        s.setValue("scroll_mode", self.mode_combo.currentData())
        s.setValue("copy_auto", self.copy_auto.isChecked())
        s.setValue("save_auto", self.save_auto.isChecked())
        s.setValue("save_dir", self.folder_edit.text())

    # ---------- ترجمة ----------
    def retranslate(self) -> None:
        tr = self._tr
        self._tagline.setText(tr.t("tagline"))
        self._lang_label.setText(tr.t("language"))
        for kind, card in self.cards.items():
            card.title.setText(tr.t(kind))
            card.sub.setText(tr.t(f"{kind}_sub"))
            card.apply_direction(tr.is_rtl)
        self._delay_label.setText(tr.t("delay"))
        for index in range(self.delay_combo.count()):
            seconds = self.delay_combo.itemData(index)
            self.delay_combo.setItemText(
                index, tr.t("no_delay") if not seconds else tr.t("seconds", n=seconds))
        self._mode_label.setText(tr.t("mode"))
        self.mode_combo.setItemText(0, tr.t("auto"))
        self.mode_combo.setItemText(1, tr.t("manual"))
        self.copy_auto.setText(tr.t("copy_auto"))
        self.save_auto.setText(tr.t("save_auto"))
        self._folder_label.setText(tr.t("folder"))
        self._change_btn.setText(tr.t("change"))
        self._open_btn.setText(tr.t("open"))
        self._hotkeys.setText(tr.t("hotkeys"))

    def _on_lang_picked(self, index: int) -> None:
        code = self.lang_combo.itemData(index)
        self._settings.setValue("language", code)
        self._tr.set_language(code)

    def _on_language_changed(self) -> None:
        from PySide6.QtCore import Qt as QtCore_Qt

        QApplication.instance().setLayoutDirection(
            QtCore_Qt.RightToLeft if self._tr.is_rtl else QtCore_Qt.LeftToRight)
        self.retranslate()
        if self._editor is not None:
            self._editor.retranslate()

    # ---------- مجلد ----------
    def _pick_folder(self) -> None:
        from PySide6.QtWidgets import QFileDialog

        path = QFileDialog.getExistingDirectory(self, self._tr.t("folder"), self.folder_edit.text())
        if path:
            self.folder_edit.setText(path)
            self._persist()

    def _open_folder(self) -> None:
        import os

        path = self.folder_edit.text()
        os.makedirs(path, exist_ok=True)
        from PySide6.QtGui import QDesktopServices
        from PySide6.QtCore import QUrl

        QDesktopServices.openUrl(QUrl.fromLocalFile(path))

    # ---------- التدفق ----------
    def trigger(self, kind: str) -> None:
        if self._busy:
            return
        self._busy = True
        self._kind = kind
        delay = int(self.delay_combo.currentData() or 0)
        self.hide()
        if delay:
            countdown = Countdown(delay)
            countdown.done.connect(self._begin)
            countdown.show()
        else:
            QTimer.singleShot(120, self._begin)

    def _begin(self) -> None:
        if self._kind == "full":
            screen = QGuiApplication.screenAt(QCursor.pos()) or QGuiApplication.primaryScreen()
            self._grab_region(screen_physical(screen), "region")
            return
        hint = self._tr.t("hint_scroll" if self._kind == "scroll" else "hint_region")
        overlay = RegionOverlay(hint)
        overlay.selected.connect(lambda rect: self._grab_region(physical_rect(rect), self._kind))
        overlay.cancelled.connect(self._reset)
        overlay.show()

    def _grab_region(self, rect, kind: str) -> None:
        QTimer.singleShot(160, lambda: self._do_grab(rect, kind))

    def _do_grab(self, rect, kind: str) -> None:
        if kind == "scroll":
            self._start_scroll(rect)
            return
        try:
            self._open_editor(capture.to_qimage(capture.grab(rect)))
        except Exception as exc:  # noqa: BLE001
            log.exception("فشل الالتقاط")
            self._reset(self._tr.t("err", e=exc))

    def _open_editor(self, image) -> None:
        self._busy = False
        self.show()
        self.raise_()
        self.activateWindow()
        if image is None or image.isNull():
            return
        if self._editor is not None:
            self._editor.close()
        self._editor = EditorWindow(image)
        self._editor.notice.connect(lambda msg: self.statusBar().showMessage(msg, 5000))
        self._editor.show()
        if self.save_auto.isChecked():
            self._editor.save_to(self.folder_edit.text())
        if self.copy_auto.isChecked():
            self._editor.copy_to_clipboard()

    def _reset(self, message: str = "") -> None:
        self._busy = False
        self.show()
        self.raise_()
        if message:
            self.statusBar().showMessage(message, 6000)

    # ---------- التمرير ----------
    def _start_scroll(self, rect) -> None:
        self._hud = ScrollHud()
        self._hud.finish_clicked.connect(lambda: self._worker and self._worker.request_stop())
        self._hud.show()

        self._thread = QThread(self)
        self._worker = ScrollWorker(rect, mode=str(self.mode_combo.currentData() or "auto"))
        self._worker.moveToThread(self._thread)
        self._thread.started.connect(self._worker.run)
        self._worker.progress.connect(self._on_progress)
        self._worker.notice.connect(self._on_notice)
        self._worker.finished.connect(self._on_scroll_finished)
        self._worker.failed.connect(self._on_scroll_failed)
        self._thread.start()

        self._center = (rect.left + rect.width // 2, rect.top + rect.height // 2)
        self._esc_timer = QTimer(self)
        self._esc_timer.timeout.connect(self._poll_stop)
        self._esc_timer.start(120)

    def _poll_stop(self) -> None:
        if not self._worker:
            return
        if winapi.esc_pressed():
            self._worker.request_stop()
            return
        if str(self.mode_combo.currentData()) == "auto":
            x, y = winapi.cursor_pos()
            if abs(x - self._center[0]) > 60 or abs(y - self._center[1]) > 60:
                # المستخدم أمسك الفأرة: نتوقف بدل معاركته
                self._worker.request_stop()

    def _on_progress(self, frames: int, height: int) -> None:
        if not self._hud:
            return
        template = self._tr.t("hud_auto" if str(self.mode_combo.currentData()) == "auto" else "hud_manual")
        text = template.format(frames=self._tr.count("frames", frames),
                              pixels=self._tr.count("pixels", height))
        self._hud.update_text(text, self._tr.t("finish"))

    def _on_notice(self, key: str) -> None:
        self.statusBar().showMessage(self._tr.t(key), 6000)

    def _stop_thread(self) -> None:
        if self._esc_timer:
            self._esc_timer.stop()
        if self._thread:
            self._thread.quit()
            self._thread.wait(2000)
            self._thread = None
        self._worker = None
        if self._hud:
            self._hud.close()
            self._hud = None

    def _on_scroll_failed(self, message: str) -> None:
        self._stop_thread()
        self._reset(self._tr.t("err", e=message))

    def _on_scroll_finished(self, rgb) -> None:
        self._stop_thread()
        if rgb is None:
            self._reset(self._tr.t("no_scroll"))
            return
        self._open_editor(capture.rgb_to_qimage(rgb))

    # ---------- شريط المهام ----------
    def set_tray_available(self, available: bool) -> None:
        self._tray = available

    def quit(self) -> None:
        self._quitting = True
        self.close()

    def closeEvent(self, event) -> None:
        if self._tray and not self._quitting:
            event.ignore()
            self.hide()
            self.statusBar().showMessage("")
            return
        event.accept()
        QApplication.instance().quit()
