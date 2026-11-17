from pathlib import Path
import subprocess
import time
from playwright.sync_api import sync_playwright

server = subprocess.Popen(['python', '-m', 'http.server', '4194'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    time.sleep(1)
    output = Path('artifacts/phase3h-after')
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(reduced_motion='reduce')
        for width in [375, 390, 768, 1024, 1440]:
            page.set_viewport_size({'width': width, 'height': 900})
            for route in ['dashboard', 'transactions', 'budgets', 'savings', 'profile', 'settings']:
                page.goto(f'http://127.0.0.1:4194/#{route}')
                page.screenshot(path=str(output / f'{route}-{width}.png'), full_page=True)
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (route, width)
        browser.close()
    print('VISUAL_3H_PASS: 30 captures Chromium, 5 widths, 6 routes')
finally:
    server.terminate()
    server.wait()
