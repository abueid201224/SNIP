"""تحديد المنطقة، عدّاد التأخير، وشريط تقدّم التمرير."""
from __future__ import annotations

from PySide6.QtCore import QRect, QTimer, Qt, Signal
from PySide6.QtGui import QColor, QFont, QGuiApplication, QPainter, QPen
from PySide6.QtWidgets import (QFrame, QHBoxLayout, QLabel, QPushButton, QVBoxLayout, QWidget)

from . import winapi


class RegionOverlay(QWidget):
    selected = Signal(QRect)
    cancelled = Signal()

    def __init__(self, hint: str) -> None:
        super().__init__(None, Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint | Qt.Tool)
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.setCursor(Qt.CrossCursor)
        self.setMouseTracking(True)
        self._hint = hint
        self._origin = QGuiApplication.primaryScreen().virtualGeometry().topLeft()
        self.setGeometry(QGuiApplication.primaryScreen().virtualGeometry())
        self._start = None
        self._current = None

    def showEvent(self, event) -> None:
        super().showEvent(event)
        winapi.exclude_from_capture(int(self.winId()))
        self.raise_()
        self.activateWindow()
        self.grabKeyboard()

    def _selection(self) -> QRect | None:
        if self._start is None or self._current is None:
            return None
        rect = QRect(self._start, self._current).normalized()
        return rect if rect.width() > 4 and rect.height() > 4 else None

    def paintEvent(self, event) -> None:
        painter = QPainter(self)
        painter.fillRect(self.rect(), QColor(8, 9, 12, 120))
        selection = self._selection()
        if selection:
            local = selection.translated(-self._origin)
            painter.setCompositionMode(QPainter.CompositionMode_Clear)
            painter.fillRect(local, Qt.transparent)
            painter.setCompositionMode(QPainter.CompositionMode_SourceOver)
            painter.setPen(QPen(QColor("#4f8cff"), 1.5))
            painter.drawRect(local)
            painter.setPen(QColor("#e8eaed"))
            painter.setFont(QFont("Segoe UI", 9))
            painter.drawText(local.adjusted(4, 0, 0, -6), Qt.AlignLeft | Qt.AlignBottom,
                             f"{selection.width()} × {selection.height()}")
        painter.setPen(QColor("#c8ccd4"))
        painter.setFont(QFont("Segoe UI", 11))
        painter.drawText(self.rect(), Qt.AlignCenter, self._hint)

    def mousePressEvent(self, event) -> None:
        if event.button() == Qt.LeftButton:
            self._start = event.position().toPoint()
            self._current = self._start
            self.update()

    def mouseMoveEvent(self, event) -> None:
        if self._start is not None:
            self._current = event.position().toPoint()
            self.update()

    def mouseReleaseEvent(self, event) -> None:
        if event.button() != Qt.LeftButton:
            return
        selection = self._selection()
        self.releaseKeyboard()
        self.hide()
        if selection:
            self.selected.emit(selection.translated(self._origin))
        else:
            self.cancelled.emit()
        self.deleteLater()

    def keyPressEvent(self, event) -> None:
        if event.key() == Qt.Key_Escape:
            self.releaseKeyboard()
            self.hide()
            self.cancelled.emit()
            self.deleteLater()


class Countdown(QWidget):
    done = Signal()

    def __init__(self, seconds: int) -> None:
        super().__init__(None, Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint | Qt.Tool)
        self.setAttribute(Qt.WA_TranslucentBackground)
        self._left = seconds
        self._label = QLabel(str(seconds), self)
        self._label.setAlignment(Qt.AlignCenter)
        self._label.setStyleSheet(
            "background: rgba(24,25,29,235); border: 1px solid #4f8cff; border-radius: 16px;"
            "font-size: 34pt; font-weight: 600; color: #e8eaed; padding: 18px 34px;"
        )
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.addWidget(self._label)
        self.adjustSize()
        screen = QGuiApplication.primaryScreen().availableGeometry()
        self.move(screen.center() - self.rect().center())
        self._timer = QTimer(self)
        self._timer.timeout.connect(self._tick)
        self._timer.start(1000)

    def showEvent(self, event) -> None:
        super().showEvent(event)
        winapi.exclude_from_capture(int(self.winId()))

    def _tick(self) -> None:
        self._left -= 1
        if self._left <= 0:
            self._timer.stop()
            self.hide()
            self.deleteLater()
            self.done.emit()
            return
        self._label.setText(str(self._left))


class ScrollHud(QFrame):
    finish_clicked = Signal()

    def __init__(self) -> None:
        super().__init__(None, Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint | Qt.Tool)
        self.setObjectName("hud")
        self._label = QLabel()
        self._label.setWordWrap(True)
        self._button = QPushButton()
        self._button.setObjectName("primary")
        self._button.clicked.connect(self.finish_clicked.emit)

        layout = QHBoxLayout(self)
        layout.setContentsMargins(16, 12, 16, 12)
        layout.setSpacing(12)
        layout.addWidget(self._label, 1)
        layout.addWidget(self._button)

        screen = QGuiApplication.primaryScreen().availableGeometry()
        self.setFixedWidth(min(560, screen.width() - 120))
        self.adjustSize()
        self.move(screen.center().x() - self.width() // 2, screen.top() + 40)

    def showEvent(self, event) -> None:
        super().showEvent(event)
        winapi.exclude_from_capture(int(self.winId()))

    def update_text(self, text: str, finish_text: str) -> None:
        self._label.setText(text)
        self._button.setText(finish_text)
        self.adjustSize()
