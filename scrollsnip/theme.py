"""ثيم داكن. لا تحجيم يدوي لأي px: Qt6 يطبّق devicePixelRatio تلقائيًا."""
from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtGui import QColor, QFont, QPalette

QSS = """
QWidget { font-family: "Segoe UI", "Tahoma", sans-serif; font-size: 10pt; color: #e8eaed; }
QMainWindow, QWidget#root { background: #1c1d21; }
QLabel#title { font-size: 18pt; font-weight: 600; }
QLabel#muted { color: #9aa0aa; }
QLabel#cardTitle { font-size: 11pt; font-weight: 600; }
QLabel#cardGlyph { font-size: 22pt; color: #4f8cff; }
QFrame#panel { background: #25272c; border: 1px solid #30333a; border-radius: 12px; }
QPushButton#card { background: #2a2c31; border: 1px solid #34363c; border-radius: 12px; padding: 0; }
QPushButton#card:hover { background: #32353b; border-color: #4f8cff; }
QPushButton#card:pressed { background: #2a3550; }
QPushButton { background: #31343a; border: 1px solid #3a3d44; border-radius: 8px; padding: 6px 14px; }
QPushButton:hover { background: #3a3e45; }
QPushButton#primary { background: #4f8cff; border: none; color: white; font-weight: 600; padding: 7px 18px; }
QPushButton#primary:hover { background: #6ba0ff; }
QToolButton#tool { background: transparent; border: 1px solid transparent; border-radius: 8px; padding: 6px 12px; }
QToolButton#tool:hover { background: #2f3238; }
QToolButton#tool:checked { background: #3b6fe0; color: white; }
QToolButton#swatch { border: 2px solid #3a3d44; border-radius: 11px; min-width: 20px; max-width: 20px;
                     min-height: 20px; max-height: 20px; }
QToolButton#swatch:hover { border-color: #9aa0aa; }
QToolButton#swatch:checked { border-color: #ffffff; }
QComboBox { background: #2f3238; border: 1px solid #3a3d44; border-radius: 8px; padding: 5px 10px; min-width: 120px; }
QComboBox::drop-down { border: none; width: 22px; }
QComboBox QAbstractItemView { background: #2a2c31; border: 1px solid #3a3d44;
                              selection-background-color: #3b6fe0; outline: none; }
QLineEdit { background: #2a2c31; border: 1px solid #3a3d44; border-radius: 8px; padding: 5px 10px; color: #9aa0aa; }
QCheckBox { spacing: 8px; }
QCheckBox::indicator { width: 16px; height: 16px; border-radius: 5px; border: 1px solid #5a5e66; background: #2a2c31; }
QCheckBox::indicator:checked { background: #4f8cff; border-color: #4f8cff; }
QSlider::groove:horizontal { height: 4px; background: #3a3d44; border-radius: 2px; }
QSlider::handle:horizontal { background: #4f8cff; width: 14px; height: 14px; margin: -5px 0; border-radius: 7px; }
QScrollArea#canvasArea, QWidget#vp { background: #141518; border: none; }
QScrollBar:vertical { background: transparent; width: 12px; }
QScrollBar::handle:vertical { background: #4a4d55; border-radius: 5px; min-height: 30px; margin: 2px; }
QScrollBar:horizontal { background: transparent; height: 12px; }
QScrollBar::handle:horizontal { background: #4a4d55; border-radius: 5px; min-width: 30px; margin: 2px; }
QScrollBar::add-line, QScrollBar::sub-line { height: 0; width: 0; }
QStatusBar { background: #232529; color: #9aa0aa; }
QFrame#hud { background: rgba(24, 25, 29, 235); border: 1px solid #4f8cff; border-radius: 12px; }
QToolBar { background: #232529; border-bottom: 1px solid #30333a; spacing: 6px; padding: 6px; }
QMenu { background: #2a2c31; border: 1px solid #3a3d44; padding: 4px; }
QMenu::item { padding: 6px 22px; border-radius: 6px; }
QMenu::item:selected { background: #3b6fe0; }
"""


def _palette() -> QPalette:
    palette = QPalette()
    palette.setColor(QPalette.Window, QColor("#1c1d21"))
    palette.setColor(QPalette.WindowText, QColor("#e8eaed"))
    palette.setColor(QPalette.Base, QColor("#141518"))
    palette.setColor(QPalette.AlternateBase, QColor("#25272c"))
    palette.setColor(QPalette.Text, QColor("#e8eaed"))
    palette.setColor(QPalette.Button, QColor("#31343a"))
    palette.setColor(QPalette.ButtonText, QColor("#e8eaed"))
    palette.setColor(QPalette.Highlight, QColor("#4f8cff"))
    palette.setColor(QPalette.HighlightedText, QColor("#ffffff"))
    palette.setColor(QPalette.ToolTipBase, QColor("#25272c"))
    palette.setColor(QPalette.ToolTipText, QColor("#e8eaed"))
    return palette


def apply_theme(app, rtl: bool) -> None:
    app.setStyle("Fusion")
    app.setPalette(_palette())
    app.setStyleSheet(QSS)
    font = QFont("Segoe UI", 10)
    font.setStyleStrategy(QFont.PreferAntialias)
    app.setFont(font)
    app.setLayoutDirection(Qt.RightToLeft if rtl else Qt.LeftToRight)
