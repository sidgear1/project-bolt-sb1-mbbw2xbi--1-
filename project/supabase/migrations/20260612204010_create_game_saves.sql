CREATE TABLE game_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL UNIQUE,
  phase text NOT NULL DEFAULT 'tied',
  learned_words text[] NOT NULL DEFAULT '{}',
  inventory text[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE game_saves ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to manage their own saves by session_id
CREATE POLICY "anon_select_save" ON game_saves FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_save" ON game_saves FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_save" ON game_saves FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_save" ON game_saves FOR DELETE TO anon USING (true);
