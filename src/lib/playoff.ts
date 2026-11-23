/**
 * Season playoffs for a league.
 *
 * The playoffs are their own tournament (`rotation_type = 'playoff'`) linked
 * to the league through a JSON config stored in the tournament description,
 * so the season's standings, weeks and locks are never touched. No schema
 * changes: matches use `round` (1 = preliminary, 2 = bracket) and
 * `table_number` (= tier); scores use the normal `games` table and the normal
 * entry / confirm / dispute flow.
 *
 * Match ids
 *   preliminary  `${pid}-t${tier}-r1-p${pair}-g${n}`   (n = 1, 2 when a pair meets twice)
 *   bracket      `${pid}-t${tier}-r2-${series}-g${k}`  (k = 1..3, best of three)
 */

import type { Game, ScheduleMatch, Team, Tournament, TournamentSchedule } from '@/contexts/AppContext';
import { gameBelongsToMatch } from '@/lib/league';

export const PRELIM_ROUND = 1;
export const BRACKET_ROUND = 2;
export const PRELIM_GAMES_PER_TEAM = 10;
export const SERIES_WINS = 2;

export type Tier = 1 | 2;
export const TIER_NAME: Record<Tier, string> = { 1: 'Champion tier', 2: 'Second tier' };

export interface PlayoffConfig {
  playoffOf: string;
  /** Team ids per tier, fixed when the tier's preliminary games are generated. */
  tiers: Partial<Record<Tier, string[]>>;
  /** Seeds 1..n per tier, fixed when the bracket is created. */
  seeds: Partial<Record<Tier, string[]>>;
  /** Teams left out of the playoffs entirely (not showing up). */
  excluded: string[];
}

export const isPlayoffTournament = (t?: Tournament | null): boolean => t?.rotationType === 'playoff';

export const parsePlayoffConfig = (t?: Tournament | null): PlayoffConfig | null => {
  if (!t?.description) return null;
  try {
    const o = JSON.parse(t.description);
    if (!o || typeof o.playoffOf !== 'string') return null;
    return { playoffOf: o.playoffOf, tiers: o.tiers ?? {}, seeds: o.seeds ?? {}, excluded: o.excluded ?? [] };
  } catch {
    return null;
  }
};

export const serializePlayoffConfig = (c: PlayoffConfig): string => JSON.stringify(c);

/** The playoff tournament belonging to a league, if one exists. */
export const playoffForLeague = (tournaments: Tournament[], leagueId: string): Tournament | null =>
  tournaments.find(t => isPlayoffTournament(t) && parsePlayoffConfig(t)?.playoffOf === String(leagueId)) ?? null;

export interface PlayoffMatchInfo { tier: Tier; round: number; pair?: number; series?: string; game: number }

export const playoffMatchInfo = (m: ScheduleMatch): PlayoffMatchInfo | null => {
  const pre = /-t([12])-r1-p(\d+)-g(\d+)$/.exec(m.id);
  if (pre) return { tier: Number(pre[1]) as Tier, round: PRELIM_ROUND, pair: Number(pre[2]), game: Number(pre[3]) };
  const br = /-t([12])-r2-([A-Z0-9]+)-g(\d+)$/.exec(m.id);
  if (br) return { tier: Number(br[1]) as Tier, round: BRACKET_ROUND, series: br[2], game: Number(br[3]) };
  return null;
};

// ---------------------------------------------------------------------------
// Preliminary round schedules
// ---------------------------------------------------------------------------

const rowOf = (pid: string, tier: Tier, id: string, a: string, b: string, round: number): ScheduleMatch => ({
  id, teamA: a, teamB: b, round, tournamentId: pid, table: tier, isBye: false, isSameCity: false,
});

/**
 * Champion tier: every pair meets twice. Six teams -> 15 pairs -> 30 games,
 * 10 per team. No order; any two free teams play.
 */
export const buildDoubleRoundRobin = (pid: string, tier: Tier, teamIds: string[]): ScheduleMatch[] => {
  const out: ScheduleMatch[] = [];
  let pair = 0;
  for (let i = 0; i < teamIds.length; i++) for (let j = i + 1; j < teamIds.length; j++) {
    pair++;
    out.push(rowOf(pid, tier, `${pid}-t${tier}-r1-p${pair}-g1`, teamIds[i], teamIds[j], PRELIM_ROUND));
    out.push(rowOf(pid, tier, `${pid}-t${tier}-r1-p${pair}-g2`, teamIds[i], teamIds[j], PRELIM_ROUND));
  }
  return out;
};

