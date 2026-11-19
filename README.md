# Moni — frontend et préparation DevOps

Moni est une application de finances personnelles destinée au suivi du budget au quotidien. Elle propose la gestion de budgets, transactions, abonnements, épargne, profil et notifications.

## Contributions

- **Frontend :** consolidation de l’application, tests unitaires et assets.
- **Cybersécurité :** contrôles QA et publication, gestion des secrets hors dépôt.
- **DevOps :** exemples de configuration Nginx et PHP-FPM, à valider avec le backend et l’environnement cible.
- **Backend :** développé par ma collègue. Je prends en charge son intégration, son audit, sa consolidation et sa publication. Son attribution nominative sera complétée avec ses coordonnées officielles.

## Architecture et technologies

Frontend JavaScript en ES modules, CSS, PWA avec manifest et Service Worker. L’application échange des données JSON avec les endpoints PHP sous `/backend/`, via cookies de session et jeton CSRF. Le backend PHP et ses migrations MySQL sont inclus dans `backend/`; voir [son guide](backend/README.md). L’infrastructure cible Nginx, PHP-FPM et MySQL; worker et scheduler exécutent les notifications. Les fichiers de déploiement inclus restent des exemples à valider sur staging.

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

L’intégration frontend/backend a été vérifiée en local et avec une stack VPS de validation jetable; aucune base de production ni aucun déploiement public n’ont été utilisés. Compose complet, restauration backup, runtime PWA sous TLS approuvé et réception push réelle restent à valider. Aucune validation physique iOS/Android n’est revendiquée.
