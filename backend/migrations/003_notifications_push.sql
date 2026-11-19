-- Additive notification infrastructure; run only after a tested backup and maintenance plan.
-- All persisted timestamps are UTC. No financial API contract is changed here.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(100) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

SET @migration_sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'event_type') = 0,
  'ALTER TABLE notifications ADD COLUMN event_type VARCHAR(48) NULL',
  'SELECT 1'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

SET @migration_sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'destination') = 0,
  'ALTER TABLE notifications ADD COLUMN destination VARCHAR(48) NULL',
  'SELECT 1'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

SET @migration_sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND INDEX_NAME = 'ix_notifications_user_history') = 0,
  'ALTER TABLE notifications ADD INDEX ix_notifications_user_history (utilisateur_id, created_at, id)',
  'SELECT 1'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

CREATE TABLE IF NOT EXISTS notification_user_config (
  utilisateur_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  timezone VARCHAR(64) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_notification_config_user FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS push_devices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  utilisateur_id BIGINT UNSIGNED NOT NULL,
  endpoint_hash BINARY(32) NOT NULL,
  subscription_ciphertext BLOB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  UNIQUE KEY uq_push_endpoint (endpoint_hash),
  KEY ix_push_user_active (utilisateur_id, active),
  CONSTRAINT fk_push_device_user FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notification_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  utilisateur_id BIGINT UNSIGNED NOT NULL,
  event_key VARBINARY(191) NOT NULL,
  event_type VARCHAR(48) NOT NULL,
  destination VARCHAR(48) NULL,
  payload_json JSON NULL,
  due_at DATETIME(6) NOT NULL,
  expires_at DATETIME(6) NULL,
  status VARCHAR(20) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  UNIQUE KEY uq_notification_event (utilisateur_id, event_key),
  KEY ix_notification_event_due (status, due_at, id),
  CONSTRAINT fk_notification_event_user FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS push_deliveries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  event_id BIGINT UNSIGNED NOT NULL,
  device_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(20) NOT NULL,
  next_attempt_at DATETIME(6) NOT NULL,
  expires_at DATETIME(6) NULL,
  attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  lease_owner VARBINARY(32) NULL,
  lease_until DATETIME(6) NULL,
  last_status_code SMALLINT UNSIGNED NULL,
  updated_at DATETIME(6) NOT NULL,
  UNIQUE KEY uq_push_delivery (event_id, device_id),
  KEY ix_push_ready (status, next_attempt_at, id),
  KEY ix_push_lease (status, lease_until),
  CONSTRAINT fk_push_delivery_event FOREIGN KEY (event_id) REFERENCES notification_events(id) ON DELETE CASCADE,
  CONSTRAINT fk_push_delivery_device FOREIGN KEY (device_id) REFERENCES push_devices(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS push_daily_quota (
  utilisateur_id BIGINT UNSIGNED NOT NULL,
  local_date DATE NOT NULL,
  reserved_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (utilisateur_id, local_date),
  CONSTRAINT fk_push_quota_user FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT IGNORE INTO schema_migrations (version) VALUES ('003_notifications_push');
