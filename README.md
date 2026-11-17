# Moni — frontend et préparation DevOps

Moni est une application de finances personnelles destinée au suivi du budget au quotidien. Elle propose la gestion de budgets, transactions, abonnements, épargne, profil et notifications.

## Contributions

- **Frontend :** consolidation de l’application, tests unitaires et assets.
- **Cybersécurité :** contrôles QA et publication, gestion des secrets hors dépôt.
- **DevOps :** exemples de configuration Nginx et PHP-FPM, à valider avec le backend et l’environnement cible.
- **Backend :** contribution distincte, détenue par sa propriétaire qui choisit la révision officielle; aucun code backend n’est inclus ici.

## Architecture et technologies

Frontend JavaScript en ES modules, CSS, PWA avec manifest et Service Worker. L’application échange des données JSON avec des endpoints PHP sous `/backend/`, via cookies de session et jeton CSRF. L’infrastructure cible Nginx, PHP-FPM et MySQL; worker et scheduler exécutent les notifications. Les fichiers inclus sont des exemples, le Compose complet reste à assembler avec la révision backend officielle.

## Installation locale et tests

Prérequis : Node.js. Depuis `frontend/` :

```sh
npm install
npm run test:unit
```

Les 41 tests unitaires passent sur l’environnement de préparation. Les tests navigateur et appareils ne sont pas inclus dans cette validation.

## Déploiement

Utiliser une révision Git backend explicitement épinglée, communiquée par sa propriétaire. Configurer les secrets uniquement dans l’environnement d’exécution, installer un certificat HTTPS approuvé, puis vérifier routes, CSP, migrations, sauvegardes/restauration, worker, scheduler et healthchecks sur staging avant toute release. Le pool PHP-FPM à 20 workers a été essayé localement en phase précédente; ce réglage n’est pas appliqué automatiquement en production.

## Limites connues

L’intégration avec le SHA officiel backend reste à valider. Compose complet, restauration backup, runtime PWA sous TLS approuvé et réception push réelle restent à tester. Aucune validation physique iOS/Android n’est revendiquée.
