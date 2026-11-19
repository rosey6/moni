CREATE DATABASE IF NOT EXISTS moni CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE moni;

CREATE TABLE IF NOT EXISTS utilisateurs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(80) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    `mot de passe` VARCHAR(255) NOT NULL,
    solde_initial BIGINT UNSIGNED NOT NULL DEFAULT 0,
    devise CHAR(3) NOT NULL DEFAULT 'XOF',
    budget_mensuel BIGINT UNSIGNED NOT NULL DEFAULT 0,
    langue CHAR(2) NOT NULL DEFAULT 'fr',
    preferences_json JSON NULL,
    session_version INT UNSIGNED NOT NULL DEFAULT 1,
    privacy_policy_version VARCHAR(64) NULL,
    privacy_accepted_at DATETIME(6) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id BIGINT UNSIGNED NOT NULL,
    token_hash BINARY(32) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_password_reset_token (token_hash),
    KEY ix_password_reset_user (utilisateur_id, expires_at),
    CONSTRAINT fk_password_reset_user FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id BIGINT UNSIGNED NOT NULL,
    notification_key VARCHAR(191) NOT NULL,
    message VARCHAR(500) NOT NULL,
    read_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_notification_user_key (utilisateur_id, notification_key),
    KEY ix_notifications_user (utilisateur_id, read_at),
    CONSTRAINT fk_notification_user FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
    id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(32) NOT NULL UNIQUE,
    nom VARCHAR(80) NOT NULL
) ENGINE=InnoDB;

INSERT INTO categories (slug, nom) VALUES
    ('rent', 'Loyer'), ('transport', 'Transport'), ('groceries', 'Courses'), ('unexpected', 'Imprévus'),
    ('salary', 'Salaire'), ('scholarship', 'Bourse d’études'), ('family_support', 'Aide familiale'), ('freelance', 'Freelance'), ('other_income', 'Autres revenus')
ON DUPLICATE KEY UPDATE nom = VALUES(nom);

CREATE TABLE IF NOT EXISTS budgets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id BIGINT UNSIGNED NOT NULL,
    categorie_id SMALLINT UNSIGNED NOT NULL,
    montant_limite BIGINT UNSIGNED NOT NULL DEFAULT 0,
    mois TINYINT UNSIGNED NOT NULL,
    annee SMALLINT UNSIGNED NOT NULL,
    UNIQUE KEY uq_budget_period (utilisateur_id, categorie_id, mois, annee),
    CONSTRAINT fk_budget_user FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
    CONSTRAINT fk_budget_category FOREIGN KEY (categorie_id) REFERENCES categories(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transactions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id BIGINT UNSIGNED NOT NULL,
    type ENUM('expense', 'income') NOT NULL,
    montant BIGINT UNSIGNED NOT NULL,
    categorie_id SMALLINT UNSIGNED NOT NULL,
    date_operation DATE NOT NULL,
    description VARCHAR(200) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY ix_transactions_user_date (utilisateur_id, date_operation),
    CONSTRAINT fk_transaction_user FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
    CONSTRAINT fk_transaction_category FOREIGN KEY (categorie_id) REFERENCES categories(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS abonnements (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id BIGINT UNSIGNED NOT NULL,
    nom VARCHAR(80) NOT NULL,
    montant_mensuel BIGINT UNSIGNED NOT NULL,
    jour_facturation TINYINT UNSIGNED NOT NULL,
    categorie_id SMALLINT UNSIGNED NULL,
    UNIQUE KEY uq_subscription_name (utilisateur_id, nom),
    CONSTRAINT fk_subscription_user FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
    CONSTRAINT fk_subscription_category FOREIGN KEY (categorie_id) REFERENCES categories(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS objectifs_epargne (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id BIGINT UNSIGNED NOT NULL,
    nom VARCHAR(80) NOT NULL,
    mode VARCHAR(10) NOT NULL DEFAULT 'goal',
    montant_cible BIGINT UNSIGNED NULL,
    date_cible DATE NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_goal_user FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS contributions_epargne (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    objectif_id BIGINT UNSIGNED NOT NULL,
    utilisateur_id BIGINT UNSIGNED NOT NULL,
    montant BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_contribution_goal FOREIGN KEY (objectif_id) REFERENCES objectifs_epargne(id) ON DELETE CASCADE,
    CONSTRAINT fk_contribution_user FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB;
