from pathlib import Path
from playwright.sync_api import sync_playwright
OUT = Path(__file__).resolve().parents[1] / 'artifacts/budgets-consolidation'
BASE = 'http://127.0.0.1:4173/index.html#'

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width, height in [(375,667), (390,844), (1440,900)]:
            page = browser.new_page(viewport={'width':width,'height':height},service_workers='block')
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.route('**/*.php',lambda r:r.fulfill(status=200 if r.request.url.endswith('/me.php') else 503,content_type='application/json',body='{"success":true,"data":{}}' if r.request.url.endswith('/me.php') else '{}'))
            page.goto(BASE+'budgets?demo=dashboard',wait_until='networkidle')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            assert page.locator('.budget-row:not(.budget-subscriptions)').count()==4
            assert page.locator('.budget-row:not(.budget-subscriptions) .row-chevron').count()==4
            assert '203' in page.locator('.budget-overview').inner_text()
            assert '47' in page.locator('.budget-overview').inner_text()
            assert '3\u202f000' in page.locator('.budget-subscriptions').inner_text()
            page.screenshot(path=OUT/f'budgets-{width}x{height}.png',animations='disabled')
            page.get_by_role('button',name='Modifier le budget').click()
            dialog=page.locator('.budget-editor')
            assert dialog.locator('.budget-warning').is_hidden()
            if width==390: page.screenshot(path=OUT/'budget-global-390x844.png',animations='disabled')
            dialog.locator('input').first.fill('200000')
            assert dialog.locator('.budget-warning').is_visible()
            dialog.locator('input').first.fill('300000')
            assert dialog.locator('.budget-warning').is_hidden()
            page.keyboard.press('Escape')
            page.get_by_role('button',name='Modifier Transport').click()
            dialog=page.locator('.budget-envelope-editor')
            if width==390: page.screenshot(path=OUT/'budget-enveloppe-390x844.png',animations='disabled')
            dialog.locator('input').fill('1')
            assert dialog.locator('.budget-warning').is_visible()
            dialog.locator('input').fill('25000')
            assert dialog.locator('.budget-warning').is_hidden()
            dialog.locator('input').fill('68000')
            assert dialog.locator('.budget-warning').is_visible()
            page.keyboard.press('Escape')
            page.goto(BASE+'transactions?demo=dashboard',wait_until='networkidle')
            page.get_by_role('button',name='Ajouter une transaction').click()
            editor=page.locator('.transaction-editor-dialog')
            assert editor.locator('.transaction-type-control [data-transaction-type=expense]').evaluate('e => e.classList.contains("is-active")')
            assert editor.locator('input[inputmode=decimal]').input_value().replace('\u202f','')=='12500'
            assert editor.locator('.visual-field__label').first.inner_text()=='Montant'
            if width==375: page.screenshot(path=OUT/'transaction-depense-375x667.png',animations='disabled')
            editor.locator('[data-transaction-type=income]').click()
            assert editor.locator('select').last.input_value()==''
            assert 'communes' in editor.locator('.transaction-category-note').inner_text()
            assert 'Salaire' in editor.locator('input[placeholder]').get_attribute('placeholder')
            if width==375: page.screenshot(path=OUT/'transaction-revenu-375x667.png',animations='disabled')
            editor.locator('.transaction-editor-dialog__body').evaluate('e => e.scrollTop=e.scrollHeight')
            assert editor.get_by_role('button',name='Annuler').is_visible()
            assert editor.get_by_role('button',name='Enregistrer la transaction').is_visible()
            page.keyboard.press('Escape')
            assert not errors, errors
            print(f'{width}x{height} PASS')
            page.close()
        page = browser.new_page(viewport={'width':390,'height':844}, service_workers='block')
        import json
        state = {'onboardingCompleted':True,'currency':'XOF','budget':100000,'allocations':{'rent':40000},'subscriptions':[{'name':'A','amount':5000,'billingDay':5,'includedIn':'rent'},{'name':'B','amount':3000,'billingDay':10,'includedIn':None}],'transactions':[]}
        page.route('**/*.php',lambda r:r.fulfill(status=200,content_type='application/json',body=json.dumps({'success':True,'data':{'state':state}})))
        page.goto(BASE+'budgets',wait_until='networkidle')
        stats=page.locator('.budget-subscriptions .budget-row__stat strong').all_inner_texts()
        assert ['8\u202f000', '5\u202f000', '3\u202f000'] == [text.split('\u00a0')[0] for text in stats], stats
        assert '43\u202f000' in page.locator('.budget-overview').inner_text()
        page.get_by_role('button',name='Gérer les abonnements').click()
        assert 'subscriptions-manage' in page.url
        print('Abonnements liés et non liés : PASS')
        page.close()
        browser.close()
if __name__ == '__main__': main()

