"""المحرر المدمج: قلم، تمييز، مستطيل، سهم، نص، تراجع/إعادة، تكبير."""
from __future__ import annotations

import datetime as dt
import os
from dataclasses import dataclass, field

from PySide6.QtCore import QPoint, QPointF, QRect, Qt, Signal
from PySide6.QtGui import (QAction, QColor, QGuiApplication, QImage, QPainter, QPen, QPixmap,
                           QPolygonF)
from PySide6.QtWidgets import (QApplication, QColorDialog, QFileDialog, QInputDialog, QLabel,
                               QMainWindow, QScrollArea, QSlider, QToolBar, QToolButton, QWidget)

from .i18n import translator

SWATCHES = ["#ff4d4f", "#ffd60a", "#32d74b", "#4f8cff", "#ffffff"]


@dataclass
class Shape:
    tool: str
    color: QColor
    width: int
    points: list[QPointF] = field(default_factory=list)
    text: str = ""


def draw_shape(painter: QPainter, shape: Shape) -> None:
    color = QColor(shape.color)
    if shape.tool == "highlighter":
        color.setAlpha(110)
    pen = QPen(color, shape.width, Qt.SolidLine, Qt.RoundCap, Qt.RoundJoin)
    painter.setPen(pen)
    painter.setBrush(Qt.NoBrush)

    if shape.tool in ("pen", "highlighter"):
        if len(shape.points) > 1:
            painter.drawPolyline(QPolygonF(shape.points))
        elif shape.points:
            painter.setBrush(color)
            painter.drawEllipse(shape.points[0], shape.width / 2, shape.width / 2)
    elif shape.tool == "rect" and len(shape.points) >= 2:
        painter.drawRect(QRect(shape.points[0].toPoint(), shape.points[-1].toPoint()).normalized())
    elif shape.tool == "arrow" and len(shape.points) >= 2:
        start, end = shape.points[0], shape.points[-1]
        painter.drawLine(start, end)
        painter.setBrush(color)
        painter.setPen(Qt.NoPen)
        painter.drawPolygon(arrow_head(start, end, shape.width))
    elif shape.tool == "text" and shape.text and shape.points:
        font = painter.font()
        font.setPointSizeF(max(9.0, shape.width * 2.6))
        font.setBold(True)
        painter.setFont(font)
        painter.setPen(color)
        painter.drawText(shape.points[0], shape.text)


def arrow_head(start: QPointF, end: QPointF, width: int) -> QPolygonF:
    import math

    angle = math.atan2(end.y() - start.y(), end.x() - start.x())
    size = max(10.0, width * 4.0)
    left = QPointF(end.x() - size * math.cos(angle - 0.45), end.y() - size * math.sin(angle - 0.45))
    right = QPointF(end.x() - size * math.cos(angle + 0.45), end.y() - size * math.sin(angle + 0.45))
    return QPolygonF([end, left, right])


