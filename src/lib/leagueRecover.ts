/**
 * Recovery of a league schedule that was overwritten by a regenerate.
 *
 * Every generation is seeded from `Date.now()` (see generateLeagueSeason) and
 * stamps its matches with a base-36 `Date.now()` tag taken right after the
 * generator returns. The weeks that survived a regenerate still carry the
 * original tag, so the original seed lies a few seconds before that
 * timestamp. Replaying candidate seeds until one reproduces the surviving
 * weeks exactly recovers the lost weeks exactly as they were first issued,
 * including their match ids.
 */

import type { Game, ScheduleMatch, TournamentSchedule } from '@/contexts/AppContext';
import { buildLeagueMatches, buildSeasonOnce, leagueMatchInfo, type LeagueSeason } from '@/lib/league';

/** Seeds per attempt step inside generateLeagueSeason (baseSeed + k * 7919). */
const ATTEMPT_STRIDE = 7919;
const ATTEMPTS = 12;

export interface VerifiedWeek { week: number; sideA: string[]; sideB: string[]; doubles: string[] }

export interface RecoveryTarget {
  /** The original generation tag (base-36 ms). */
  tag: string;
  tagMs: number;
  /** Weeks that still carry the original tag, in full. */
  verified: VerifiedWeek[];
  /** Sided weeks that were rebuilt by a later generation. */
  lostWeeks: number[];
  /** Tags of the later generations, newest first (empty when the weeks were simply deleted). */
  laterTags: string[];
  /** First and last week the original generation covered. */
  startWeek: number;
  endWeek: number;
}

const tagOf = (id: string): string | null => {
  const m = /-s([0-9a-z]+)-w\d+-[AB]\d+(x2)?$/.exec(id);
  return m ? m[1] : null;
};

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * The tag of the first generation still present in a schedule. Room edits and
 * added weeks reuse it, so only a true regenerate introduces a second tag.
 */
export const originalTag = (schedule: TournamentSchedule | null | undefined): string | undefined => {
  if (!schedule) return undefined;
  let best: string | undefined;
  for (const m of schedule.matches) {
    const t = tagOf(m.id);
    if (t && (best === undefined || parseInt(t, 36) < parseInt(best, 36))) best = t;
  }
  return best;
};

const sidedMatches = (schedule: TournamentSchedule) => schedule.matches.filter(m => m.table === 1 || m.table === 2);

/**
 * Looks at a league schedule and works out whether a later generation
 * overwrote part of an earlier one. Returns null when there is nothing to
 * recover (one generation only, or no sided weeks at all).
 */
export const recoveryTarget = (schedule: TournamentSchedule | null | undefined, plannedWeeks: number): RecoveryTarget | null => {
  if (!schedule) return null;
  const sided = sidedMatches(schedule);
  const byTag = new Map<string, Set<number>>();
  for (const m of sided) {
    const t = tagOf(m.id);
    if (!t) continue;
    if (!byTag.has(t)) byTag.set(t, new Set());
    byTag.get(t)!.add(m.round);
  }
  if (byTag.size === 0) return null;
  const tags = [...byTag.keys()].sort((x, y) => parseInt(x, 36) - parseInt(y, 36));
  const tag = tags[0];
  const tagMs = parseInt(tag, 36);
  const originalWeeks = [...byTag.get(tag)!].sort((a, b) => a - b);
  // A week that still has any original-tag game is an original week (a regenerate or
  // room edit always replaces whole weeks; the only other rows that can share a week
  // are strays a previous restore kept on purpose, and those are ignored here).
  const verified: VerifiedWeek[] = [];
  for (const w of originalWeeks) {
    const ms = sided.filter(m => m.round === w && tagOf(m.id) === tag);
    const sideA = new Set<string>(), sideB = new Set<string>(), doubles: string[] = [];
    for (const m of ms) {
      const info = leagueMatchInfo(m);
      const bucket = info.side === 'B' ? sideB : sideA;
      bucket.add(String(m.teamA)); bucket.add(String(m.teamB));
      if (info.gameNo === 2) doubles.push(pairKey(String(m.teamA), String(m.teamB)));
    }
    verified.push({ week: w, sideA: [...sideA].sort(), sideB: [...sideB].sort(), doubles: doubles.sort() });
  }
  const startWeek = originalWeeks[0];
  const endWeek = Math.max(plannedWeeks, ...sided.map(m => m.round));
  const verifiedSet = new Set(verified.map(v => v.week));
  const lostWeeks: number[] = [];
  for (let w = startWeek; w <= endWeek; w++) if (!verifiedSet.has(w)) lostWeeks.push(w);
  if (lostWeeks.length === 0) return null;
  return { tag, tagMs, verified, lostWeeks, laterTags: tags.slice(1).reverse(), startWeek, endWeek };
};

