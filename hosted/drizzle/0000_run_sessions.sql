CREATE TABLE IF NOT EXISTS run_sessions ( owner_key TEXT NOT NULL, run_id TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, document TEXT, deleted INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL, PRIMARY KEY (owner_key, run_id) );
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS run_sessions_owner_updated ON run_sessions(owner_key, updated_at);
