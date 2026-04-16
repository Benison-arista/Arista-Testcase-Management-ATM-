-- Authentication & RBAC schema

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('viewer', 'editor', 'run_manager');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'viewer',
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Add user FK columns alongside existing TEXT columns (transition period)
ALTER TABLE testcases ADD COLUMN IF NOT EXISTS created_by_id INTEGER REFERENCES users(id);
ALTER TABLE testcases ADD COLUMN IF NOT EXISTS last_edited_by_id INTEGER REFERENCES users(id);
ALTER TABLE testcase_history ADD COLUMN IF NOT EXISTS changed_by_id INTEGER REFERENCES users(id);
ALTER TABLE run_folders ADD COLUMN IF NOT EXISTS created_by_id INTEGER REFERENCES users(id);
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS executed_by_id INTEGER REFERENCES users(id);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_testcases_folder_section ON testcases (folder_id, section);
CREATE INDEX IF NOT EXISTS idx_testcases_folder_created ON testcases (folder_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_folder_status ON test_runs (run_folder_id, status);
CREATE INDEX IF NOT EXISTS idx_history_tc_changed ON testcase_history (testcase_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_folders_section_parent ON folders (section, parent_id);
CREATE INDEX IF NOT EXISTS idx_run_folders_parent ON run_folders (parent_id);

-- Version columns for optimistic locking
ALTER TABLE testcases ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS lock_version INTEGER NOT NULL DEFAULT 1;

-- Schema migration tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
  version   TEXT PRIMARY KEY,
  name      TEXT,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);
