"""Verify local assets do not trigger CSP blocks in the rendered frontend."""
import os

from playwright.sync_api import sync_playwright


BASE = os.environ.get("MONI_FRONTEND_BASE", "http://127.0.0.1:4173")
VIEWPORTS = [375, 390, 768, 1024, 1440]


def check_route(page, route):
    violations = []
    page.on("console", lambda message: violations.append(message.text) if "Content Security Policy" in message.text else None)
    page.goto(f"{BASE}/#{route}", wait_until="commit", timeout=10000)
    page.wait_for_timeout(1000)
    assert page.locator("img[src^='http://'], img[src^='https://']").count() == 0
    assert not violations, violations


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": VIEWPORTS[0], "height": 900}, ignore_https_errors=True)
        page = context.new_page()
        for width in VIEWPORTS:
            page.set_viewport_size({"width": width, "height": 900})
            check_route(page, "currency")
            check_route(page, "subscriptions")
        context.close()
        browser.close()
    print(f"CSP local validation passed at widths: {', '.join(map(str, VIEWPORTS))}")


if __name__ == "__main__":
    main()
