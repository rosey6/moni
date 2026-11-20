# Développement Moni

## Prérequis

Node.js, pnpm, PHP avec Composer, MySQL. Pour les tests navigateur : Python et Playwright.

## Frontend

Depuis `frontend/` :

```bash
pnpm install --frozen-lockfile
pnpm run test:unit
python -m http.server 4173 --bind 127.0.0.1
```

Ouvrir http://127.0.0.1:4173. Sur ce port, le client vise par défaut `http://127.0.0.1:8080`; ailleurs, `/backend`. La variable globale `MONI_API_BASE` peut surcharger cette base. Les appels API utilisent des cookies de session et des jetons CSRF.

## Backend

Préparer une base MySQL de développement isolée selon `backend/.env.example`, puis initialiser `backend/schema.sql` et appliquer les migrations numérotées de `backend/migrations/` dans l'ordre. Installer les dépendances avec `composer install` depuis `backend/`. Vérifier les migrations sur une base jetable avant toute exécution partagée.

## Tests navigateur

Depuis `frontend/` :

```bash
python -m pip install playwright
python -m playwright install chromium
python run_browser_tests.py
```

Pour un scénario précis : `python run_browser_tests.py qa_onboarding.py`.

Les scénarios QA sont dans `frontend/tests/e2e/`, les tests unitaires dans `frontend/tests/unit/`, les tests complémentaires dans `frontend/tests/`. Les captures et rapports générés restent hors Git.

Les tests d'intégration backend exigent un environnement isolé selon `backend/tests/validation_guard.py`. Ne jamais les exécuter sur la base de production.

## Déploiement

Les configurations de `deployment/` sont des exemples. Avant mise en ligne, vérifier les secrets, permissions, HTTPS, migrations, sauvegardes, restauration et Service Worker.
