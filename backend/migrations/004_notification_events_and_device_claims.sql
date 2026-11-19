-- Additive structured notification fields and persistent worker leases.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(100) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

SET @migration_sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'title') = 0,
  'ALTER TABLE notifications ADD COLUMN title VARCHAR(120) NULL AFTER notification_key',
  'SELECT 1'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

SET @migration_sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'resource_type') = 0,
  'ALTER TABLE notifications ADD COLUMN resource_type VARCHAR(32) NULL',
  'SELECT 1'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

SET @migration_sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'resource_id') = 0,
  'ALTER TABLE notifications ADD COLUMN resource_id BIGINT UNSIGNED NULL',
  'SELECT 1'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

SET @migration_sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification_events' AND COLUMN_NAME = 'notification_id') = 0,
  'ALTER TABLE notification_events ADD COLUMN notification_id BIGINT UNSIGNED NULL',
  'SELECT 1'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

SET @migration_sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification_events' AND COLUMN_NAME = 'attempts') = 0,
  'ALTER TABLE notification_events ADD COLUMN attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

SET @migration_sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification_events' AND COLUMN_NAME = 'lease_owner') = 0,
  'ALTER TABLE notification_events ADD COLUMN lease_owner VARBINARY(32) NULL',
  'SELECT 1'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

SET @migration_sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification_events' AND COLUMN_NAME = 'lease_until') = 0,
  'ALTER TABLE notification_events ADD COLUMN lease_until DATETIME(6) NULL',
  'SELECT 1'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

SET @migration_sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification_events' AND COLUMN_NAME = 'next_attempt_at') = 0,
  'ALTER TABLE notification_events ADD COLUMN next_attempt_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)',
  'SELECT 1'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

SET @migration_sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification_events' AND COLUMN_NAME = 'updated_at') = 0,
  'ALTER TABLE notification_events ADD COLUMN updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)',
  'SELECT 1'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

SET @migration_sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notification_events' AND INDEX_NAME = 'ix_notification_event_lease') = 0,
  'ALTER TABLE notification_events ADD KEY ix_notification_event_lease (status, lease_until)',
  'SELECT 1'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

SET @migration_sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'push_deliveries' AND COLUMN_NAME = 'last_error_code') = 0,
  'ALTER TABLE push_deliveries ADD COLUMN last_error_code VARCHAR(48) NULL',
  'SELECT 1'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

CREATE TABLE IF NOT EXISTS push_registration_rate (
  utilisateur_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  window_started_at DATETIME(6) NOT NULL,
  attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT fk_push_registration_rate_user FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS push_event_quota (
  event_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  utilisateur_id BIGINT UNSIGNED NOT NULL,
  local_date DATE NOT NULL,
  CONSTRAINT fk_push_event_quota_event FOREIGN KEY (event_id) REFERENCES notification_events(id) ON DELETE CASCADE,
  CONSTRAINT fk_push_event_quota_user FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
  KEY ix_push_event_quota_user_date (utilisateur_id, local_date)
) ENGINE=InnoDB;

INSERT IGNORE INTO schema_migrations (version) VALUES ('004_notification_events_and_device_claims');
