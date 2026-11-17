from pathlib import Path
import json
from playwright.sync_api import sync_playwright
OUT = Path(__file__).resolve().parents[1] / 'artifacts/transactions-consolidation'
BASE = 'http://127.0.0.1:4173/index.html#transactions?demo=dashboard'

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width, height in [(375,667),(390,844),(1440,900)]:
            page = browser.new_page(viewport={'width':width,'height':height}, service_workers='block')
            errors=[]
            page.on('pageerror',lambda error: errors.append(str(error)))
            page.route('**/*.php', lambda route: route.fulfill(status=200 if route.request.url.endswith('/me.php') else 503, content_type='application/json', body='{"success":true,"data":{}}' if route.request.url.endswith('/me.php') else '{}'))
            page.goto(BASE,wait_until='networkidle')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            assert page.locator('.transaction-day').count() == 3
            assert page.locator('.transaction-row').count() == 5
            assert page.locator('.transaction-period > summary').inner_text() == 'Toutes les périodes', repr(page.locator('.transaction-period > summary').inner_text())
            page.locator('.transaction-period > summary').click()
            page.get_by_label('Mois').fill('2026-11')
            assert page.locator('.transaction-period > summary').inner_text() == 'novembre 2026'
            assert page.locator('.transaction-row').count() == 5
            assert '123\u202f500' in page.locator('.transaction-summary > span').last.inner_text()
            page.screenshot(path=OUT / f'transactions-{width}x{height}.png', animations='disabled')
            page.locator('.transaction-period > summary').click()
            page.get_by_label('Mois').fill('2026-10')
            assert page.locator('.transaction-period > summary').inner_text() == 'octobre 2026'
            assert page.locator('.transaction-row').count() == 0
            assert all('0' in text for text in page.locator('.transaction-summary strong').all_inner_texts())
            page.locator('.transaction-period > summary').click()
            page.get_by_label('Mois').fill('2026-11')
            page.get_by_role('button',name='Dépenses',exact=True).click()
            assert page.locator('.transaction-row').count()==4
            page.get_by_role('button',name='Toutes',exact=True).click()
            page.get_by_role('button',name='Rechercher').click()
            page.get_by_role('searchbox',name='Recherche').fill('Courses')
            assert page.locator('.transaction-row').count()==1
            page.get_by_role('searchbox',name='Recherche').fill('')
            page.get_by_role('button',name='Ajouter une transaction').click()
            assert page.locator('.transaction-editor-dialog[open]').count()==1
            if width==390:
                page.screenshot(path=OUT / 'panneau-depense-390x844.png',animations='disabled')
                page.locator('[data-transaction-type="income"]').click()
                assert page.locator('[data-transaction-type="income"]').evaluate('el => el.classList.contains("is-active")')
                page.screenshot(path=OUT / 'panneau-revenu-390x844.png',animations='disabled')
            page.keyboard.press('Escape')
            assert page.locator('.transaction-editor-dialog[open]').count()==0
            assert not errors, errors
            print(f'{width}x{height} PASS')
            page.close()
        page = browser.new_page(viewport={'width':390,'height':844}, service_workers='block')
        entry = {'id':'one', 'type':'expense', 'amount':12000, 'category':'transport', 'date':'2026-11-12', 'description':'Bus'}
        state = {'onboardingCompleted':True, 'currency':'XOF', 'transactions':[entry]}
        def api(route):
            request = route.request
            if request.url.endswith('/me.php'):
                data = {'state':state}
            elif 'transactions.php' in request.url and request.method == 'PATCH':
                state['transactions'] = [request.post_data_json]
                data = {'state':state}
            elif 'transactions.php' in request.url and request.method == 'POST':
                state['transactions'] = [request.post_data_json]
                data = {'state':state}
            else:
                data = {}
            route.fulfill(status=200, content_type='application/json', body=json.dumps({'success':True,'data':data}))
        page.route('**/*.php*', api)
        page.goto('http://127.0.0.1:4173/index.html#transactions', wait_until='networkidle')
        page.locator('.transaction-row__actions summary').click()
        page.get_by_role('button',name='Modifier',exact=True).click()
        assert page.locator('.transaction-editor-dialog[open]').count() == 1
        page.locator('.transaction-editor input[inputmode=decimal]').fill('15000')
        page.get_by_role('button',name='Enregistrer la transaction').click()
        page.wait_for_selector('.transaction-editor-dialog[open]', state='hidden')
        assert '15\u202f000' in page.locator('.transaction-row__amount').inner_text()
        page.on('dialog', lambda dialog: dialog.accept())
        page.locator('.transaction-row__actions summary').click()
        page.get_by_role('button',name='Supprimer',exact=True).click()
        assert page.locator('.transaction-row').count() == 0
        page.get_by_role('button',name='Ajouter une transaction').click()
        page.locator('.transaction-editor input[inputmode=decimal]').fill('9000')
        page.locator('.transaction-editor select').last.select_option('transport')
        page.locator('.transaction-editor input[type=date]').fill('2026-11-12')
        page.get_by_role('button',name='Enregistrer la transaction').click()
        page.wait_for_selector('.transaction-editor-dialog[open]', state='hidden')
        assert '9\u202f000' in page.locator('.transaction-row__amount').inner_text()
        print('CRUD simulé : création, modification et suppression PASS')
        page.close()
        state.update(currency='EUR', transactions=[{**entry, 'amount':123450}])
        page = browser.new_page(viewport={'width':390,'height':844}, service_workers='block')
        page.route('**/*.php*', api)
        page.goto('http://127.0.0.1:4173/index.html#transactions', wait_until='networkidle')
        page.locator('.transaction-row__actions summary').click()
        page.get_by_role('button',name='Modifier',exact=True).click()
        assert page.locator('.transaction-editor input[inputmode=decimal]').input_value() == '1\u202f234,50'
        page.get_by_role('button',name='Enregistrer la transaction').click()
        page.wait_for_selector('.transaction-editor-dialog[open]', state='hidden')
        assert state['transactions'][0]['amount'] == 123450
        print('Format EUR et précision conservée : PASS')
        page.close()
        browser.close()
if __name__ == '__main__': main()