/** True when the season reproduces every verified week exactly (sides and doubles). */
export const seasonMatchesTarget = (season: LeagueSeason, verified: VerifiedWeek[]): boolean => {
  for (const v of verified) {
    const wk = season.weeks.find(w => w.week === v.week);
    if (!wk) return false;
    const a = wk.sideA.slice().sort(), b = wk.sideB.slice().sort();
    if (a.length !== v.sideA.length || b.length !== v.sideB.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== v.sideA[i]) return false;
    for (let i = 0; i < b.length; i++) if (b[i] !== v.sideB[i]) return false;
    const d = wk.pairings.filter(p => p.gameNo === 2).map(p => pairKey(p.teamA, p.teamB)).sort();
    if (d.length !== v.doubles.length) return false;
    for (let i = 0; i < d.length; i++) if (d[i] !== v.doubles[i]) return false;
  }
  return true;
};

export interface SearchParams {
  teamIds: string[];
  weeks: number;
  startWeek: number;
  tagMs: number;
  verified: VerifiedWeek[];
}

/** The seeds generateLeagueSeason would have used had it started `offsetMs` before the tag. */
export const seedsForOffset = (tagMs: number, offsetMs: number): number[] => {
  const base = (tagMs - offsetMs) & 0x7fffffff;
  return Array.from({ length: ATTEMPTS }, (_, k) => base + k * ATTEMPT_STRIDE);
};

/** Tests every seed for one millisecond offset. Returns the season on a hit. */
export const tryOffset = (p: SearchParams, offsetMs: number): { season: LeagueSeason; seed: number } | null => {
  for (const seed of seedsForOffset(p.tagMs, offsetMs)) {
    const season = buildSeasonOnce(p.teamIds, p.weeks, seed, p.startWeek);
    if (seasonMatchesTarget(season, p.verified)) return { season, seed };
  }
  return null;
};

export interface SearchProgress { checkedMs: number; maxMs: number; workers: number }
export interface SearchHit { season: LeagueSeason; seed: number; offsetMs: number }

/**
 * Scans offsets 0..maxMs (how long the original generation took before it
 * stamped its tag) across web workers when available, else on this thread in
 * small slices so the page stays responsive.
 */