/**
 * Second tier: `gamesPerTeam` games each from a single round robin, so every
 * team skips (n - 1 - gamesPerTeam) opponents. `teamIds` must be in season
 * rank order: the skipped opponents are the neighbours in that order (a
 * circulant pattern), which keeps strength of schedule even. With 13 teams and
 * 10 games each team skips the team just above and just below it.
 */
export const buildSkipRoundRobin = (pid: string, tier: Tier, teamIdsByRank: string[], gamesPerTeam = PRELIM_GAMES_PER_TEAM): ScheduleMatch[] => {
  const n = teamIdsByRank.length;
  const skip = n - 1 - gamesPerTeam;
  if (skip < 0) throw new Error(`${n} teams cannot play ${gamesPerTeam} different opponents.`);
  if ((n * gamesPerTeam) % 2 !== 0) throw new Error(`${n} teams at ${gamesPerTeam} games each is not an even number of games.`);
  // Skip offsets: ±1, ±2, ... and, when an odd count is needed, the opposite team (n/2).
  const skipOffsets = new Set<number>();
  let k = 1;
  while (skipOffsets.size < skip) {
    if (skip - skipOffsets.size === 1 && n % 2 === 0) { skipOffsets.add(n / 2); break; }
    skipOffsets.add(k); skipOffsets.add(n - k); k++;
  }
  const out: ScheduleMatch[] = [];
  let pair = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const d = j - i;
    if (skipOffsets.has(d) || skipOffsets.has(n - d)) continue;
    pair++;
    out.push(rowOf(pid, tier, `${pid}-t${tier}-r1-p${pair}-g1`, teamIdsByRank[i], teamIdsByRank[j], PRELIM_ROUND));
  }
  return out;
};

// ---------------------------------------------------------------------------
// Preliminary standings and seeding
// ---------------------------------------------------------------------------

export interface PrelimRow {
  teamId: string;
  teamName: string;
  played: number;
  wins: number;
  losses: number;
  points: number;
  bostons: number;
  seasonRank: number;
  seed: number;
  /** How the seed was settled when tied on wins: 'h2h', 'points', 'season' or '' when not tied. */
  tiebreak: string;
}

const confirmedOf = (games: Game[], m: ScheduleMatch): Game | undefined => {
  const rows = games.filter(g => (g.confirmed || g.status === 'confirmed') && gameBelongsToMatch(g, m));
  rows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return rows[0];
};

/** Confirmed result per preliminary match of a tier (newest row per match). */
export const prelimResults = (schedule: TournamentSchedule | null | undefined, games: Game[], tier: Tier): { match: ScheduleMatch; game: Game }[] => {
  if (!schedule) return [];
  const out: { match: ScheduleMatch; game: Game }[] = [];
  for (const m of schedule.matches) {
    const info = playoffMatchInfo(m);
    if (!info || info.round !== PRELIM_ROUND || info.tier !== tier) continue;
    const g = confirmedOf(games, m);
    if (g) out.push({ match: m, game: g });
  }
  return out;
};

/**
 * Seeds for a tier: wins, then head-to-head among the tied teams, then total
 * points, then season finish. `seasonRank` maps team id -> season rank.
 */
