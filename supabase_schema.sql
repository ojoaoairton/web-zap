CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  flow JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE analytics_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  type TEXT NOT NULL,
  label TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own projects" ON projects
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS ab_variant TEXT DEFAULT 'A';
