"""ترجمة مع إشارة تغيير لغوي وجموع عربية صحيحة."""
from __future__ import annotations

from PySide6.QtCore import QObject, Signal

STRINGS: dict[str, dict] = {
    "en": {
        "tagline": "Capture anything, even beyond the screen",
        "region": "Region capture", "region_sub": "Drag to select an area",
        "scroll": "Scrolling capture", "scroll_sub": "Select an area and capture it beyond the screen",
        "full": "Full screen", "full_sub": "Capture the entire current monitor",
        "settings": "Capture options",
        "delay": "Delay", "no_delay": "None", "seconds": "{n} seconds",
        "mode": "Scroll mode", "auto": "Automatic", "manual": "Manual (I scroll)",
        "copy_auto": "Copy to clipboard automatically", "save_auto": "Save automatically",
        "folder": "Save folder", "change": "Change", "open": "Open",
        "hotkeys": "Hotkeys:  Ctrl+Shift+S region  ·  Ctrl+Shift+W scrolling  ·  Ctrl+Shift+F full screen",
        "language": "Language",
        "frames": "{n} frames", "pixels": "{n}px",
        "hud_auto": "Scrolling…  {frames} · {pixels}  —  Esc to finish",
        "hud_manual": "Scroll the content yourself…  {frames} · {pixels}  —  Esc to finish",
        "finish": "Finish",
        "hint_region": "Drag to select  ·  Esc to cancel",
        "hint_scroll": "Select the scrollable area  ·  Esc to cancel",
        "pen": "Pen", "highlighter": "Highlighter", "rect": "Rectangle", "arrow": "Arrow", "text": "Text",
        "undo": "Undo", "redo": "Redo", "copy": "Copy", "save": "Save", "save_as": "Save as…",
        "new": "New capture", "fit": "Fit", "actual": "100%", "size": "Size", "color": "Color",
        "saved": "Saved: {p}", "copied": "Copied to clipboard", "save_failed": "Could not save the file",
        "no_scroll": "Nothing scrolled inside the selected area. Make sure it is scrollable, or try manual mode.",
        "limit": "Maximum image size reached — the capture was truncated.",
        "tray_running": "ScrollSnip is still running in the tray",
        "enter_text": "Enter text", "quit": "Quit", "show": "Open",
        "capturing_in": "Capture starts in {n}",
        "unsaved_title": "Unsaved changes", "unsaved_msg": "Do you want to save the image before closing?",
        "discard": "Discard", "cancel": "Cancel", "already_running": "ScrollSnip is already running.",
        "hotkey_fail": "Could not register hotkey {k} (used by another program)",
        "err": "Error: {e}", "editor_title": "Editor",
    },
    "ar": {
        "tagline": "التقط أي شيء، حتى ما يتجاوز حدود الشاشة",
        "region": "لقطة منطقة", "region_sub": "اسحب لتحديد جزء من الشاشة",
        "scroll": "لقطة بالتمرير", "scroll_sub": "حدّد منطقة ليتم تمريرها والتقاطها كاملة",
        "full": "الشاشة كاملة", "full_sub": "التقاط الشاشة الحالية بالكامل",
        "settings": "خيارات الالتقاط",
        "delay": "التأخير", "no_delay": "بدون", "seconds": "{n} ثانية",
        "mode": "نمط التمرير", "auto": "تلقائي", "manual": "يدوي (أنا أمرّر)",
        "copy_auto": "نسخ اللقطة للحافظة تلقائيًا", "save_auto": "حفظ اللقطة تلقائيًا",
        "folder": "مجلد الحفظ", "change": "تغيير", "open": "فتح",
        "hotkeys": "الاختصارات:  Ctrl+Shift+S منطقة  ·  Ctrl+Shift+W تمرير  ·  Ctrl+Shift+F شاشة كاملة",
        "language": "اللغة",
        "frames": {"one": "إطار واحد", "two": "إطاران", "few": "{n} إطارات",
                   "many": "{n} إطارًا", "other": "{n} إطار"},
        "pixels": {"one": "بكسل واحد", "two": "بكسلان", "few": "{n} بكسلات",
                   "many": "{n} بكسلًا", "other": "{n} بكسل"},
        "hud_auto": "جارٍ التمرير…  {frames} · {pixels}  —  Esc للإنهاء",
        "hud_manual": "مرّر المحتوى بنفسك…  {frames} · {pixels}  —  Esc للإنهاء",
        "finish": "إنهاء",
        "hint_region": "اسحب للتحديد  ·  Esc للإلغاء",
        "hint_scroll": "حدّد المنطقة القابلة للتمرير  ·  Esc للإلغاء",
        "pen": "قلم", "highlighter": "تمييز", "rect": "مستطيل", "arrow": "سهم", "text": "نص",
        "undo": "تراجع", "redo": "إعادة", "copy": "نسخ", "save": "حفظ", "save_as": "حفظ باسم…",
        "new": "لقطة جديدة", "fit": "ملاءمة", "actual": "100%", "size": "السُّمك", "color": "اللون",
        "saved": "تم الحفظ: {p}", "copied": "تم النسخ إلى الحافظة", "save_failed": "تعذّر حفظ الملف",
        "no_scroll": "لم يتحرك المحتوى داخل المنطقة. تأكد أنها قابلة للتمرير أو جرّب النمط اليدوي.",
        "limit": "تم بلوغ الحد الأقصى لحجم الصورة — اقتُطع الطول.",
        "tray_running": "ScrollSnip ما زال يعمل في شريط المهام",
        "enter_text": "أدخل النص", "quit": "خروج", "show": "فتح",
        "capturing_in": "ستبدأ اللقطة بعد {n}",
        "unsaved_title": "تغييرات غير محفوظة", "unsaved_msg": "هل تريد حفظ الصورة قبل الإغلاق؟",
        "discard": "تجاهل", "cancel": "إلغاء", "already_running": "ScrollSnip يعمل بالفعل.",
        "hotkey_fail": "تعذّر تسجيل الاختصار {k} (مستخدم في برنامج آخر)",
        "err": "حدث خطأ: {e}", "editor_title": "المحرر",
    },
}