export const prelimStandings = (teams: Team[], tier: Tier, tierTeamIds: string[], schedule: TournamentSchedule | null | undefined, games: Game[], seasonRank: Record<string, number>): PrelimRow[] => {
  const rows = new Map<string, PrelimRow>();
  for (const id of tierTeamIds) {
    const t = teams.find(x => String(x.id) === id);
    rows.set(id, { teamId: id, teamName: t?.name ?? id, played: 0, wins: 0, losses: 0, points: 0, bostons: 0, seasonRank: seasonRank[id] ?? 999, seed: 0, tiebreak: '' });
  }
  const results = prelimResults(schedule, games, tier).filter(r => rows.has(String(r.game.teamA)) && rows.has(String(r.game.teamB)));
  const h2h = new Map<string, number>(); // "a|b" -> wins of a over b
  for (const { game: g } of results) {
    const a = String(g.teamA), b = String(g.teamB);
    const ra = rows.get(a)!, rb = rows.get(b)!;
    ra.played++; rb.played++;
    ra.points += Number(g.scoreA) || 0; rb.points += Number(g.scoreB) || 0;
    ra.bostons += Number(g.boston_a) || 0; rb.bostons += Number(g.boston_b) || 0;
    const winner = g.winner === 'teamA' ? a : b, loser = winner === a ? b : a;
    rows.get(winner)!.wins++; rows.get(loser)!.losses++;
    h2h.set(`${winner}|${loser}`, (h2h.get(`${winner}|${loser}`) ?? 0) + 1);
  }
  const all = [...rows.values()];
  // Order: wins, then within a tie group head-to-head wins inside the group, then points, then season rank.
  const groupsByWins = new Map<number, PrelimRow[]>();
  for (const r of all) groupsByWins.set(r.wins, [...(groupsByWins.get(r.wins) ?? []), r]);
  const ordered: PrelimRow[] = [];
  for (const wins of [...groupsByWins.keys()].sort((a, b) => b - a)) {
    const group = groupsByWins.get(wins)!;
    if (group.length === 1) { ordered.push(group[0]); continue; }
    const h2hWins = (r: PrelimRow) => group.reduce((s, o) => s + (o === r ? 0 : (h2h.get(`${r.teamId}|${o.teamId}`) ?? 0)), 0);
    const h2hPlayed = (r: PrelimRow) => group.reduce((s, o) => s + (o === r ? 0 : (h2h.get(`${r.teamId}|${o.teamId}`) ?? 0) + (h2h.get(`${o.teamId}|${r.teamId}`) ?? 0)), 0);
    const anyH2h = group.some(r => h2hPlayed(r) > 0);
    group.sort((x, y) => {
      if (anyH2h && h2hWins(y) !== h2hWins(x)) return h2hWins(y) - h2hWins(x);
      if (y.points !== x.points) return y.points - x.points;
      return x.seasonRank - y.seasonRank;
    });
    for (let i = 0; i < group.length; i++) {
      const r = group[i];
      const prev = group[i - 1], next = group[i + 1];
      const sameH2h = (o?: PrelimRow) => o && (!anyH2h || h2hWins(o) === h2hWins(r));
      if (anyH2h && !(sameH2h(prev) || sameH2h(next))) r.tiebreak = 'h2h';
      else if ((prev && prev.points !== r.points) || (next && next.points !== r.points)) r.tiebreak = 'points';
      else r.tiebreak = 'season';
    }
    ordered.push(...group);
  }
  ordered.forEach((r, i) => { r.seed = i + 1; });
  return ordered;
};

// ---------------------------------------------------------------------------
// Bracket
// ---------------------------------------------------------------------------

export interface SeriesSpec {
  key: string;
  label: string;
  /** Seeds (1-based) that meet, or the series whose winner / loser feeds this one. */
  from: { seedA: number; seedB: number } | { winnersOf: [string, string] } | { losersOf: [string, string] };
  /** Final placings for the winner and loser. */
  places: [number, number];
}

/** Both tiers use semis 1v4 and 2v3, a final and a third-place series; the champion tier adds 5v6. */
export const bracketSpec = (tier: Tier): SeriesSpec[] => {
  const base: SeriesSpec[] = [
    { key: 'SF1', label: 'Semifinal 1 · 1 vs 4', from: { seedA: 1, seedB: 4 }, places: [0, 0] },
    { key: 'SF2', label: 'Semifinal 2 · 2 vs 3', from: { seedA: 2, seedB: 3 }, places: [0, 0] },
    { key: 'F', label: 'Championship', from: { winnersOf: ['SF1', 'SF2'] }, places: [1, 2] },
    { key: 'P3', label: 'Third place', from: { losersOf: ['SF1', 'SF2'] }, places: [3, 4] },
  ];
  if (tier === 1) base.unshift({ key: 'P5', label: 'Fifth place · 5 vs 6', from: { seedA: 5, seedB: 6 }, places: [5, 6] });
  return base;
};

export interface SeriesGame { match: ScheduleMatch; game?: Game; winner?: string }
export interface SeriesState {
  spec: SeriesSpec;
  teamA?: string;
  teamB?: string;
  games: SeriesGame[];
  winsA: number;
  winsB: number;
  winner?: string;
  loser?: string;
  /** Games still to be played before the series can end (0 when done). */
  pending: number;
}

