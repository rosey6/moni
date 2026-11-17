from pathlib import Path
import json
from playwright.sync_api import sync_playwright
OUT=Path(__file__).resolve().parents[1]/'artifacts/notifications-n1'
BASE='http://127.0.0.1:4173/index.html#dashboard'
INIT='''(() => {
  window.__permissionCalls=0; window.__subscribeCalls=0;
  window.Notification=class { static permission=sessionStorage.getItem('testPermission')||'default'; static requestPermission(){window.__permissionCalls++; return Promise.resolve(window.__decision||'granted').then(v=>{this.permission=v;sessionStorage.setItem('testPermission',v);return v})} };
  window.PushManager=class {};
  const subscription={toJSON:()=>({endpoint:'https://push.example.test/token',keys:{p256dh:'test',auth:'test'}}),unsubscribe:async()=>true};
  const registration={pushManager:{getSubscription:async()=>null,subscribe:async()=>{window.__subscribeCalls++;return subscription}}};
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{ready:Promise.resolve(registration),register:async()=>registration}});
})()'''

def main():
 OUT.mkdir(parents=True,exist_ok=True)
 with sync_playwright() as p:
  browser=p.chromium.launch()
  for mode in ('deny','error','ios','unsupported','disabled'):
   page=browser.new_page(viewport={'width':390,'height':844})
   page.add_init_script(INIT)
   if mode=='ios': page.add_init_script("Object.defineProperty(navigator,'userAgent',{get:()=> 'iPhone'});")
   if mode=='deny': page.add_init_script("window.__decision='denied';")
   if mode=='unsupported': page.add_init_script("delete window.PushManager;")
   state={'onboardingCompleted':True,'profile':{'id':42,'name':'Test','email':'test@example.test'},'currency':'XOF','budget':0,'allocations':{},'subscriptions':[],'transactions':[],'goals':[],'preferences':{'language':'fr','alerts':{'budget':False,'subscriptions':False,'savings':False}}}
   writes=[]
   def api(route):
    req=route.request
    if '/me.php' in req.url: data={'state':state}
    elif '/push-config.php' in req.url: data={'enabled':mode!='disabled','publicKey':'A'*87}
    elif '/push-subscriptions.php' in req.url:
     writes.append(req.post_data_json)
     if mode=='error': return route.fulfill(status=503,content_type='application/json',body='{"error":{"message":"indisponible"}}')
     data={'deviceId':'fixture'}
    else: data={'notifications':[], 'unreadCount':0, 'nextCursor':None}
    route.fulfill(status=200,content_type='application/json',body=json.dumps({'success':True,'data':data}))
   page.route('**/*.php*',api)
   page.goto(BASE,wait_until='networkidle')
   if mode=='disabled':
    assert page.locator('.push-activation').count()==0
    assert page.evaluate('window.__permissionCalls')==0
    print(mode+': PASS');page.close();continue
   dialog=page.locator('.push-activation[open]');dialog.wait_for()
   bell=dialog.locator('img.push-activation__bell')
   bell.wait_for()
   assert bell.evaluate('el=>el.complete && el.naturalWidth>0 && el.naturalHeight>0')
   assert bell.evaluate('el=>Math.abs(el.getBoundingClientRect().width/el.getBoundingClientRect().height-el.naturalWidth/el.naturalHeight)<0.02')
   assert page.get_by_role('link',name='Plus tard').count()==1
   assert page.evaluate('window.__permissionCalls')==0
   if mode=='ios':
    assert 'écran d’accueil' in dialog.inner_text()
    assert dialog.get_by_role('button',name='Activer les notifications').count()==0
   elif mode=='unsupported':
    assert 'pas disponibles sur cet appareil' in dialog.inner_text()
    assert dialog.get_by_role('button',name='Activer les notifications').count()==0
   else:
    if mode=='error':
     page.screenshot(path=OUT/'popup-activation-simule-390x844.png',animations='disabled')
     page.set_viewport_size({'width':1440,'height':900})
     assert bell.is_visible() and bell.evaluate('el=>el.naturalWidth>0')
     page.screenshot(path=OUT/'popup-activation-simule-1440x900.png',animations='disabled')
    dialog.get_by_role('button',name='Activer les notifications').click()
    if mode=='deny':
     dialog.get_by_text('Autorisation non accordée.').wait_for()
     assert len(writes)==0 and dialog.get_by_role('button',name='Activer les notifications').count()==0
     page.reload(wait_until='networkidle')
     assert page.locator('.push-activation[open]').count()==0
    else:
     dialog.get_by_text('Activation impossible. Réessaie plus tard.').wait_for()
     assert len(writes)==1 and page.evaluate('window.__subscribeCalls')==1
    assert page.get_by_text('Notifications activées sur cet appareil.').count()==0
   print(mode+': PASS')
   page.close()
  browser.close()
if __name__=='__main__':main()
