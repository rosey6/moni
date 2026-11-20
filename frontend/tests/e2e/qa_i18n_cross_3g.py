from pathlib import Path
import subprocess,sys
for engine in ('chromium','firefox','webkit'):
 for script in ('qa_settings_3f.py','qa_i18n_early.py','qa_finance_i18n.py'):
  source=(Path(__file__).resolve().parent / script).read_text(encoding='utf-8-sig').replace('p.chromium.launch(',f'p.{engine}.launch(').replace('playwright.chromium.launch(',f'playwright.{engine}.launch(')
  if script == 'qa_finance_i18n.py': source = source.replace('4190', '4192')
  proc=subprocess.run([sys.executable,'-c',source],capture_output=True,text=True,encoding='utf-8',errors='replace')
  print(f'{engine} {script}: {"PASS" if proc.returncode == 0 else "FAIL"}',flush=True)
  if proc.returncode: print(proc.stdout[-1000:],proc.stderr[-2000:],flush=True); raise SystemExit(proc.returncode)
print('I18N_CROSS_BROWSER_PASS')
