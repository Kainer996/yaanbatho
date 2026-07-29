"""Camera result layout — the fixed result card must not overlap the camera CTA."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"


def test_photo_result_hides_redundant_camera_button_without_disabling_photo_chooser():
    html = HTML.read_text(encoding="utf-8")
    assert "#screen-scan.camera-mode:has(#scanResult.show) #captureBtn" in html
    assert "$('uploadArea').addEventListener('click', () => { SFX.tap(); openNativeCamera(); });" in html


def test_camera_result_overlap_fix_remains_in_release_history():
    marker = "camera-result-overlap-v155-20260729"
    assert marker in SW.read_text(encoding="utf-8")
