from pathlib import Path
import subprocess, sys, os

for engine in ('chromium','firefox','webkit'):
    for script in ('qa_full_3f.py','qa_phase3.py','qa_dashboard_3f.py'):
        source=(Path(__file__).resolve().parent / script).read_text(encoding='utf-8-sig').replace('p.chromium.launch(', f'p.{engine}.launch(')
        process=subprocess.run([sys.executable,'-c',source],capture_output=True,text=True,encoding='utf-8',errors='replace')
        print(f'{engine} {script}: {"PASS" if process.returncode == 0 else "FAIL"}',flush=True)
        if process.returncode:
            print(process.stdout[-1000:],process.stderr[-2000:],flush=True)
            raise SystemExit(process.returncode)
print('CROSS_BROWSER_3G_PASS')
