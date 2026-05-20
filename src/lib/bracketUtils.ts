// ── Visual position lookup ─────────────────────────────────────────────────────
// bracket size → round → table number → visual position (0 = top)
// Even visPos → winner fills team1 (top) slot in next round
// Odd  visPos → winner fills team2 (bottom) slot in next round
export const VISUAL_POS: Record<number, Record<number, Record<number, number>>> = {
  4: {
    1: { 1: 0, 2: 1 },
    2: { 1: 0 },
  },
  8: {
    1: { 1: 0, 4: 1, 3: 2, 2: 3 },
    2: { 1: 0, 2: 1 },
    3: { 1: 0 },
  },
  16: {
    1: { 1: 0, 8: 1, 4: 2, 5: 3, 3: 4, 6: 5, 2: 6, 7: 7 },
    2: { 1: 0, 4: 1, 3: 2, 2: 3 },
    3: { 1: 0, 2: 1 },
    4: { 1: 0 },
  },
  32: {
    1: { 1: 0, 16: 1, 8: 2, 9: 3, 4: 4, 13: 5, 5: 6, 12: 7,
         3: 8, 14: 9, 6: 10, 11: 11, 2: 12, 15: 13, 7: 14, 10: 15 },
    2: { 1: 0, 8: 1, 4: 2, 5: 3, 3: 4, 6: 5, 2: 6, 7: 7 },
    3: { 1: 0, 4: 1, 3: 2, 2: 3 },
    4: { 1: 0, 2: 1 },
    5: { 1: 0 },
  },
};

export const getVisualPos = (size: number, round: number, table: number): number =>
  VISUAL_POS[size]?.[round]?.[table] ?? table - 1;
