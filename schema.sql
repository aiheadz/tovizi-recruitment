CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  company TEXT,
  contact TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'unread',
  source_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at);

CREATE TABLE IF NOT EXISTS personalized_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  visit_count INTEGER NOT NULL DEFAULT 0,
  last_visit TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_links_code ON personalized_links(code);
CREATE INDEX IF NOT EXISTS idx_links_active ON personalized_links(active);
