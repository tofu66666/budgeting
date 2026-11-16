CREATE TABLE IF NOT EXISTS budget_users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_admin BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spend_entries (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  category VARCHAR(100) NOT NULL,
  merchant VARCHAR(150),
  notes TEXT,
  source VARCHAR(50) DEFAULT 'manual',
  month VARCHAR(7) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recurring_expenses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(100) NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  frequency VARCHAR(50) NOT NULL,
  next_due_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS receipt_extractions (
  id SERIAL PRIMARY KEY,
  month VARCHAR(7) NOT NULL,
  source VARCHAR(50) DEFAULT 'gemini',
  payload TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spend_entries_month
  ON spend_entries(month);

CREATE INDEX IF NOT EXISTS idx_spend_entries_category
  ON spend_entries(category);

CREATE INDEX IF NOT EXISTS idx_recurring_expenses_active
  ON recurring_expenses(is_active);

INSERT INTO budget_users (username, password_hash, is_admin)
VALUES ('admin', '$2b$12$5.Qdde9Mw30oWrYGU9Uxr.bcgA55MNyt0z5of.oJ.5S34T4/NyEay', TRUE)
ON CONFLICT (username) DO NOTHING;
