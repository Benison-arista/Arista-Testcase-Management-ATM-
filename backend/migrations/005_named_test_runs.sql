-- Link run_folders to releases as named test runs
ALTER TABLE run_folders ADD COLUMN IF NOT EXISTS release_id INTEGER REFERENCES releases(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_run_folders_release ON run_folders(release_id);
