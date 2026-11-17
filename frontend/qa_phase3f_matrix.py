from playwright.sync_api import sync_playwright
import subprocess,time
from pathlib import Path
server=subprocess.Popen(['python','-m','http.server','4175'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 time.sleep(1)
 with sync_playwright() as p:
  for name in ['chromium','firefox','webkit']:
   try: browser=getattr(p,name).launch(headless=True)
   except Exception as e:
    print(name,'UNAVAILABLE',str(e).splitlines()[0]); continue
   for width in [375,390,768,1024,1440]:
    page=browser.new_page(viewport={'width':width,'height':900},reduced_motion='reduce'); errors=[]; page.on('pageerror',lambda e: errors.append(str(e)))
    for route in ['dashboard','transactions','transaction-edit','budgets','savings','profile','settings']:
     page.goto('http://127.0.0.1:4175/#'+route)
     assert page.locator('h1').count(),(name,width,route)
     assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),(name,width,route)
     if name=='chromium':
      out=Path('artifacts/phase3f'); out.mkdir(parents=True,exist_ok=True); page.screenshot(path=str(out/f'{route}-{width}.png'),full_page=True)
    page.goto('http://127.0.0.1:4175/#savings'); page.get_by_role('button',name='Créer un objectif').click()
    if name=='chromium': page.screenshot(path=str(out/f'goal-edit-{width}.png'),full_page=True)
    assert not errors,(name,width,errors)
    page.close()
   browser.close(); print(name,'PASS 5 largeurs, 8 vues')
finally:
 server.terminate();server.wait()
