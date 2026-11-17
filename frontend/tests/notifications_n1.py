from pathlib import Path
import json
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright
OUT=Path(__file__).resolve().parents[1]/'artifacts/notifications-n1'
BASE='http://127.0.0.1:4173/index.html#'

def main():
 OUT.mkdir(parents=True,exist_ok=True)
 with sync_playwright() as p:
  browser=p.chromium.launch()
  for width,height in [(375,667),(390,844),(1440,900)]:
   page=browser.new_page(viewport={'width':width,'height':height},service_workers='block')
   errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   items=[{'id':'event:budget:demo','type':'budget','title':'Budget transport','text':'Tu as utilisé 80 % de ton budget transport.','destination':'budgets','resourceType':'budget','resourceId':3,'read':False,'createdAt':'2026-11-13T12:00:00Z'},{'id':'event:subscription:demo','type':'subscription','title':'Spotify','text':'Ton abonnement arrive à échéance demain.','destination':'subscriptions-manage','resourceType':'subscription','resourceId':4,'read':False,'createdAt':'2026-11-13T11:00:00Z'},{'id':'legacy:savings:demo','text':'Ton objectif progresse.','read':True,'createdAt':'2026-11-12T18:00:00Z'}]
   profile={'id':1,'name':'Utilisateur Démo','email':'demo@example.test'}
   state={'onboardingCompleted':True,'profile':profile,'currency':'XOF','budget':0,'allocations':{},'subscriptions':[],'transactions':[],'goals':[],'preferences':{'language':'fr','alerts':{'budget':False,'subscriptions':False,'savings':False}}}
   mode={'error':False}
   def api(route):
    req=route.request
    if req.url.endswith('/me.php'): data={'state':state}
    elif '/notifications.php' in req.url:
     if mode['error']: return route.fulfill(status=503,content_type='application/json',body='{"error":{"message":"Erreur simulée"}}')
     if req.method=='PATCH':
      for item in items:
       if req.post_data_json.get('action')=='read_all' or item['id']==req.post_data_json.get('id'): item['read']=True
     query=parse_qs(urlparse(req.url).query)
     selected=[item for item in items if query.get('filter',['all'])[0]!='unread' or not item['read']]
     start=int(query.get('cursor',['0'])[0]); limit=int(query.get('limit',['100'])[0])
     data={'notifications':selected[start:start+limit],'unreadCount':sum(not item['read'] for item in items),'nextCursor':str(start+limit) if start+limit<len(selected) else None}
    else: data={}
    route.fulfill(status=200,content_type='application/json',body=json.dumps({'success':True,'data':data}))
   page.route('**/*.php*',api)
   page.goto(BASE+'dashboard',wait_until='networkidle')
   assert page.get_by_role('button',name='Consulter les alertes (2)').count()==1
   assert page.locator('.notification-trigger .notification-badge').count()==1
   page.get_by_role('button',name='Consulter les alertes (2)').click()
   page.wait_for_selector('.notification-item')
   assert page.locator('.notification-item').count()==3
   assert page.get_by_role('button',name='Budget transport. Tu as utilisé 80 %').count()==1
   assert page.get_by_role('button',name='Marquer comme lue').count()==0
   assert page.get_by_role('button',name='Voir').count()==0
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.screenshot(path=OUT/f'centre-{width}x{height}.png',animations='disabled')
   page.get_by_role('button',name='Non lues (2)',exact=True).click()
   page.wait_for_function("document.querySelectorAll('.notification-item').length===2")
   assert page.locator('.notification-item').count()==2
   mode['error']=True
   page.locator('.notification-item').first.click()
   page.get_by_text('Impossible de marquer les notifications comme lues. Réessaie.').wait_for()
   assert page.locator('.notification-item').count()==2
   mode['error']=False
   row=page.locator('.notification-item').first
   row.focus(); row.press('Enter')
   page.wait_for_function("location.hash==='#budgets'")
   assert items[0]['read']
   page.goto(BASE+'notifications',wait_until='networkidle')
   page.get_by_role('button',name='Non lues (1)',exact=True).click()
   page.get_by_role('button',name='Tout marquer comme lu').click()
   page.get_by_text('Aucune notification non lue.').wait_for()
   page.reload(wait_until='networkidle')
   assert page.locator('.notification-item').count()==3
   assert page.locator('.notification-item__dot:not([hidden])').count()==0
   items.extend({'id':f'other:{i}','text':'Archive','read':True} for i in range(97))
   page.reload(wait_until='networkidle')
   assert page.get_by_role('button',name='Consulter les alertes',exact=True).count()==1
   page.get_by_role('button',name='Afficher plus').click()
   page.wait_for_function("document.querySelectorAll('.notification-item').length===60")
   page.locator('.notification-item').first.click()
   assert '#budgets' in page.url
   mode['error']=True
   page.goto(BASE+'notifications',wait_until='networkidle')
   page.get_by_text('Impossible de charger les notifications.').wait_for()
   mode['error']=False
   page.get_by_role('button',name='Réessayer').click()
   page.wait_for_selector('.notification-item')
   assert not errors,errors
   print(f'{width}x{height}: PASS')
   page.close()
  browser.close()
if __name__=='__main__':main()
