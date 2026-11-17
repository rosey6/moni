from pathlib import Path

from playwright.sync_api import sync_playwright


output_dir = Path("artifacts/auth")
output_dir.mkdir(parents=True, exist_ok=True)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    for width in (375, 390, 768, 1024, 1440):
        page = browser.new_page(viewport={"width": width, "height": 900})
        page.goto("http://127.0.0.1:4173/#signup", wait_until="networkidle")
        page.wait_for_selector("form[aria-label='Créer un compte']")
        assert page.locator("input").count() == 5
        assert not page.locator("input[name=privacyAccepted]").is_checked()
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        page.screenshot(path=output_dir / f"signup-{width}.png", full_page=True)
        page.get_by_role("button", name="Créer mon compte").click()
        assert page.locator(".field-error").filter(has_text="Indique ton nom complet.").is_visible()
        password = page.locator("#password")
        page.locator("#password").locator("xpath=..").get_by_role("button").click()
        assert password.get_attribute("type") == "text"
        if width == 375:
            page.screenshot(path=output_dir / "signup-validation-375.png", full_page=True)
        page.get_by_role("button", name="Se connecter").last.click()
        page.wait_for_selector("form[aria-label='Se connecter']")
        page.screenshot(path=output_dir / f"login-{width}.png", full_page=True)
        page.locator("input[name='remember']").check()
        assert page.locator("input[name='remember']").is_checked()
        page.get_by_role("link", name="Mot de passe oublié ?").click()
        page.wait_for_url("**/#forgot-password")
        assert page.get_by_role("heading", name="Mot de passe oublié ?").is_visible()
        page.goto("http://127.0.0.1:4173/#login", wait_until="networkidle")
        page.get_by_role("button", name="Se connecter").first.click()
        assert page.locator(".field-error").filter(has_text="Saisis une adresse e-mail valide.").is_visible()
        page.locator("#password").locator("xpath=..").get_by_role("button").click()
        assert page.locator("#password").get_attribute("type") == "text"
        if width == 375:
            page.screenshot(path=output_dir / "login-validation-375.png", full_page=True)
        page.get_by_role("button", name="Créer un compte").last.click()
        page.wait_for_selector("form[aria-label='Créer un compte']")
        page.close()
    browser.close()
