type Attempt = {
  scene: string;
  word: string;
  correct: boolean;
  at: number;
  mode?: "normal" | "hard" | "very-hard";
  korean?: string;
  answerScript?: "Hangul" | "Romanisation";
};

export default function RevisionWorldStats({ slot, scenes, onClose }: { slot: number; scenes: string[]; onClose: () => void }) {
  const attempts = (() => {
    try { return JSON.parse(localStorage.getItem(`taletalk-slot-${slot}-world-quiz-attempts-v1`) ?? "[]") as Attempt[]; }
    catch { return []; }
  })().filter((attempt) => attempt && scenes.includes(attempt.scene) && typeof attempt.word === "string" && typeof attempt.correct === "boolean" && typeof attempt.at === "number");
  const words = [...new Set(attempts.map((attempt) => attempt.word))];
  const recent = words.flatMap((word) => attempts.filter((attempt) => attempt.word === word).sort((a, b) => a.at - b.at).slice(-5));
  const correct = recent.filter((attempt) => attempt.correct).length;
  const difficulty = (mode?: Attempt["mode"]) => mode === "very-hard" ? "Very Hard" : mode === "hard" ? "Hard" : mode === "normal" ? "Normal" : "Mode not recorded";

  return <div className="revision-world-stats-detailed" role="dialog" aria-modal="true"><section>
    <button onClick={onClose} aria-label="Close statistics">×</button>
    <h3>Quiz results</h3>
    <strong>{recent.length ? `${Math.round((correct / recent.length) * 100)}% overall · latest attempts` : "No attempts yet"}</strong>
    {words.length ? words.map((word) => {
      const tries = attempts.filter((attempt) => attempt.word === word).sort((a, b) => a.at - b.at).slice(-5);
      const right = tries.filter((attempt) => attempt.correct).length;
      const lastCorrect = tries.slice().reverse().find((attempt) => attempt.correct);
      return <div className="revision-attempt-breakdown" key={word}>
        <b>{word}</b>
        <small>Hangul: {tries.at(-1)?.korean ?? "Not recorded in earlier tries"}</small>
        <small>Last correct answer: {lastCorrect?.answerScript ?? "Not recorded in earlier tries"}</small>
        <small>Last {tries.length}/5 tries · {right} correct · {tries.length - right} wrong</small>
        {tries.map((attempt) => <span key={attempt.at} className={attempt.correct ? "correct" : "wrong"}>{attempt.correct ? "✓ Correct" : "✕ Wrong"} · {difficulty(attempt.mode)}{attempt.answerScript ? ` · ${attempt.answerScript}` : ""}</span>)}
      </div>;
    }) : <p>No quiz attempts for the selected scenes yet.</p>}
  </section></div>;
}
