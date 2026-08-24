import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { SaveData, GamePhase } from '../types';

const SESSION_KEY = 'memoire_perdue_session';
const ACTIVE_SLOT_KEY = 'taletalk_active_save_slot';
const slotKey = (slot: number) => `taletalk-save-slot-${slot}`;

export interface SaveSlot { slot: number; name: string | null; avatar: string | null; updatedAt: string | null; phase: GamePhase | null; playTimeSeconds: number; }

function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function useSave() {
  const getActiveSlot = () => Number(localStorage.getItem(ACTIVE_SLOT_KEY) ?? '1');
  const selectSlot = useCallback((slot: number) => { localStorage.setItem(ACTIVE_SLOT_KEY, String(Math.min(10, Math.max(1, slot)))); }, []);
  const listSlots = useCallback((): SaveSlot[] => Array.from({ length: 10 }, (_, index) => {
    const slot = index + 1;
    try { const saved = JSON.parse(localStorage.getItem(slotKey(slot)) ?? 'null') as (SaveData & { name?: string; avatar?: string; updatedAt?: string; playTimeSeconds?: number }) | null; return { slot, name: saved?.name ?? null, avatar: saved?.avatar ?? null, updatedAt: saved?.updatedAt ?? null, phase: saved?.phase ?? null, playTimeSeconds: saved?.playTimeSeconds ?? 0 }; } catch { return { slot, name: null, avatar: null, updatedAt: null, phase: null, playTimeSeconds: 0 }; }
  }), []);
  const nameSlot = useCallback((slot: number, name: string, avatar: string | null) => { const previous = JSON.parse(localStorage.getItem(slotKey(slot)) ?? '{}'); localStorage.setItem(slotKey(slot), JSON.stringify({ ...previous, name, avatar, updatedAt: new Date().toISOString() })); }, []);
  const removeSlot = useCallback((slot: number) => localStorage.removeItem(slotKey(slot)), []);
  const save = useCallback(async (data: SaveData) => {
    try {
      const previous = JSON.parse(localStorage.getItem(slotKey(getActiveSlot())) ?? '{}');
      localStorage.setItem(slotKey(getActiveSlot()), JSON.stringify({ ...data, name: previous.name, avatar: previous.avatar, playTimeSeconds: previous.playTimeSeconds ?? 0, updatedAt: new Date().toISOString() }));
      // The older cloud row has one session id, so reserve it for the legacy
      // first save only. Slots 2–6 must never read/write another slot's state.
      if (!supabase || getActiveSlot() !== 1) return;
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
      const rawLocalSave = localStorage.getItem(slotKey(getActiveSlot()));
      const localSave = JSON.parse(rawLocalSave ?? 'null') as SaveData | null;
      if (localSave?.phase) return localSave;
      if (rawLocalSave) return null;
      if (!supabase || getActiveSlot() !== 1) return null;
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
    const previous = JSON.parse(localStorage.getItem(slotKey(getActiveSlot())) ?? '{}');
    if (previous.name || previous.avatar) localStorage.setItem(slotKey(getActiveSlot()), JSON.stringify({ name: previous.name, avatar: previous.avatar, updatedAt: new Date().toISOString() }));
    else localStorage.removeItem(slotKey(getActiveSlot()));
    if (!supabase || getActiveSlot() !== 1) return;
    const sessionId = localStorage.getItem(SESSION_KEY);
    if (!sessionId) return;
    await supabase.from('game_saves').delete().eq('session_id', sessionId);
  }, []);

  const hasSave = useCallback(async (): Promise<boolean> => {
    try {
      if (localStorage.getItem(slotKey(getActiveSlot()))) return true;
      if (!supabase || getActiveSlot() !== 1) return false;
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

  const addPlayTime = useCallback((seconds: number) => {
    const slot = getActiveSlot();
    try {
      const previous = JSON.parse(localStorage.getItem(slotKey(slot)) ?? 'null');
      if (!previous?.name) return;
      localStorage.setItem(slotKey(slot), JSON.stringify({ ...previous, playTimeSeconds: (previous.playTimeSeconds ?? 0) + seconds, updatedAt: new Date().toISOString() }));
    } catch { /* A timer must never interrupt the game. */ }
  }, []);

  return { save, load, deleteSave, hasSave, selectSlot, listSlots, nameSlot, removeSlot, getActiveSlot, addPlayTime };
}
