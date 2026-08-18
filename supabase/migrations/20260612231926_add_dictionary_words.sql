ALTER TABLE game_saves ADD COLUMN IF NOT EXISTS dictionary_words jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE game_saves ADD COLUMN IF NOT EXISTS intro_seen boolean NOT NULL DEFAULT false;
