"""Camera result layout — the fixed result card must not overlap the camera CTA."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"


def test_home_photo_result_keeps_camera_start_visible_without_overlap():
    html = HTML.read_text(encoding="utf-8")
    css = (ROOT / "scan_home.css").read_text()
    assert "#screen-scan.camera-mode:has(#scanResult.show) .scan-home-start-buttons #captureBtn{display:block}" in css
    assert "#screen-scan.camera-mode #scanResult{position:static" in css
    assert "$('uploadArea').addEventListener('click', () => { SFX.tap(); openNativeCamera(); });" in html


def test_camera_result_overlap_fix_remains_in_release_history():
    marker = "camera-result-overlap-v155-20260729"
    assert marker in SW.read_text(encoding="utf-8")