class ImageCanvas(QWidget):
    changed = Signal()

    def __init__(self, image: QImage) -> None:
        super().__init__()
        self._image = image
        self._pixmap = QPixmap.fromImage(image)  # QPixmap على خيط الواجهة فقط
        self._shapes: list[Shape] = []
        self._redo: list[Shape] = []
        self._draft: Shape | None = None
        self._zoom = 1.0
        self.tool = "pen"
        self.color = QColor(SWATCHES[0])
        self.width = 4
        self.setMouseTracking(True)
        self.setCursor(Qt.CrossCursor)
        self._apply_size()

    def _apply_size(self) -> None:
        self.setFixedSize(int(self._pixmap.width() * self._zoom),
                          int(self._pixmap.height() * self._zoom))

    def set_zoom(self, zoom: float) -> None:
        self._zoom = max(0.05, min(8.0, zoom))
        self._apply_size()
        self.update()

    def zoom(self) -> float:
        return self._zoom

    def fit_zoom(self, viewport) -> float:
        if not self._pixmap.width():
            return 1.0
        return min(viewport.width() / self._pixmap.width(),
                   viewport.height() / self._pixmap.height(), 1.0)

    def add_shape(self, shape: Shape) -> None:
        self._shapes.append(shape)
        self._redo.clear()
        self.changed.emit()
        self.update()

    def undo(self) -> None:
        if self._shapes:
            self._redo.append(self._shapes.pop())
            self.changed.emit()
            self.update()

    def redo(self) -> None:
        if self._redo:
            self._shapes.append(self._redo.pop())
            self.changed.emit()
            self.update()

    def paintEvent(self, event) -> None:
        painter = QPainter(self)
        painter.scale(self._zoom, self._zoom)
        painter.drawPixmap(0, 0, self._pixmap)
        for shape in self._shapes:
            draw_shape(painter, shape)
        if self._draft:
            draw_shape(painter, self._draft)

    def _to_image(self, pos: QPoint) -> QPointF:
        return QPointF(pos.x() / self._zoom, pos.y() / self._zoom)

    def mousePressEvent(self, event) -> None:
        if event.button() != Qt.LeftButton:
            return
        point = self._to_image(event.position().toPoint())
        if self.tool == "text":
            text, ok = QInputDialog.getText(self, translator().t("enter_text"), translator().t("text"))
            if ok and text.strip():
                self.add_shape(Shape("text", self.color, self.width, [point], text.strip()))
            return
        self._draft = Shape(self.tool, QColor(self.color), self.width, [point])

    def mouseMoveEvent(self, event) -> None:
        if self._draft is None:
            return
        point = self._to_image(event.position().toPoint())
        if self._draft.tool in ("pen", "highlighter"):
            self._draft.points.append(point)
        else:
            self._draft.points = self._draft.points[:1] + [point]
        self.update()

    def mouseReleaseEvent(self, event) -> None:
        draft, self._draft = self._draft, None
        if draft is None:
            return
        if len(draft.points) > 1 or draft.tool == "text":
            self.add_shape(draft)
        self.update()

    def composited(self) -> QImage:
        """صورة بالحجم الكامل (بكسل فعلي) بكل التوسيمات."""
        output = QImage(self._image.size(), QImage.Format_ARGB32_Premultiplied)
        output.fill(Qt.transparent)
        painter = QPainter(output)
        painter.drawImage(0, 0, self._image)
        for shape in self._shapes:
            draw_shape(painter, shape)
        return output