/** Current state of every series of a tier, deriving later rounds' teams from earlier results. */
export const bracketState = (tier: Tier, seeds: string[] | undefined, schedule: TournamentSchedule | null | undefined, games: Game[]): SeriesState[] => {
  const specs = bracketSpec(tier);
  const byKey = new Map<string, SeriesState>();
  for (const spec of specs) {
    const st: SeriesState = { spec, games: [], winsA: 0, winsB: 0, pending: SERIES_WINS };
    if ('seedA' in spec.from && seeds) { st.teamA = seeds[spec.from.seedA - 1]; st.teamB = seeds[spec.from.seedB - 1]; }
    if ('winnersOf' in spec.from) { const [x, y] = spec.from.winnersOf; st.teamA = byKey.get(x)?.winner; st.teamB = byKey.get(y)?.winner; }
    if ('losersOf' in spec.from) { const [x, y] = spec.from.losersOf; st.teamA = byKey.get(x)?.loser; st.teamB = byKey.get(y)?.loser; }
    const matches = (schedule?.matches ?? [])
      .map(m => ({ m, info: playoffMatchInfo(m) }))
      .filter(x => x.info && x.info.round === BRACKET_ROUND && x.info.tier === tier && x.info.series === spec.key)
      .sort((x, y) => x.info!.game - y.info!.game)
      .map(x => x.m);
    for (const m of matches) {
      const g = confirmedOf(games, m);
      const sg: SeriesGame = { match: m, game: g };
      if (g) {
        sg.winner = g.winner === 'teamA' ? String(g.teamA) : String(g.teamB);
        if (st.teamA && sg.winner === st.teamA) st.winsA++;
        else if (st.teamB && sg.winner === st.teamB) st.winsB++;
      }
      st.games.push(sg);
    }
    if (st.winsA >= SERIES_WINS) { st.winner = st.teamA; st.loser = st.teamB; }
    else if (st.winsB >= SERIES_WINS) { st.winner = st.teamB; st.loser = st.teamA; }
    st.pending = st.winner ? 0 : SERIES_WINS - Math.max(st.winsA, st.winsB);
    byKey.set(spec.key, st);
  }
  return specs.map(s => byKey.get(s.key)!);
};

/**
 * Match rows that should exist but do not yet: the first two games of every
 * series whose teams are known, and a third game once a series stands 1-1.
 * Deterministic ids, so calling this from several screens is safe (insert
 * with ignoreDuplicates).
 */
export const bracketMatchesToCreate = (pid: string, tier: Tier, states: SeriesState[]): ScheduleMatch[] => {
  const out: ScheduleMatch[] = [];
  for (const st of states) {
    if (!st.teamA || !st.teamB || st.winner) continue;
    const have = st.games.length;
    const confirmed = st.games.filter(g => g.game).length;
    let want = Math.min(2, SERIES_WINS * 2 - 2); // two games up front
    if (have >= 2 && confirmed === have && st.winsA === st.winsB) want = have + 1; // 1-1: a decider
    for (let k = have + 1; k <= Math.min(want, SERIES_WINS * 2 - 1); k++) {
      out.push(rowOf(pid, tier, `${pid}-t${tier}-r2-${st.spec.key}-g${k}`, st.teamA, st.teamB, BRACKET_ROUND));
    }
  }
  return out;
};

/** Final placings for a tier, 1 = champion; only places decided so far. */
export const bracketPlacings = (states: SeriesState[]): { place: number; teamId: string }[] => {
  const out: { place: number; teamId: string }[] = [];
  for (const st of states) {
    if (!st.winner || !st.loser) continue;
    if (st.spec.places[0]) out.push({ place: st.spec.places[0], teamId: st.winner });
    if (st.spec.places[1]) out.push({ place: st.spec.places[1], teamId: st.loser });
  }
  return out.sort((a, b) => a.place - b.place);
};

/** True when every preliminary game of the tier has a confirmed score. */
export const prelimComplete = (schedule: TournamentSchedule | null | undefined, games: Game[], tier: Tier): { done: number; total: number } => {
  const ms = (schedule?.matches ?? []).filter(m => { const i = playoffMatchInfo(m); return i && i.round === PRELIM_ROUND && i.tier === tier; });
  return { done: ms.filter(m => !!confirmedOf(games, m)).length, total: ms.length };
};
