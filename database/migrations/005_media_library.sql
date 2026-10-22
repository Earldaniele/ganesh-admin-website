-- Preserve existing rows and URLs. Imported sources are aliases for reference checks.
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS alt_text VARCHAR(300) NOT NULL DEFAULT '';
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS source_url VARCHAR(2000) NULL;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS source_key CHAR(64) NULL UNIQUE;
