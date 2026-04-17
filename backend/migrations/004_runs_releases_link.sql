-- Link test_runs to releases and features
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS release_id INTEGER REFERENCES releases(id) ON DELETE CASCADE;
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS feature_id INTEGER REFERENCES features(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_runs_release ON test_runs(release_id);
CREATE INDEX IF NOT EXISTS idx_runs_feature ON test_runs(feature_id);
