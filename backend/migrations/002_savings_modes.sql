CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(100) NOT NULL PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

SET @mode_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'objectifs_epargne' AND COLUMN_NAME = 'mode'
);
SET @add_mode = IF(@mode_exists = 0, 'ALTER TABLE objectifs_epargne ADD COLUMN mode VARCHAR(10) NOT NULL DEFAULT ''goal'' AFTER nom', 'SELECT 1');
PREPARE add_mode FROM @add_mode;
EXECUTE add_mode;
DEALLOCATE PREPARE add_mode;

ALTER TABLE objectifs_epargne
    MODIFY montant_cible BIGINT UNSIGNED NULL,
    MODIFY date_cible DATE NULL;

INSERT INTO schema_migrations (version) VALUES ('002_savings_modes')
ON DUPLICATE KEY UPDATE version = VALUES(version);
