"""A worker may only activate after every synchronous local boot script exists."""
from html.parser import HTMLParser
from pathlib import Path
import re
import subprocess
ROOT = Path(__file__).resolve().parents[1]

class BootScripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []
    def handle_starttag(self, tag, attrs):
        src = dict(attrs).get('src', '')
        if tag == 'script' and src and not re.match(r'(https?:)?//', src):
            self.urls.append('./' + src.lstrip('./'))

def test_all_real_boot_scripts_are_required_before_worker_activation():
    subprocess.run(['node', '--check', str(ROOT / 'sw.js')], check=True)
    parser = BootScripts()
    parser.feed((ROOT / 'index.html').read_text())
    assert len(parser.urls) >= 90
    worker = (ROOT / 'sw.js').read_text()
    for group in ('BURBZ_ASSETS', 'BURBZ_CORE', 'BURBZ_INSTALL_REQUIRED'):
        text = re.search(r'const ' + group + r' = \[(.*?)\];', worker, re.S)[1]
        entries = re.findall(r"^\s*['\"]([^'\"]+)['\"]", text, re.M)
        for src in parser.urls:
            assert entries.count(src) == 1, (group, src)
            assert (ROOT / src[2:].split('?')[0]).is_file(), src
    assert 'Promise.all(BURBZ_INSTALL_REQUIRED.map' in worker
    assert worker.index('Promise.all(BURBZ_INSTALL_REQUIRED.map') < worker.index('.then(() => self.skipWaiting())')
