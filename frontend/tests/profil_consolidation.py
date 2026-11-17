from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path(__file__).resolve().parents[1]/'artifacts/profil-consolidation'
BASE='http://127.0.0.1:4173/index.html#'

def main():
 OUT.mkdir(parents=True,exist_ok=True)
 with sync_playwright() as p:
  browser=p.chromium.launch()
  for width,height in [(375,667),(390,844),(1440,900)]:
   page=browser.new_page(viewport={'width':width,'height':height},service_workers='block')
   errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.route('**/*.php',lambda r:r.fulfill(status=200 if r.request.url.endswith('/me.php') else 503,content_type='application/json',body='{"success":true,"data":{}}' if r.request.url.endswith('/me.php') else '{}'))
   for route in ('profile','settings','privacy'):
    page.goto(BASE+route+'?demo=dashboard',wait_until='networkidle')
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert page.locator('.finance-nav__item').count()==5
    if route=='profile':
     assert page.locator('.profile-avatar').inner_text()=='UD'
     assert page.get_by_role('button',name='Modifier',exact=True).count()==1
     for label in ('Paramètres','Abonnements','Sécurité et confidentialité','À propos'): assert page.get_by_role('button',name=label,exact=True).count()==1
     assert page.get_by_role('button',name='Gérer les notifications').count()==0
    elif route=='settings':
     assert page.get_by_role('combobox',name='Langue').count()==1
     assert page.get_by_role('combobox',name='Devise').count()==1
     assert page.locator('.settings-card--alerts input[type=checkbox]').count()==4
     for label in ('Notifications internes','Rappels d’abonnements','Alertes de budget','Alertes d’épargne'):
      assert page.get_by_role('checkbox',name=label).count()==1
     assert page.get_by_text('Apparence',exact=True).count()==0
    else:
     for label in ('Sécurité','Confidentialité','Données personnelles'): assert page.get_by_role('heading',name=label,exact=True).count()==1
     assert 'doit encore être publiée' in page.locator('.privacy-policy-notice').inner_text()
    page.screenshot(path=OUT/f'{route}-{width}x{height}.png',animations='disabled')
   page.goto(BASE+'profile?demo=dashboard',wait_until='networkidle')
   edit=page.get_by_role('button',name='Modifier',exact=True)
   edit.click()
   assert page.locator('.profile-edit[open]').count()==1
   assert page.evaluate('document.activeElement.getAttribute("aria-label")')=='Nom'
   if width==390: page.screenshot(path=OUT/'profil-edition-390x844.png',animations='disabled')
   page.locator('.profile-form input').first.fill('Alex Demo')
   page.get_by_role('button',name='Enregistrer',exact=True).click()
   assert page.locator('.profile-avatar').inner_text()=='AD'
   page.get_by_role('button',name='À propos',exact=True).click()
   assert page.get_by_role('heading',name='À propos de Moni').is_visible()
   page.keyboard.press('Escape')
   page.get_by_role('button',name='Se déconnecter',exact=True).click()
   assert page.get_by_role('heading',name='Se déconnecter ?').is_visible()
   if width==390: page.screenshot(path=OUT/'profil-deconnexion-390x844.png',animations='disabled')
   page.get_by_role('button',name='Annuler',exact=True).click()
   assert page.get_by_role('heading',name='Profil',exact=True).is_visible()
   page.goto(BASE+'privacy?demo=dashboard',wait_until='networkidle')
   page.get_by_role('button',name='Réinitialiser mon mot de passe').click()
   assert 'forgot-password' in page.url
   assert not errors,errors
   print(f'{width}x{height}: PASS')
   page.close()
  import json
  page=browser.new_page(viewport={'width':390,'height':844},service_workers='block')
  state={'onboardingCompleted':True,'currency':'XOF','profile':{'name':'Alex Demo','email':'alex@example.test'},'preferences':{'language':'fr','alerts':{'budget':True,'subscriptions':True,'savings':True}}}
  calls=[]
  fail=[True]
  def api(route):
   request=route.request
   if request.url.endswith('/me.php'):
    return route.fulfill(status=200,content_type='application/json',body=json.dumps({'success':True,'data':{'state':state}}))
   if request.url.endswith('/profile.php'):
    calls.append(request.post_data_json)
    if fail[0]: return route.fulfill(status=503,content_type='application/json',body='{"error":{"message":"Erreur simulée"}}')
    state['preferences']['alerts']=request.post_data_json['alerts']
    return route.fulfill(status=200,content_type='application/json',body=json.dumps({'success':True,'data':{'state':state}}))
   if request.url.endswith('/logout.php'): calls.append('logout')
   return route.fulfill(status=200,content_type='application/json',body='{"success":true,"data":{}}')
  page.route('**/*.php',api)
  page.goto(BASE+'settings',wait_until='networkidle')
  checkbox=page.get_by_role('checkbox',name='Notifications')
  checkbox.uncheck()
  page.locator('.settings-status').wait_for(state='visible')
  assert checkbox.is_checked() and 'Erreur simulée' in page.locator('.settings-status').inner_text()
  assert calls[-1]['alerts']=={'budget':False,'subscriptions':False,'savings':False}
  page.goto(BASE+'profile',wait_until='networkidle')
  page.get_by_role('button',name='Modifier',exact=True).click()
  page.locator('.profile-form input').first.fill('Nouveau nom')
  page.get_by_role('button',name='Enregistrer',exact=True).click()
  page.wait_for_function("document.querySelector('.profile-form [role=status]').textContent.includes('Erreur simulée')")
  assert 'Erreur simulée' in page.locator('.profile-form [role=status]').inner_text()
  assert page.locator('.profile-avatar').inner_text()=='AD'
  fail[0]=False
  page.goto(BASE+'settings',wait_until='networkidle')
  checkbox=page.get_by_role('checkbox',name='Notifications')
  with page.expect_response('**/profile.php'):
   checkbox.uncheck()
  assert state['preferences']['alerts']['budget'] is False
  state['preferences']['alerts']={'budget':True,'subscriptions':False,'savings':True}
  fail[0]=True
  page.reload(wait_until='networkidle')
  checkbox=page.get_by_role('checkbox',name='Notifications')
  assert checkbox.evaluate('e=>e.indeterminate')
  assert 'Certaines alertes' in page.locator('.settings-global-alert > .settings-global-alert__copy').inner_text()
  checkbox.click()
  page.wait_for_function("document.querySelector('.settings-status').textContent.includes('Erreur simulée')")
  assert checkbox.evaluate('e=>e.indeterminate')
  assert calls[-1]['alerts']=={'budget':True,'subscriptions':True,'savings':True}
  fail[0]=False
  with page.expect_response('**/profile.php'):
   checkbox.click()
  assert state['preferences']['alerts']=={'budget':True,'subscriptions':True,'savings':True}
  with page.expect_response('**/profile.php'):
   page.get_by_role('checkbox',name='Alertes de budget').uncheck()
  assert state['preferences']['alerts']=={'budget':False,'subscriptions':True,'savings':True}
  page.goto(BASE+'profile',wait_until='networkidle')
  page.get_by_role('button',name='Se déconnecter',exact=True).click()
  page.locator('.profile-confirm[open]').get_by_role('button',name='Se déconnecter',exact=True).click()
  page.wait_for_function("!location.hash")
  page.wait_for_timeout(100)
  assert 'logout' in calls
  print('Préférences et profil : erreurs serveur restaurées')
  page.close()
  browser.close()
if __name__=='__main__':main()
