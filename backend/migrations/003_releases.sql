-- Releases & Features schema

CREATE TABLE IF NOT EXISTS releases (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  parent_id     INTEGER REFERENCES releases(id) ON DELETE CASCADE,
  status        TEXT DEFAULT 'planning' CHECK (status IN ('planning','active','released','archived')),
  target_date   DATE,
  description   TEXT,
  created_by    TEXT NOT NULL,
  created_by_id INTEGER REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS features (
  id              SERIAL PRIMARY KEY,
  release_id      INTEGER REFERENCES releases(id) ON DELETE CASCADE NOT NULL,
  name            TEXT NOT NULL,
  status          TEXT DEFAULT 'requested' CHECK (status IN ('requested','committed','in_progress','dev_complete','in_testing','completed','deferred')),
  priority        TEXT CHECK (priority IN ('P0','P1','P2','P3')),
  description     TEXT,
  qa_assignee     TEXT,
  dev_assignee    TEXT,
  pm              TEXT,
  jira_id         TEXT,
  target_date     DATE,
  dev_eta         DATE,
  qa_eta          DATE,
  tags            TEXT,
  notes           TEXT,
  created_by      TEXT NOT NULL,
  created_by_id   INTEGER REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ,
  version         INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_features_release ON features(release_id);
CREATE INDEX IF NOT EXISTS idx_features_status ON features(status);
CREATE INDEX IF NOT EXISTS idx_releases_parent ON releases(parent_id);
