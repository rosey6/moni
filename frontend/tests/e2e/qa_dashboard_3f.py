from playwright.sync_api import sync_playwright
import subprocess, time
server = subprocess.Popen(['python','-m','http.server','4185'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    time.sleep(1)
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page()
        errors=[]
        page.on('pageerror',lambda e: errors.append(str(e)))
        page.goto('http://127.0.0.1:4185/#dashboard')
        page.evaluate('''async () => { const {financeState:s}=await import('/src/app/financeState.js'); let d=new Date(); let date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; s.transactions=[{id:'1',type:'expense',amount:12345,category:'rent',date,description:'Loyer'}]; s.allocations.rent=100; s.subscriptions=[{name:'Service',amount:1,billingDay:d.getDate(),includedIn:null}]; s.goals=[{id:'g',name:'Projet',target:100,date:'2030-12-31',contributions:[{id:'c',amount:100}]}]; }''')
        page.get_by_role('button',name='Accueil',exact=True).click()
        page.get_by_role('button',name='Notifications (3 non lue(s))').click()
        assert page.get_by_text('Objectif atteint : Projet.',exact=False).is_visible()
        page.get_by_role('button',name='Marquer comme lue',exact=False).first.click()
        assert page.get_by_role('button',name='Notifications (2 non lue(s))').is_visible()
        page.get_by_role('button',name='Masquer les montants').click()
        assert page.get_by_role('button',name='Afficher les montants').get_attribute('aria-pressed') == 'true'
        assert page.get_by_text('Graphique masqué').is_visible()
        assert page.locator('.budget-card .budget-ring').count() == 0
        assert '12\u202f345' not in page.locator('main.finance-content').inner_text()
        page.get_by_role('button',name='Afficher les montants').click()
        assert page.locator('.budget-card .budget-ring').count() == 1
        assert not errors,errors
        browser.close()
    print('DASHBOARD_3F_PASS')
finally:
    server.terminate(); server.wait()
