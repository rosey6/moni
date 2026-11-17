from playwright.sync_api import sync_playwright
import subprocess,time
server=subprocess.Popen(['python','-m','http.server','4190'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 time.sleep(1)
 with sync_playwright() as p:
  b=p.chromium.launch(); page=b.new_page(); page.goto('http://127.0.0.1:4190/#settings')
  page.get_by_label('Langue').select_option('en')
  page.get_by_role('button',name='Home',exact=True).click(); assert page.get_by_role('heading',name='Hello !').is_visible(); assert page.get_by_text('Bank balance').is_visible()
  page.get_by_role('button',name='Transactions',exact=True).click(); page.get_by_role('button',name='Add transaction').click(); page.get_by_label('Amount (XOF)').fill('15'); page.get_by_label('Category').select_option('rent'); page.get_by_role('button',name='Save').click(); page.get_by_label('Search').fill('Rent'); assert page.get_by_text('Rent · Expense',exact=False).is_visible()
  page.get_by_role('button',name='Budgets',exact=True).click(); assert page.get_by_text('Spent this month:',exact=False).count()>0
  page.get_by_role('button',name='Savings',exact=True).click(); page.get_by_role('button',name='Create a goal').click(); assert page.get_by_label('Target date').is_visible()
  b.close()
 print('FINANCE_I18N_EN_PASS')
finally: server.terminate();server.wait()
