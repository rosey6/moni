from playwright.sync_api import sync_playwright
from pathlib import Path
import subprocess, time
server = subprocess.Popen(['python','-m','http.server','4174'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
 time.sleep(1)
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True)
  page=browser.new_page(viewport={'width':375,'height':900})
  errors=[]
  page.on('pageerror',lambda e: errors.append(str(e)))
  page.goto('http://127.0.0.1:4174/#loading')
  page.wait_for_url('**/#dashboard',timeout=5000)
  page.get_by_role('button',name='Transactions',exact=True).click()
  page.goto('http://127.0.0.1:4174/#dashboard')
  page.evaluate('window.scrollTo(0, 0)')
  page.wait_for_timeout(50)
  page.mouse.wheel(0, 420)
  page.wait_for_timeout(50)
  assert 'is-compact' in page.locator('.finance-nav').get_attribute('class')
  assert page.locator('.finance-nav__item').count() == 5
  assert page.locator('.finance-nav__item .ui-icon svg').count() == 5
  assert page.evaluate("getComputedStyle(document.querySelector('.finance-nav')).width")
  page.mouse.wheel(0, -420)
  page.wait_for_timeout(50)
  assert 'is-compact' not in page.locator('.finance-nav').get_attribute('class')
  page.get_by_role('button',name='Transactions',exact=True).click()
  page.get_by_role('button',name='Ajouter une transaction').click()
  page.get_by_label('Montant (XOF)').fill('100')
  page.get_by_label('Description facultative').fill('Test')
  page.get_by_role('button',name='Enregistrer').click()
  assert page.get_by_text('Test',exact=True).count()==1
  page.get_by_role('button',name='Modifier',exact=True).click()
  page.get_by_label('Montant (XOF)').fill('125')
  page.get_by_role('button',name='Enregistrer').click()
  page.get_by_role('button',name='Budgets',exact=True).click()
  assert page.get_by_text('125',exact=False).count() > 0
  page.get_by_role('button',name='Épargne',exact=True).click()
  page.get_by_role('button',name='Créer un objectif').click()
  page.get_by_label('Nom de l’objectif',exact=True).fill('Voyage')
  page.get_by_label('Montant cible (XOF)').fill('1000')
  page.get_by_label('Date cible').fill('2030-12-31')
  page.get_by_role('button',name='Créer un objectif').click()
  page.get_by_text('Gérer cet objectif', exact=True).first.click()
  page.get_by_label('Ajouter une contribution (XOF)').fill('50')
  page.get_by_role('button',name='Ajouter',exact=True).click()
  assert page.get_by_text('Voyage',exact=True).count()==1
  page.get_by_role('button',name='Profil',exact=True).first.click()
  page.get_by_role('button',name='Modifier',exact=True).click()
  page.get_by_label('Nom',exact=True).fill('Ada')
  page.get_by_label('Adresse e-mail').fill('ada@example.test')
  page.get_by_role('button',name='Enregistrer').click()
  page.get_by_role('button',name='Préférences et paramètres').click()
  page.locator('details.settings-alert-details').evaluate('(element) => { element.open = true; }')
  page.locator('input[aria-label="Dépassements de budget"]').evaluate("element => { element.checked = false; element.dispatchEvent(new Event('change', { bubbles: true })); }")
  page.get_by_role('button',name='Accueil',exact=True).click()
  assert page.get_by_text('Bonjour, Ada !').count()==1
  page.get_by_role('button',name='Transactions',exact=True).click()
  page.on('dialog',lambda d:d.accept())
  page.get_by_role('button',name='Supprimer',exact=True).click()
  assert page.get_by_text('Aucune transaction pour cette sélection.').count()==1
  out=Path('artifacts/phase3'); out.mkdir(parents=True,exist_ok=True)
  for width in [375,390,768,1024,1440]:
   page.set_viewport_size({'width':width,'height':900})
   for route in ['dashboard','transactions','budgets','savings','profile','settings']:
    page.goto('http://127.0.0.1:4174/#'+route)
    page.screenshot(path=str(out / f'{route}-{width}.png'),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (route,width)
  assert not errors, errors
  browser.close()
 print('PHASE3_CHROMIUM_PASS: parcours, 30 captures, 5 largeurs')
finally:
 server.terminate(); server.wait()
