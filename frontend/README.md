# Moni Frontend

Frontend HTML5, CSS3 et modules JavaScript natifs : Bienvenue, authentification et écrans financiers Moni.

## Lancer localement

Depuis `frontend/`, servir le dossier avec n’importe quel serveur statique :

```bash
python -m http.server 4173
```

Puis ouvrir `http://127.0.0.1:4173`.

Le client API utilise `MONI_API_BASE` si cette variable globale est définie. Par défaut, il utilise `http://127.0.0.1:8080` quand le frontend est servi sur le port 4173, sinon `/backend`. Les cookies de session sont envoyés avec `credentials: include`.

## Tests

Gestionnaire frontend officiel : pnpm, car `pnpm-lock.yaml` fixe la version de `lucide`.

Depuis `frontend/`, installer avec `pnpm install --frozen-lockfile`, puis lancer les tests unitaires avec `npm run test:unit` ou `pnpm run test:unit`.

Python et Playwright Chromium pour les tests navigateur :

```powershell
python -m pip install playwright
python -m playwright install chromium
python run_browser_tests.py
```

Le lanceur démarre un serveur temporaire sur 127.0.0.1:4173, exécute onboarding/authentification/Bienvenue, puis l’arrête. Pour l’onboarding seul : `python run_browser_tests.py qa_onboarding.py`.

Routes : `#currency`, `#budget`, `#rent`, `#transport`, `#groceries`, `#unexpected`. Une soumission d’authentification valide ouvre `#currency` en démonstration. À la dernière étape, un message confirme la répartition sans ouvrir les écrans suivants.

Les montants restent des entiers en unités mineures, selon les décimales ISO reconnues par `Intl.NumberFormat`. Le mode `?demo=dashboard` est local et ne sauvegarde rien ; les écrans réels chargent et envoient les données au backend configuré.

Changer de devise après saisie demande de confirmer l’effacement des montants : aucun taux ni conversion implicite. Les drapeaux SVG proviennent de flag-icons (licence MIT jointe dans `public/assets/flags/`).
