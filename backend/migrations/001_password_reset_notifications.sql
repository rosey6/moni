CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(100) NOT NULL PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

SET @column_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'utilisateurs' AND COLUMN_NAME = 'session_version'
);
SET @add_session_version = IF(@column_exists = 0, 'ALTER TABLE utilisateurs ADD COLUMN session_version INT UNSIGNED NOT NULL DEFAULT 1', 'SELECT 1');
PREPARE add_session_version FROM @add_session_version;
EXECUTE add_session_version;
DEALLOCATE PREPARE add_session_version;

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

INSERT INTO schema_migrations (version) VALUES ('001_password_reset_notifications')
ON DUPLICATE KEY UPDATE version = VALUES(version);
