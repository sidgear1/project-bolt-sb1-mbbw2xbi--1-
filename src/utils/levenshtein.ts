export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Strip all diacritics — so "denouer" matches "dénouer", "fenetre" matches "fenêtre" */
export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function isSkipAnswer(input: string): boolean {
  const cleaned = input.trim().replace(/\s+/g, ' ');
  return cleaned === '..' || cleaned === '...' || cleaned === '.' || cleaned === '…';
}

export type MatchResult =
  | { match: string; kind: 'exact' }
  | { match: string; kind: 'accent' }    // only accent difference — no warning needed
  | { match: string; kind: 'typo' }      // real spelling error — show warning
  | { match: null; kind: 'none' };

export function findClosestCommand(input: string, candidates: string[]): MatchResult {
  const raw = input.trim().toLowerCase();
  const norm = stripAccents(raw);

  // 1. Exact case-insensitive match
  const exact = candidates.find((c) => c.toLowerCase() === raw);
  if (exact) return { match: exact, kind: 'exact' };

  // 2. Accent-normalized exact match (circumflex/accent omitted — fine)
  const accentMatch = candidates.find((c) => stripAccents(c) === norm);
  if (accentMatch) return { match: accentMatch, kind: 'accent' };

  // 3. Fuzzy match on normalized strings
  let best: string | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = levenshtein(norm, stripAccents(c));
    if (d < bestDist) { bestDist = d; best = c; }
  }

  const maxAllowed = norm.length <= 4 ? 1 : norm.length <= 7 ? 2 : 3;
  if (best && bestDist <= maxAllowed) return { match: best, kind: 'typo' };

  return { match: null, kind: 'none' };
}
