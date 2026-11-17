from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:4173/index.html#'
OUT = Path(__file__).resolve().parents[1] / 'artifacts/dashboard-consolidation-v4'


def check_money(page):
    elements = page.locator('.balance-card__value, .dashboard-metric > div > span, .budget-card__stats strong, .dashboard-allocation > div > span, .due-card__amount, .transaction-amount, .transaction-summary strong, .transaction-row__amount, .transaction-date strong')
    for element in elements.all():
        assert element.evaluate('el => getComputedStyle(el).whiteSpace === "nowrap" && el.scrollWidth <= el.clientWidth + 1'), (element.inner_text(), element.evaluate('el => [el.outerHTML, el.parentElement.outerHTML, el.scrollWidth, el.clientWidth]'))
        assert 'XOF' in element.inner_text(), element.inner_text()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width, height in [(390, 844), (375, 667), (1440, 900)]:
            page = browser.new_page(viewport={'width': width, 'height': height}, service_workers='block')
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.route('**/*.php', lambda route: route.fulfill(status=200 if route.request.url.endswith('/me.php') else 503, content_type='application/json', body='{"success":true,"data":{}}' if route.request.url.endswith('/me.php') else '{}'))
            for screen in ('dashboard', 'transactions'):
                page.goto(BASE + screen + '?demo=dashboard', wait_until='networkidle')
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                assert page.locator('.finance-nav__item').count() == 5
                check_money(page)
                page.screenshot(path=OUT / f'{screen}-{width}x{height}.png', animations='disabled')
                if screen == 'dashboard':
                    assert page.locator('.balance-card').bounding_box()['y'] + page.locator('.balance-card').bounding_box()['height'] <= page.locator('.dashboard-metrics').bounding_box()['y']
                    assert page.locator('.budget-card__legend').count() == 0
                    assert page.get_by_role('button', name='Voir les budgets').count() == 1
                    assert page.locator('.dashboard-allocation').count() == 4
                    page.get_by_role('button', name='Masquer les montants').click()
                    assert '••••' in page.locator('.balance-card__value').inner_text()
                    page.get_by_role('button', name='Afficher les montants').click()
                    if width == 390:
                        page.locator('.finance-content').evaluate('el => el.scrollTop = el.scrollHeight')
                        assert page.locator('.due-card').is_visible() and page.locator('.dashboard-transaction').last.is_visible()
                        page.screenshot(path=OUT / 'dashboard-defilement-390x844.png', animations='disabled')
                else:
                    assert page.locator('.transaction-row').count() == 5
                    page.get_by_role('button', name='Dépenses', exact=True).click()
                    assert page.locator('.transaction-row').count() == 4
                    page.get_by_role('button', name='Toutes', exact=True).click()
                    page.get_by_role('button', name='Rechercher').click()
                    page.get_by_role('searchbox', name='Recherche').fill('Courses')
                    assert page.locator('.transaction-row').count() == 1
                    page.get_by_role('button', name='Ajouter une transaction').click()
                    assert page.locator('.transaction-editor-dialog[open]').count() == 1
                    page.keyboard.press('Escape')
                    assert page.locator('.transaction-editor-dialog[open]').count() == 0
            assert not errors, errors
            print(f'{width}x{height}: PASS')
            page.close()
        browser.close()


if __name__ == '__main__':
    main()



