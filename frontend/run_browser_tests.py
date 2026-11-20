import socket
import subprocess
import sys
import time
from pathlib import Path

root = Path(__file__).resolve().parent
qa_dir = root / 'tests' / 'e2e'
server = subprocess.Popen([sys.executable, '-m', 'http.server', '4173', '--bind', '127.0.0.1'], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for attempt in range(50):
        if server.poll() is not None:
            raise RuntimeError('Impossible de démarrer le serveur de test.')
        try:
            with socket.create_connection(('127.0.0.1', 4173), timeout=0.2):
                break
        except OSError:
            time.sleep(0.1)
    for script in sys.argv[1:] or ['qa_subscriptions.py', 'qa_onboarding.py', 'qa_auth.py', 'qa_welcome.py']:
        target = (qa_dir / Path(script).name).resolve()
        if target.parent != qa_dir.resolve() or not target.is_file():
            raise ValueError(f'Scénario QA inconnu : {script}')
        subprocess.run([sys.executable, '-u', str(target)], cwd=root, check=True)
finally:
    server.terminate()
    server.wait(timeout=10)