export const findOriginalSeason = (
  p: SearchParams,
  opts: { maxMs?: number; onProgress?: (s: SearchProgress) => void; signal?: { cancelled: boolean }; workerFactory?: () => Worker } = {},
): Promise<SearchHit | null> => {
  const maxMs = opts.maxMs ?? 90_000;
  const signal = opts.signal ?? { cancelled: false };
  const canWorker = typeof Worker !== 'undefined' && !!opts.workerFactory;
  if (!canWorker) return scanOnThread(p, maxMs, opts.onProgress, signal);
  const count = Math.max(1, Math.min(16, (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4));
  return new Promise(resolve => {
    const workers: Worker[] = [];
    const done = new Array(count).fill(0);
    let finished = false;
    const stop = (hit: SearchHit | null) => {
      if (finished) return;
      finished = true;
      workers.forEach(w => w.terminate());
      resolve(hit);
    };
    opts.onProgress?.({ checkedMs: 0, maxMs, workers: count });
    const poll = setInterval(() => {
      if (signal.cancelled) { clearInterval(poll); stop(null); }
    }, 200);
    for (let i = 0; i < count; i++) {
      let w: Worker;
      try { w = opts.workerFactory!(); } catch { clearInterval(poll); workers.forEach(x => x.terminate()); resolve(scanOnThread(p, maxMs, opts.onProgress, signal)); return; }
      workers.push(w);
      w.onmessage = (ev: MessageEvent) => {
        const msg = ev.data;
        if (msg.type === 'progress') {
          done[i] = msg.offsetMs;
          opts.onProgress?.({ checkedMs: Math.min(...done), maxMs, workers: count });
        } else if (msg.type === 'found') {
          clearInterval(poll);
          stop({ season: msg.season, seed: msg.seed, offsetMs: msg.offsetMs });
        } else if (msg.type === 'exhausted') {
          done[i] = maxMs;
          if (done.every(d => d >= maxMs)) { clearInterval(poll); stop(null); }
        }
      };
      w.onerror = () => { clearInterval(poll); workers.forEach(x => x.terminate()); if (!finished) { finished = true; resolve(scanOnThread(p, maxMs, opts.onProgress, signal)); } };
      w.postMessage({ type: 'scan', params: p, first: i, step: count, maxMs });
    }
  });
};

const scanOnThread = async (p: SearchParams, maxMs: number, onProgress?: (s: SearchProgress) => void, signal?: { cancelled: boolean }): Promise<SearchHit | null> => {
  for (let offset = 0; offset <= maxMs; offset++) {
    if (signal?.cancelled) return null;
    const hit = tryOffset(p, offset);
    if (hit) return { ...hit, offsetMs: offset };
    if (offset % 5 === 0) {
      onProgress?.({ checkedMs: offset, maxMs, workers: 1 });
      await new Promise(r => setTimeout(r, 0));
    }
  }
  return null;
};

/** Worker-side loop (called by leagueRecover.worker.ts). */
export const scanSlice = (p: SearchParams, first: number, step: number, maxMs: number, post: (msg: unknown) => void) => {
  let n = 0;
  for (let offset = first; offset <= maxMs; offset += step) {
    const hit = tryOffset(p, offset);
    if (hit) { post({ type: 'found', season: hit.season, seed: hit.seed, offsetMs: offset }); return; }
    if (++n % 3 === 0) post({ type: 'progress', offsetMs: offset });
  }
  post({ type: 'exhausted' });
};

// ---------------------------------------------------------------------------
// Applying the recovered weeks
// ---------------------------------------------------------------------------

export interface RestorePlan {
  weeks: number[];
  /** Match rows to insert (original ids, original pairings). */
  insert: ScheduleMatch[];
  /** Ids of the later-generation matches to delete. */
  deleteIds: string[];
  /** Score rows moved onto a restored match: game id -> new match id. */
  reattach: { gameId: string; matchId: string; week: number }[];
  /** Score rows whose pairing does not exist in the restored week; their match is kept. */
  unmatched: { gameId: string; matchId: string; week: number; teamA: string; teamB: string }[];
}

/**
 * Works out exactly what changes in the database: the lost weeks get their
 * original matches back (same ids, built with the original tag), the later
 * generation's matches go, and any score entered since is moved onto the
 * restored game between the same two teams.
 */
export const planRestore = (tournamentId: string, schedule: TournamentSchedule, games: Game[], target: RecoveryTarget, season: LeagueSeason): RestorePlan => {
  const weeks = target.lostWeeks.filter(w => season.weeks.some(s => s.week === w));
  const restored = buildLeagueMatches(tournamentId, { ...season, weeks: season.weeks.filter(w => weeks.includes(w.week)) }, target.tag);
  const restoredIds = new Set(restored.map(m => m.id));
  const doomed = schedule.matches.filter(m => weeks.includes(m.round) && (m.table === 1 || m.table === 2) && !restoredIds.has(m.id));
  const doomedIds = new Set(doomed.map(m => m.id));
  const insert = restored.filter(m => !schedule.matches.some(x => x.id === m.id));

  const used = new Set<string>();
  const reattach: RestorePlan['reattach'] = [];
  const unmatched: RestorePlan['unmatched'] = [];
  const keep = new Set<string>();
  const affected = games.filter(g => g.matchId && doomedIds.has(String(g.matchId)));
  // Confirmed rows first so they get the first (non-double) slot.
  affected.sort((x, y) => Number(y.status === 'confirmed') - Number(x.status === 'confirmed'));
  for (const g of affected) {
    const old = doomed.find(m => m.id === String(g.matchId))!;
    const key = pairKey(String(g.teamA), String(g.teamB));
    const candidates = restored.filter(m => m.round === old.round && pairKey(String(m.teamA), String(m.teamB)) === key && !used.has(m.id));
    if (candidates.length === 0) {
      unmatched.push({ gameId: g.id, matchId: old.id, week: old.round, teamA: String(g.teamA), teamB: String(g.teamB) });
      keep.add(old.id);
      continue;
    }
    const pick = candidates.find(m => !m.id.endsWith('x2')) ?? candidates[0];
    used.add(pick.id);
    reattach.push({ gameId: g.id, matchId: pick.id, week: old.round });
  }
  const deleteIds = doomed.filter(m => !keep.has(m.id)).map(m => m.id);
  return { weeks, insert, deleteIds, reattach, unmatched };
};
