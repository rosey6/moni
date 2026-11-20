# Backend Moni

API PHP/MySQL de Moni, développée initialement par une collègue. Son attribution nominative sera complétée avec son accord.

## Installation

1. Configurer l'environnement à partir de `.env.example` sans versionner de secrets.
2. Installer les dépendances avec `composer install`.
3. Initialiser une base MySQL **locale et isolée** avec `schema.sql`.
4. Appliquer les migrations de `migrations/` dans l'ordre numérique.

## Vérifications

```bash
php -l login.php
php tests/unit/notification_policy_test.php
php tests/unit/push_config_test.php
```

Les tests d'intégration et de sécurité doivent être exécutés uniquement sur l'environnement isolé prévu. Voir le [guide de développement](../docs/development.md).
