from playwright.sync_api import sync_playwright
import subprocess,time
server=subprocess.Popen(['python','-m','http.server','4182'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 time.sleep(1)
 with sync_playwright() as p:
  b=p.chromium.launch(); page=b.new_page(); page.goto('http://127.0.0.1:4182/#settings')
  page.get_by_label('Langue',exact=True).select_option('en')
  page.evaluate("history.pushState({}, '', '#signup'); dispatchEvent(new PopStateEvent('popstate'))")
  assert page.get_by_role('heading',name='Create an account').is_visible()
  page.get_by_role('button',name='Create my account').click(); assert page.get_by_text('Enter your full name.').is_visible()
  page.locator('#fullName').fill('Awa'); page.locator('#email').fill('awa@example.test'); page.locator('#password').fill('password123'); page.locator('#confirmPassword').fill('password123'); page.get_by_role('button',name='Create my account').click()
  assert page.get_by_role('heading',name='Choose your currency').is_visible(); page.get_by_role('button',name='Continue').click()
  assert page.get_by_role('heading',name='What is your budget this month?').is_visible(); page.get_by_label('My monthly budget').fill('1000'); page.get_by_role('button',name='Continue').click()
  assert page.get_by_role('heading',name='How much do you spend on rent?').is_visible()
  for _ in range(4): page.get_by_role('button',name='Skip this step').click()
  assert page.get_by_role('heading',name='What are your subscriptions?').is_visible(); page.get_by_role('button',name='Set up Spotify').click(); assert page.get_by_text('Service name').is_visible(); assert page.get_by_role('button',name='Previous month').is_visible()
  b.close()
 print('EARLY_I18N_PASS')
finally: server.terminate();server.wait()
