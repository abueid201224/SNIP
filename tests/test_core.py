import numpy as np

from scrollsnip.imaging import ScrollBuffer, detect_shift
from scrollsnip.i18n import arabic_form


def _page(height=700, width=320):
    rng = np.random.default_rng(7)
    return rng.integers(0, 255, (height, width), dtype=np.uint8)


def test_detect_shift_exact_offset():
    page = _page()
    prev, cur = page[:400], page[130:530]
    shift, score = detect_shift(prev, cur, target_width=10_000)
    assert score > 0.95
    assert abs(shift - 130) <= 1


def test_detect_shift_identical_frames_means_no_scroll():
    page = _page()
    shift, score = detect_shift(page[:400], page[:400], target_width=10_000)
    assert shift == 0


def test_buffer_appends_only_new_rows():
    frame = np.zeros((300, 240, 4), np.uint8)
    buffer = ScrollBuffer(240, 300, max_bytes=240 * 4 * 1000)
    buffer.start(frame)
    assert buffer.height == 300
    assert buffer.append(np.ones((300, 240, 4), np.uint8), 50) == 50
    assert buffer.height == 350
    assert buffer.to_rgb().shape == (350, 240, 3)


def test_arabic_plural_forms():
    assert arabic_form(1) == "one"
    assert arabic_form(2) == "two"
    assert arabic_form(5) == "few"
    assert arabic_form(15) == "many"
