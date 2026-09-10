"""The market's actual application functions, including durable trade rollback."""
from pathlib import Path
import subprocess


def test_market_tabs_trade_contract():
    subprocess.run(['node', str(Path(__file__).with_suffix('.cjs'))], check=True)
