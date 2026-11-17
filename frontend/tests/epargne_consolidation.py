from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path(__file__).resolve().parents[1]/'artifacts/epargne-consolidation'
BASE='http://127.0.0.1:4173/index.html#'

def check_footer(dialog, names, height):
 for name in names:
  button=dialog.get_by_role('button',name=name,exact=True)
  box=button.bounding_box()
  assert button.is_visible() and box['y'] >= 0 and box['y']+box['height'] <= height
  colors=button.evaluate('e=>{let s=getComputedStyle(e);return [s.color,s.backgroundColor]}')
  def lum(css):
   import re
   rgb=[int(v)/255 for v in re.findall(r'\d+',css)[:3]]
   c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
   return .2126*c[0]+.7152*c[1]+.0722*c[2]
  a,b=map(lum,colors)
  assert (max(a,b)+.05)/(min(a,b)+.05)>=4.5,(name,colors)

def main():
 OUT.mkdir(parents=True,exist_ok=True)
 with sync_playwright() as p:
  browser=p.chromium.launch()
  for width,height in [(375,667),(390,844),(1440,900)]:
   page=browser.new_page(viewport={'width':width,'height':height},service_workers='block')
   errors=[]
   writes=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   def fake_api(route):
    if route.request.method in ('POST','PUT','PATCH','DELETE'): writes.append(route.request.url)
    route.fulfill(status=200 if route.request.url.endswith('/me.php') else 503,content_type='application/json',body='{"success":true,"data":{}}' if route.request.url.endswith('/me.php') else '{}')
   page.route('**/*.php',fake_api)
   page.goto(BASE+'budgets?demo=dashboard',wait_until='networkidle')
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   for el in page.locator('.budget-stat strong, .budget-row__stat strong').all():
    assert el.evaluate('e=>e.scrollWidth <= e.clientWidth + 1'),(el.inner_text(),el.evaluate('e=>[e.scrollWidth,e.clientWidth]'))
   assert page.locator('.budget-overview').get_by_role('button',name='Modifier le budget').count()==1
   assert page.get_by_role('button',name='Nouveau budget').count()==1
   page.screenshot(path=OUT/f'budgets-{width}x{height}.png',animations='disabled')
   page.get_by_role('button',name='Modifier le budget').click()
   dialog=page.locator('.budget-editor')
   assert dialog.locator('input').input_value()=='250\u202f000'
   check_footer(dialog,('Enregistrer','Annuler'),height)
   assert dialog.locator('.budget-warning').is_hidden()
   if width in (375,390): page.screenshot(path=OUT/f'budget-global-{width}x{height}.png',animations='disabled')
   dialog.locator('input').fill('200000'); assert dialog.locator('.budget-warning').is_visible()
   page.keyboard.press('Escape')
   page.get_by_role('button',name='Modifier Transport').click()
   dialog=page.locator('.budget-envelope-editor')
   assert dialog.locator('input').input_value()=='20\u202f000'
   assert all(int(x) < 100000 for x in dialog.locator('.amount-suggestion').evaluate_all('els=>els.map(e=>e.dataset.amount)'))
   check_footer(dialog,('Enregistrer','Annuler'),height)
   if width in (375,390): page.screenshot(path=OUT/f'budget-enveloppe-{width}x{height}.png',animations='disabled')
   dialog.locator('input').fill('1'); assert dialog.locator('.budget-warning').is_visible()
   page.keyboard.press('Escape')
   page.goto(BASE+'savings?demo=dashboard',wait_until='networkidle')
   assert '85\u202f000' in page.locator('.savings-summary').inner_text()
   assert page.get_by_role('heading',name='Objectifs',exact=True).count()==1
   assert page.get_by_role('heading',name='Épargne libre',level=2,exact=True).count()==1
   assert page.locator('.goal-card').count()==3
   assert page.locator('.goal-card .visual-progress').count()==2
   assert page.locator('.goal-contribute').count()==3
   page.screenshot(path=OUT/f'epargne-{width}x{height}.png',animations='disabled')
   page.get_by_role('button',name='Créer une épargne').click()
   assert page.locator('.savings-type-choice').count()==2
   boxes=page.locator('.savings-type-choice').evaluate_all('es=>es.map(e=>e.getBoundingClientRect().toJSON())')
   assert abs(boxes[0]['top']-boxes[1]['top'])<1 and boxes[0]['right']<=boxes[1]['left']
   for image in page.locator('.savings-type-choice img').all():
    image.evaluate('e=>e.decode()')
    assert image.evaluate('e=>e.complete && e.naturalWidth>0')
   if width==390: page.screenshot(path=OUT/'epargne-choix-390x844.png',animations='disabled')
   page.get_by_role('button',name='Épargne libre').click()
   assert page.locator('.goal-editor input[type=date], .goal-progress-preview, .goal-editor input[aria-label*=cible]').count()==0
   assert 'moni_epargne_libre.png' in page.locator('.savings-editor-banner img').get_attribute('src')
   page.locator('.savings-editor-banner img').evaluate('e=>e.decode()')
   if width==390: page.screenshot(path=OUT/'epargne-libre-390x844.png',animations='disabled')
   page.goto(BASE+'goal-edit?demo=dashboard',wait_until='networkidle')
   assert 'moni_epargne_objectif.png' in page.locator('.savings-editor-banner img').get_attribute('src')
   page.locator('.savings-editor-banner img').evaluate('e=>e.decode()')
   page.locator('.goal-editor input[inputmode=decimal]').first.fill('60000')
   assert page.locator('.goal-progress-preview__percent').inner_text().strip()=='50 %'
   assert page.locator('.goal-progress-preview .visual-progress').evaluate("e=>{const s=getComputedStyle(e,'::after'); return Math.abs(parseFloat(s.width)/e.clientWidth-.5)<.02 && getComputedStyle(e,'::before').content==='none'}")
   if width==390: page.screenshot(path=OUT/'epargne-objectif-390x844.png',animations='disabled')
   page.locator('.goal-editor input[type=date]').fill('')
   page.locator('.goal-editor button[type=submit]').click()
   page.get_by_role('heading',name='Objectifs',exact=True).wait_for()
   assert page.locator('.goal-card').count()==4
   assert not writes
   assert not errors,errors
   print(f'{width}x{height}: PASS')
   page.close()
  import json
  page=browser.new_page(viewport={'width':390,'height':844},service_workers='block')
  state={'onboardingCompleted':True,'currency':'MAD','budget':500000,'allocations':{'rent':100000},'subscriptions':[],'transactions':[]}
  page.route('**/*.php',lambda r:r.fulfill(status=200,content_type='application/json',body=json.dumps({'success':True,'data':{'state':state}})))
  page.goto(BASE+'budgets',wait_until='networkidle')
  page.get_by_role('button',name='Modifier Loyer').click()
  dialog=page.locator('.budget-envelope-editor')
  assert dialog.locator('.amount-suggestion').first.get_attribute('data-amount')=='125000'
  dialog.locator('.amount-suggestion').first.click()
  assert dialog.locator('input').input_value()=='1\u202f250,00'
  assert '1\u202f250,00' in dialog.locator('.budget-editor-preview').inner_text()
  print('Suggestions MAD et aperçu formaté : PASS')
  page.close()
  browser.close()
if __name__=='__main__':main()

