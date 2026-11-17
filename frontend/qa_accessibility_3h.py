from playwright.sync_api import sync_playwright
import subprocess
import time
import re

server = subprocess.Popen(['python', '-m', 'http.server', '4193'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    time.sleep(1)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 390, 'height': 900}, reduced_motion='reduce')
        page.goto('http://127.0.0.1:4193/#transactions')
        assert page.locator('h1').evaluate("node => document.activeElement === node")
        page.get_by_role('button', name='Ajouter une transaction').click()
        page.get_by_role('button', name='Enregistrer').click()
        assert page.locator('[role=alert]').is_visible()
        assert page.locator('input[aria-invalid=true]').count() == 1
        page.get_by_role('button', name='Annuler').click()
        page.on('dialog', lambda dialog: dialog.dismiss())
        page.get_by_role('button', name='Ajouter une transaction').click()
        page.get_by_label('Montant (XOF)').fill('10')
        page.get_by_role('button', name='Enregistrer').click()
        delete_button = page.get_by_role('button', name='Supprimer')
        delete_button.click()
        page.keyboard.press('Escape')
        assert delete_button.evaluate('el => document.activeElement === el')
        assert page.get_by_role('button', name='Supprimer').is_visible()
        page.goto('http://127.0.0.1:4193/#dashboard')
        page.keyboard.press('Tab')
        assert page.locator(':focus-visible').count() > 0
        alerts = page.get_by_role('button', name=re.compile('Notifications'))
        alerts.click()
        assert alerts.get_attribute('aria-expanded') == 'true'
        assert page.locator('#dashboard-notifications').is_visible()
        page.goto('http://127.0.0.1:4193/#settings')
        page.get_by_label('Langue').select_option('en')
        assert page.locator('html').get_attribute('lang') == 'en'
        page.keyboard.press('Tab')
        assert page.locator(':focus-visible').count() > 0
        browser.close()
    print('ACCESSIBILITY_3H_PASS')
finally:
    server.terminate()
    server.wait()
