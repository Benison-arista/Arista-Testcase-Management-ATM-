-- ATM Database Schema

CREATE TABLE IF NOT EXISTS folders (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  parent_id   INTEGER REFERENCES folders(id) ON DELETE CASCADE,
  section     TEXT NOT NULL CHECK (section IN ('velocloud', 'arista')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS testcases (
  id              SERIAL PRIMARY KEY,
  folder_id       INTEGER REFERENCES folders(id) ON DELETE SET NULL,
  section         TEXT NOT NULL CHECK (section IN ('velocloud', 'arista')),
  data            JSONB NOT NULL,
  created_by      TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  last_edited_by  TEXT,
  last_edited_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS testcase_history (
  id            SERIAL PRIMARY KEY,
  testcase_id   INTEGER REFERENCES testcases(id) ON DELETE CASCADE,
  data          JSONB NOT NULL,
  changed_by    TEXT NOT NULL,
  changed_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS run_folders (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  parent_id   INTEGER REFERENCES run_folders(id) ON DELETE CASCADE,
  created_by  TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test_runs (
  id              SERIAL PRIMARY KEY,
  run_folder_id   INTEGER REFERENCES run_folders(id) ON DELETE CASCADE,
  testcase_id     INTEGER REFERENCES testcases(id) ON DELETE CASCADE,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','pass','fail','blocked')),
  version         TEXT,
  bugs            TEXT,
  comments        TEXT,
  executed_by     TEXT,
  executed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_testcases_data ON testcases USING GIN (data);
CREATE INDEX IF NOT EXISTS idx_testcases_folder ON testcases (folder_id);
CREATE INDEX IF NOT EXISTS idx_testcases_section ON testcases (section);
CREATE INDEX IF NOT EXISTS idx_history_tc ON testcase_history (testcase_id);
CREATE INDEX IF NOT EXISTS idx_runs_folder ON test_runs (run_folder_id);
