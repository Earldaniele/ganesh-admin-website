-- Content and media metadata are stored in the existing JSON snapshots and
-- media_assets rows. No publication rewrite is required for video/gallery fields.
-- Record additive draft imports independently of live publication history.
CREATE TABLE IF NOT EXISTS editor_design_imports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  site_key VARCHAR(100) NOT NULL,
  draft_version BIGINT UNSIGNED NOT NULL,
  source_hash CHAR(64) NOT NULL,
  backup_path VARCHAR(500) NOT NULL,
  imported_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_editor_import_version (site_key, draft_version)
) ENGINE=InnoDB;
