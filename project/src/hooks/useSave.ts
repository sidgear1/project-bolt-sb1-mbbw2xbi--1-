import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { SaveData, GamePhase } from '../types';

const SESSION_KEY = 'memoire_perdue_session';

function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function useSave() {
  const save = useCallback(async (data: SaveData) => {
    try {
      const sessionId = getSessionId();
      await supabase.from('game_saves').upsert(
        {
          session_id: sessionId,
          phase: data.phase,
          learned_words: data.learnedWords,
          inventory: data.inventory,
          dictionary_words: data.dictionary,
          intro_seen: data.introSeen,
          xp: data.xp,
          combat_cleared: data.combatCleared,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'session_id' }
      );
    } catch {
      // Silently ignore save errors — never crash the game
    }
  }, []);

  const load = useCallback(async (): Promise<SaveData | null> => {
    try {
      const sessionId = localStorage.getItem(SESSION_KEY);
      if (!sessionId) return null;

      const { data, error } = await supabase
        .from('game_saves')
        .select('phase, learned_words, inventory, dictionary_words, intro_seen, xp, combat_cleared')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (error || !data) return null;

    return {
      phase: data.phase as GamePhase,
      learnedWords: data.learned_words ?? [],
      inventory: data.inventory ?? [],
      dictionary: data.dictionary_words ?? [],
      introSeen: data.intro_seen ?? false,
      xp: data.xp ?? 0,
      combatCleared: data.combat_cleared ?? false,
    };
    } catch {
      return null;
    }
  }, []);

  const deleteSave = useCallback(async () => {
    const sessionId = localStorage.getItem(SESSION_KEY);
    if (!sessionId) return;
    await supabase.from('game_saves').delete().eq('session_id', sessionId);
  }, []);

  const hasSave = useCallback(async (): Promise<boolean> => {
    try {
      const sessionId = localStorage.getItem(SESSION_KEY);
      if (!sessionId) return false;
      const { data } = await supabase
        .from('game_saves')
        .select('id')
        .eq('session_id', sessionId)
        .maybeSingle();
      return !!data;
    } catch {
      return false;
    }
  }, []);

  return { save, load, deleteSave, hasSave };
}
