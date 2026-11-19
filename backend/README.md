# Backend Moni

Le backend PHP/MySQL de Moni a été développé par ma collègue. Je prends en charge son intégration, son audit, sa consolidation et sa publication. L’attribution nominative sera complétée lorsque ses coordonnées officielles seront disponibles.

## Installation et schéma

1. Créer une base MySQL de validation isolée et configurer `MONI_DB_HOST`, `MONI_DB_PORT`, `MONI_DB_NAME`, `MONI_DB_USER` et `MONI_DB_PASSWORD` dans l’environnement d’exécution. Ne pas ajouter de credentials réels au dépôt.
2. Installer le schéma initial avec `schema.sql`.
3. Appliquer les migrations dans l’ordre `001` à `006` depuis un client MySQL connecté à la base de validation. Vérifier `schema_migrations` après exécution.
4. Installer les dépendances PHP depuis ce dossier avec `composer install --no-dev`.

Les migrations sont conçues pour reprendre les opérations DDL déjà effectuées et enregistrent leurs versions. Leur compatibilité doit être vérifiée sur une base jetable avant toute exécution dans un environnement partagé.

## Vérifications

```sh
php -l login.php
php tests/unit/notification_policy_test.php
php tests/unit/push_config_test.php
```

Les scénarios dans `tests/integration/` et `tests/security/` utilisent des garde-fous dans `tests/validation_guard.py`. Ils exigent une instance explicitement configurée comme base de validation; ne pas les pointer vers la production.
