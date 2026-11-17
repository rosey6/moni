from pathlib import Path

from playwright.sync_api import sync_playwright


output_dir = Path("artifacts/screenshots")
output_dir.mkdir(parents=True, exist_ok=True)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    for width in (375, 390, 768, 1024, 1440):
        page = browser.new_page(viewport={"width": width, "height": 900})
        page.goto("http://127.0.0.1:4173", wait_until="networkidle")
        assert page.locator("img.mascot").count() == 0
        print(width, page.locator(".welcome-actions").bounding_box())
        page.screenshot(path=output_dir / f"welcome-{width}.png", full_page=True)
        assert page.locator("h1").inner_text() == "Bienvenue"
        page.keyboard.press("Tab")
        assert page.locator("button[data-route='signup']").evaluate("element => document.activeElement === element")
        page.keyboard.press("Tab")
        assert page.locator("button[data-route='login']").evaluate("element => document.activeElement === element")
        if width == 375:
            page.screenshot(path=output_dir / "welcome-focus-375.png", full_page=True)
        page.get_by_role("button", name="Créer un compte").click()
        page.wait_for_selector("form[aria-label='Créer un compte']")
        assert page.url.endswith("#signup")
        page.goto("http://127.0.0.1:4173", wait_until="networkidle")
        page.get_by_role("button", name="Se connecter").click()
        page.wait_for_selector("form[aria-label='Se connecter']")
        assert page.url.endswith("#login")
        page.close()
    browser.close()
