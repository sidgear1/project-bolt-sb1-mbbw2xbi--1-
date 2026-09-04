const normaliseDailyWord = (word: string) => word.trim().toLocaleLowerCase();

export function recordDailyLearnedWords(words: string[], slotOverride?: number) {
  const slot = slotOverride ?? Number(localStorage.getItem("taletalk_active_save_slot") ?? "1");
  const day = new Date().toISOString().slice(0, 10);
  const seenKey = `taletalk-slot-${slot}-daily-word-list-${day}`;
  let stored: unknown = [];
  try { stored = JSON.parse(localStorage.getItem(seenKey) ?? "[]"); } catch { stored = []; }
  const seen = new Set(
    (Array.isArray(stored) ? stored : [])
      .filter((word): word is string => typeof word === "string")
      .map(normaliseDailyWord)
      .filter(Boolean),
  );
  const before = seen.size;
  words.map(normaliseDailyWord).filter(Boolean).forEach(word => seen.add(word));

  if (seen.size !== before) {
    localStorage.setItem(seenKey, JSON.stringify([...seen]));
    localStorage.setItem(`taletalk-slot-${slot}-daily-words-${day}`, String(seen.size));
    const goal = Math.max(1, Number(localStorage.getItem(`taletalk-slot-${slot}-daily-word-goal`) ?? 5));
    const completeKey = `taletalk-slot-${slot}-daily-goal-completed-${day}`;
    if (seen.size >= goal && localStorage.getItem(completeKey) !== "true") {
      localStorage.setItem(completeKey, "true");
      const lastDayKey = `taletalk-slot-${slot}-daily-word-last-complete`;
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const nextStreak = localStorage.getItem(lastDayKey) === yesterday
        ? Number(localStorage.getItem(`taletalk-slot-${slot}-daily-word-streak`) ?? 0) + 1
        : 1;
      localStorage.setItem(`taletalk-slot-${slot}-daily-word-streak`, String(nextStreak));
      localStorage.setItem(lastDayKey, day);
    }
  }

  // Same-tab localStorage writes do not produce a storage event. This event
  // keeps every visible progress counter live as soon as a word is learned.
  window.dispatchEvent(new Event("taletalk-progress-changed"));
}

