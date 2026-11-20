# Frontend Moni

Application HTML5, CSS3 et JavaScript natif, compatible PWA.

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm run test:unit
python -m http.server 4173 --bind 127.0.0.1
```

Ouvrir http://127.0.0.1:4173.

Pour les tests navigateur, installer Python Playwright et Chromium, puis exécuter :

```bash
python -m pip install playwright
python -m playwright install chromium
python run_browser_tests.py
```

Les scripts QA se trouvent dans `tests/e2e/`. Voir le [guide de développement](../docs/development.md) pour configurer l'API.
