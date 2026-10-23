CREATE TABLE IF NOT EXISTS saved_editor_drafts (
  id CHAR(36) NOT NULL PRIMARY KEY,
  site_key VARCHAR(80) NOT NULL,
  name VARCHAR(120) NOT NULL,
  content JSON NOT NULL,
  base_content JSON NOT NULL,
  changes JSON NOT NULL,
  change_count INT UNSIGNED NOT NULL,
  affected_sections JSON NOT NULL,
  saved_by CHAR(36) NULL,
  saved_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX idx_saved_editor_site_date (site_key, saved_at),
  CONSTRAINT fk_saved_editor_user FOREIGN KEY (saved_by) REFERENCES admin_profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
