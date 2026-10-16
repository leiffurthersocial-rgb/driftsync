/** Subsequence fuzzy score: higher is better, -1 means no match. Rewards prefix and word-start hits. */
export function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  const t = text.toLowerCase();
  if (t.startsWith(q)) return 1000 - t.length;
  const idx = t.indexOf(q);
  if (idx !== -1) return 600 - idx - t.length * 0.1;
  let score = 0;
  let ti = 0;
  for (const ch of q) {
    if (ch === " ") continue;
    const found = t.indexOf(ch, ti);
    if (found === -1) return -1;
    score += found === 0 || t[found - 1] === " " ? 10 : found === ti ? 6 : 1;
    ti = found + 1;
  }
  return score;
}
