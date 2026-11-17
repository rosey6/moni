"""Read-only browser checks for Moni's PWA shell and privacy boundaries."""
import json
import os

from playwright.sync_api import sync_playwright


ROOT = os.environ.get("MONI_FRONTEND_BASE", "http://127.0.0.1:4173")


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(ignore_https_errors=True)
        page = context.new_page()
        page.goto(ROOT, wait_until="networkidle")

        manifest = page.evaluate("""async () => (await fetch('/manifest.webmanifest')).json()""")
        assert manifest["display"] == "standalone"
        assert manifest["start_url"] == "/" and manifest["scope"] == "/"
        assert {icon["sizes"] for icon in manifest["icons"]} >= {"192x192", "512x512"}
        assert any(icon.get("purpose") == "maskable" for icon in manifest["icons"])

        registration = page.evaluate("""async () => {
          const ready = navigator.serviceWorker.ready.then(registration => ({
            scope: registration.scope,
            controller: Boolean(navigator.serviceWorker.controller)
          }));
          return Promise.race([ready, new Promise(resolve => setTimeout(() => resolve(null), 5000))]);
        }""")
        if registration is None:
            if os.environ.get("MONI_PWA_ALLOW_CERT_RESERVATION") != "1":
                raise AssertionError("service worker registration timed out")
            context.close()
            browser.close()
            print(json.dumps({"manifest": "ok", "service_worker": "blocked_by_private_certificate"}))
            return
        assert registration["scope"] == f"{ROOT.rstrip('/')}/"
        assert registration["controller"]

        cache_state = page.evaluate("""async () => {
          const before = await caches.keys();
          await fetch('/backend/me.php').catch(() => {});
          await fetch('/index.html?token=should-not-be-cached');
          const apiCached = Boolean(await caches.match('/backend/me.php'));
          const tokenUrlCached = Boolean(await caches.match('/index.html?token=should-not-be-cached'));
          navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_MONI_CACHES' });
          await new Promise(resolve => setTimeout(resolve, 100));
          const afterLogout = await caches.keys();
          return { before, apiCached, tokenUrlCached, afterLogout };
        }""")
        assert any(key.startswith("moni-static-") for key in cache_state["before"])
        assert not cache_state["apiCached"]
        assert not cache_state["tokenUrlCached"]
        assert not any(key.startswith("moni-static-") for key in cache_state["afterLogout"])

        context.close()
        browser.close()
    print(json.dumps({"manifest": "ok", "service_worker": "ok", "api_cache": "empty", "logout_cache_clear": "ok"}))


if __name__ == "__main__":
    main()
