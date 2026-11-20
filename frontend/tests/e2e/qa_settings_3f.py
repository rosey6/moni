from playwright.sync_api import sync_playwright
import subprocess,time
server=subprocess.Popen(['python','-m','http.server','4176'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 time.sleep(1)
 with sync_playwright() as p:
  b=p.chromium.launch(); page=b.new_page(); page.goto('http://127.0.0.1:4176/#transactions')
  page.get_by_role('button',name='Ajouter une transaction').click(); page.get_by_label('Montant (XOF)').fill('123'); page.get_by_role('button',name='Enregistrer').click()
  page.get_by_role('button',name='Modifier',exact=True).click()
  page.get_by_role('button',name='Profil',exact=True).first.click(); page.get_by_role('button',name='Préférences et paramètres').click()
  page.on('dialog',lambda d:d.accept())
  page.get_by_label('Devise',exact=True).select_option('EUR'); page.evaluate("history.pushState({}, '', '#transaction-edit'); dispatchEvent(new PopStateEvent('popstate'))"); assert page.url.endswith('#transactions'); page.get_by_role('button',name='Transactions',exact=True).click(); assert page.get_by_text('Aucune transaction pour cette sélection.').is_visible()
  page.get_by_role('button',name='Profil',exact=True).first.click(); page.get_by_role('button',name='Préférences et paramètres').click(); page.get_by_label('Devise',exact=True).select_option('XOF')
  page.get_by_role('button',name='Transactions',exact=True).click(); assert page.get_by_text('123',exact=False).count()>0
  page.get_by_role('button',name='Profil',exact=True).first.click(); page.get_by_role('button',name='Préférences et paramètres').click(); page.get_by_label('Langue',exact=True).select_option('en')
  assert page.locator('html').get_attribute('lang')=='en'; assert page.get_by_role('heading',name='Settings').is_visible(); assert page.get_by_label('Currency').is_visible()
  page.get_by_role('button',name='Transactions',exact=True).click(); assert page.locator('html').get_attribute('lang')=='en'; assert page.get_by_role('heading',name='Transactions').is_visible(); assert page.get_by_role('button',name='Add transaction').is_visible()
  b.close()
 print('SETTINGS_3F_PASS')
finally: server.terminate();server.wait()