# الجموع العربية: واحد/مثنى/3-10/11-99/غير ذلك
PLURALS = {"en": {"zero": "other", "one": "one", "two": "other", "few": "other",
                  "many": "other", "other": "other"}}


def arabic_form(n: int) -> str:
    if n == 0:
        return "zero"
    if n == 1:
        return "one"
    if n == 2:
        return "two"
    if 3 <= n % 100 <= 10:
        return "few"
    if 11 <= n % 100 <= 99:
        return "many"
    return "other"


class Translator(QObject):
    changed = Signal()

    def __init__(self, language: str = "ar") -> None:
        super().__init__()
        self._language = language
        self._forms = PLURALS["en"]

    @property
    def language(self) -> str:
        return self._language

    @property
    def is_rtl(self) -> bool:
        return self._language == "ar"

    def set_language(self, code: str) -> None:
        if code not in STRINGS or code == self._language:
            return
        self._language = code
        self.changed.emit()

    def t(self, key: str, **kwargs) -> str:
        table = STRINGS.get(self._language, STRINGS["en"])
        value = table.get(key)
        if value is None:
            value = STRINGS["en"].get(key, key)
        if isinstance(value, dict):
            form = arabic_form(int(kwargs.get("n", 0))) if self.is_rtl else "other"
            value = value.get(form) or value.get("other") or next(iter(value.values()))
        try:
            return value.format(**kwargs)
        except (KeyError, IndexError, ValueError):
            return value

    def count(self, key: str, n: int) -> str:
        return self.t(key, n=n)


_translator: Translator | None = None


def translator() -> Translator:
    """كائن واحد يُنشأ بعد QApplication (حتى تعمل الإشارات)."""
    global _translator
    if _translator is None:
        _translator = Translator()
    return _translator


def t(key: str, **kwargs) -> str:
    return translator().t(key, **kwargs)