class EditorWindow(QMainWindow):
    notice = Signal(str)

    def __init__(self, image: QImage) -> None:
        super().__init__()
        self._tr = translator()
        self.canvas = ImageCanvas(image)
        self._scroll = QScrollArea()
        self._scroll.setObjectName("canvasArea")
        self._scroll.setWidget(self.canvas)
        self._scroll.setWidgetResizable(False)
        self._scroll.setAlignment(Qt.AlignCenter)
        self.setCentralWidget(self._scroll)
        self.setWindowTitle(self._tr.t("editor_title"))
        self.resize(1040, 780)
        self._build_toolbar()
        self.retranslate()
        self._tr.changed.connect(self.retranslate)
        self._fit()

    # ---------- أدوات ----------
    def _build_toolbar(self) -> None:
        bar = QToolBar()
        bar.setMovable(False)
        self.addToolBar(bar)
        self._tool_buttons: dict[str, QToolButton] = {}
        for tool in ("pen", "highlighter", "rect", "arrow", "text"):
            button = QToolButton()
            button.setObjectName("tool")
            button.setCheckable(True)
            button.setProperty("tool", tool)
            button.clicked.connect(lambda _=False, t=tool: self._select_tool(t))
            bar.addWidget(button)
            self._tool_buttons[tool] = button
        self._tool_buttons["pen"].setChecked(True)

        bar.addSeparator()
        self._swatch_group: list[QToolButton] = []
        for color in SWATCHES:
            button = QToolButton()
            button.setObjectName("swatch")
            button.setCheckable(True)
            button.setStyleSheet(f"background-color: {color};")
            button.clicked.connect(lambda _=False, c=color: self._select_color(c))
            bar.addWidget(button)
            self._swatch_group.append(button)
        self._swatch_group[0].setChecked(True)

        self._size = QSlider(Qt.Horizontal)
        self._size.setRange(1, 30)
        self._size.setValue(4)
        self._size.setFixedWidth(110)
        self._size.valueChanged.connect(self._set_width)
        bar.addWidget(self._size)

        bar.addSeparator()
        self._undo_btn = QToolButton()
        self._undo_btn.setObjectName("tool")
        self._undo_btn.clicked.connect(self.canvas.undo)
        bar.addWidget(self._undo_btn)
        self._redo_btn = QToolButton()
        self._redo_btn.setObjectName("tool")
        self._redo_btn.clicked.connect(self.canvas.redo)
        bar.addWidget(self._redo_btn)

        bar.addSeparator()
        self._fit_btn = QToolButton()
        self._fit_btn.setObjectName("tool")
        self._fit_btn.clicked.connect(self._fit)
        bar.addWidget(self._fit_btn)
        self._actual_btn = QToolButton()
        self._actual_btn.setObjectName("tool")
        self._actual_btn.clicked.connect(lambda: self.canvas.set_zoom(1.0))
        bar.addWidget(self._actual_btn)

        spacer = QWidget()
        spacer.setSizePolicy(spacer.sizePolicy().horizontalPolicy(),
                             spacer.sizePolicy().verticalPolicy())
        bar.addWidget(spacer)
        self._copy_btn = QToolButton()
        self._copy_btn.setObjectName("tool")
        self._copy_btn.clicked.connect(self.copy_to_clipboard)
        bar.addWidget(self._copy_btn)
        self._save_btn = QToolButton()
        self._save_btn.setObjectName("tool")
        self._save_btn.clicked.connect(lambda: self.save_to())
        bar.addWidget(self._save_btn)
        self._save_as_btn = QToolButton()
        self._save_as_btn.setObjectName("tool")
        self._save_as_btn.clicked.connect(self.save_as)
        bar.addWidget(self._save_as_btn)

    def _select_tool(self, tool: str) -> None:
        self.canvas.tool = tool
        for key, button in self._tool_buttons.items():
            button.setChecked(key == tool)

    def _select_color(self, color: str) -> None:
        self.canvas.color = QColor(color)
        for index, button in enumerate(self._swatch_group):
            button.setChecked(SWATCHES[index] == color)

    def _set_width(self, value: int) -> None:
        self.canvas.width = value

    def _fit(self) -> None:
        self.canvas.set_zoom(self.canvas.fit_zoom(self._scroll.viewport()))

    # ---------- ترجمة ----------
    def retranslate(self) -> None:
        self.setWindowTitle(self._tr.t("editor_title"))
        for tool, button in self._tool_buttons.items():
            button.setText(self._tr.t(tool))
            button.setToolTip(self._tr.t(tool))
        self._undo_btn.setText(self._tr.t("undo"))
        self._redo_btn.setText(self._tr.t("redo"))
        self._fit_btn.setText(self._tr.t("fit"))
        self._actual_btn.setText(self._tr.t("actual"))
        self._copy_btn.setText(self._tr.t("copy"))
        self._save_btn.setText(self._tr.t("save"))
        self._save_as_btn.setText(self._tr.t("save_as"))

    # ---------- إخراج ----------
    def copy_to_clipboard(self) -> None:
        QGuiApplication.clipboard().setImage(self.canvas.composited())
        self.notice.emit(self._tr.t("copied"))

    def save_to(self, folder: str | None = None, path: str | None = None) -> str | None:
        if path is None:
            folder = folder or os.getcwd()
            name = dt.datetime.now().strftime("ScrollSnip_%Y%m%d_%H%M%S.png")
            path = os.path.join(folder, name)
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        if self.canvas.composited().save(path, "PNG"):
            self.notice.emit(self._tr.t("saved", p=path))
            return path
        self.notice.emit(self._tr.t("save_failed"))
        return None

    def save_as(self) -> None:
        path, _ = QFileDialog.getSaveFileName(self, self._tr.t("save_as"), "", "PNG (*.png)")
        if path:
            self.save_to(path=path)
