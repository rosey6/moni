from playwright.sync_api import sync_playwright
import subprocess,time
server=subprocess.Popen(['python','-m','http.server','4177'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 time.sleep(1)
 with sync_playwright() as p:
  b=p.chromium.launch(); page=b.new_page(); page.goto('http://127.0.0.1:4177/')
  page.get_by_role('button',name='Créer un compte').click(); page.locator('#fullName').fill('Awa Test'); page.locator('#email').fill('awa@example.test'); page.locator('#password').fill('demo12345'); page.locator('#confirmPassword').fill('demo12345'); page.get_by_role('button',name='Créer mon compte').click()
  page.get_by_role('button',name='Continuer').click(); page.get_by_label('Mon budget mensuel').fill('1000'); page.get_by_role('button',name='Continuer').click()
  for amount in ['100','100','100','100']:
   page.get_by_label('Montant prévu').fill(amount); page.get_by_role('button',name='Continuer').click()
  page.get_by_role('button',name='Configurer Spotify').click(); page.locator('.calendar-day').filter(has_text='15').click(); page.get_by_label('Montant mensuel (XOF)').fill('25'); page.get_by_label('Compris dans une allocation existante ?').select_option('rent'); page.get_by_role('button',name='Enregistrer').click(); page.get_by_role('button',name='Continuer').click()
  page.wait_for_url('**/#dashboard')
  page.evaluate('''async () => { const {financeState:s}=await import('/src/app/financeState.js'); const d=new Date(); const date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; s.transactions=[{id:'historical-fixture',type:'expense',amount:400,category:'rent',date,description:'Loyer'}]; }''')
  page.get_by_role('button',name='Accueil',exact=True).click(); assert page.get_by_text('Spotify',exact=True).is_visible(); assert page.get_by_text('400',exact=False).count()>0
  page.get_by_role('button',name='Transactions',exact=True).click(); page.get_by_role('button',name='Ajouter une transaction').click(); page.get_by_label('Montant (XOF)').fill('150'); page.get_by_label('Catégorie').select_option('rent'); page.get_by_role('button',name='Enregistrer').click()
  page.get_by_role('button',name='Accueil',exact=True).click(); assert page.get_by_text('150',exact=False).count()>0
  page.get_by_role('button',name='Budgets',exact=True).click()
  assert page.get_by_text('100 %', exact=True).count() > 0
  assert page.evaluate('''async () => { const {financeState:s}=await import('/src/app/financeState.js'); const {summarizeBudgets}=await import('/src/domain/budgets.js'); const d=new Date(); const month=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; const rent=summarizeBudgets(s,month).items.find(item=>item.category==='rent'); return rent.exceeded && rent.linked === 25; }''')
  b.close()
 print('FULL_FLOW_3F_PASS')
finally: server.terminate(); server.wait()
