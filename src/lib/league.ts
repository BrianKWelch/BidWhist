/**
 * League play — season generator, match builder and standings.
 *
 * A league is a tournament whose `rotationType` is `'league'`. Every week the
 * registered teams are split into two rooms (Side A and Side B). Inside a room
 * every team plays every other team once, plus one extra game against one
 * designated opponent, so a 10-team room gives each team 10 games. There is no
 * play order and no table assignment: any two teams in the same room that are
 * both free play each other.
 *
 * Storage (no schema changes): league matches live in the normal `matches`
 * table with `round` = week number and `table_number` = 1 for Side A or 2 for
 * Side B. Match ids are `${tournamentId}-s${tag}-w${week}-${side}${n}` where
 * `tag` is unique per generation, so a regenerated season never reuses an id
 * that old score rows point at. The number of
 * weeks is stored in the tournament's `malt_rounds` column (the same "total
 * rounds planned" slot MALT uses). Scores go through the normal `games` table.
 */

import type { Game, ScheduleMatch, Team, Tournament, TournamentSchedule } from '@/contexts/AppContext';

export type LeagueSide = 'A' | 'B';

export interface LeaguePairing {
  teamA: string;
  teamB: string;
  /** null in an open-play week (no sides). */
  side: LeagueSide | null;
  /** 1 for the regular game, 2 for the extra "play them twice" game. */
  gameNo: 1 | 2;
}

export interface LeagueWeek {
  week: number;
  sideA: string[];
  sideB: string[];
  pairings: LeaguePairing[];
  /** Open play: no sides, teams played whoever they liked (e.g. a hand-scored first week). */
  open?: boolean;
  /** Every team that appears in the week (open weeks have no side lists). */
  teams?: string[];
}

export interface LeagueSeason {
  weeks: LeagueWeek[];
  /** games[i][j] = number of games team i and team j play across the season. */
  pairGames: Record<string, Record<string, number>>;
  stats: {
    minPairGames: number;
    maxPairGames: number;
    minRoomShares: number;
    maxRoomShares: number;
    sideImbalance: number; // largest |A weeks - B weeks| for any team
  };
}

export const SIDE_TABLE: Record<LeagueSide, number> = { A: 1, B: 2 };
/** table_number used for open-play weeks and one-sided makeup games (no side). */
export const OPEN_TABLE = 0;
/** Games every team owes in a week; used to count makeups in an open week. */
export const LEAGUE_GAMES_PER_WEEK = 10;

/** The number players know a team by: team_number when set, else the id. */
export const leagueTeamNo = (teams: Team[], id: string): string => {
  const t = teams.find(tt => String(tt.id) === String(id));
  return String(t?.teamNumber ?? id);
};

export const isLeagueTournament = (t?: Tournament | null): boolean => t?.rotationType === 'league';

export const leagueWeeksOf = (t?: Tournament | null): number => Number(t?.maltRounds) || 0;

/**
 * Parse a league match back into week, side, game number and (for one-sided
 * makeup games) the only team whose record it counts toward.
 * Side comes from table_number (1 = A, 2 = B, 0 = open play / makeup).
 * Makeup ids end in `-for<teamId>`; the second game of a pair ends in `x2`.
 */
export const leagueMatchInfo = (m: ScheduleMatch): { week: number; side: LeagueSide | null; gameNo: 1 | 2; countsFor: string | null } => {
  const side: LeagueSide | null = m.table === 2 ? 'B' : m.table === 1 ? 'A' : null;
  const gameNo: 1 | 2 = /-(A|B)\d+x2$/.test(m.id) ? 2 : 1;
  // Everything after the last '-for' is the owing team's id (ids may themselves contain dashes).
  const at = m.id.lastIndexOf('-for');
  const countsFor = at >= 0 ? m.id.slice(at + 4) : null;
  return { week: m.round, side, gameNo, countsFor: countsFor || null };
};

/** A game that counts for one team only (a makeup for a team that missed the week). */
export const isOneSidedMatch = (m: ScheduleMatch) => leagueMatchInfo(m).countsFor !== null;

// ---------------------------------------------------------------------------
// Random helpers (seeded so a generation can be reproduced from its seed)
// ---------------------------------------------------------------------------

const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffle = <T,>(arr: T[], rnd: () => number): T[] => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ---------------------------------------------------------------------------
// Perfect matchings of a small set (used to pick the "play twice" pairs)
// ---------------------------------------------------------------------------

/**
 * Enumerates every way to pair up the indices of `items`. For an odd count one
 * item is left out (every "leave one out" variant is enumerated). 10 items
 * gives 945 matchings, cheap to brute force.
 */
const allMatchings = (n: number): number[][][] => {
  const out: number[][][] = [];
  const rec = (remaining: number[], acc: number[][]) => {
    if (remaining.length < 2) { out.push(acc); return; }
    const [first, ...rest] = remaining;
    for (let i = 0; i < rest.length; i++) {
      const partner = rest[i];
      const next = rest.filter((_, k) => k !== i);
      rec(next, [...acc, [first, partner]]);
    }
  };
  const idx = Array.from({ length: n }, (_, i) => i);
  if (n % 2 === 0) {
    rec(idx, []);
  } else {
    for (let skip = 0; skip < n; skip++) rec(idx.filter(i => i !== skip), []);
  }
  return out;
};

const matchingCache = new Map<number, number[][][]>();
const matchingsFor = (n: number) => {
  if (!matchingCache.has(n)) matchingCache.set(n, allMatchings(n));
  return matchingCache.get(n)!;
};

// ---------------------------------------------------------------------------
// Season generation
// ---------------------------------------------------------------------------
//
// Phase 1 decides the rooms for every week at once. The whole season is one
// search state (a partition per week); a move swaps one team from Side A with
// one from Side B in a single week. The cost penalises pairs that share a room
// far more or far less often than average (quadratic + quartic, so extremes
// hurt most) plus a strong penalty for teams that sit on one side too often,
// which keeps every team at 4 or 5 weeks per side over a 9-week season.
// Deltas are computed exactly in O(n), so hundreds of thousands of moves are
// cheap. For 20 teams over 9 weeks the arithmetic floor is that some pairs
// share a room 2 times and some 6; the "play twice" pass below then tops up
// the pairs that met least.
//
// Phase 2 picks the "play twice" pairs. Inside a room every perfect matching
// is enumerated (945 for 10 teams) and the one that best evens out the total
// games-between-pairs is kept; a few sweeps over all weeks let later choices
// improve earlier ones.

interface SeasonState {
  n: number;
  weeks: number;
  sides: number[][];          // sides[w][i] = 0 for A, 1 for B
  room: number[][];           // room[i][j] = weeks i and j shared a room
  sideA: number[];            // weeks each team has spent on Side A
  pen: number[];              // pen[v] = penalty for a pair sharing a room v times
  sideWeight: number;
}

/**
 * Penalty table for pair room-share counts. Quadratic keeps the total spread
 * down; the quartic term squeezes the extremes (a pair at 7 hurts far more
 * than two pairs at 5).
 */
const penaltyTable = (n: number, weeks: number): number[] => {
  const mean = (weeks * (n / 2 - 1)) / (n - 1);
  return Array.from({ length: weeks + 1 }, (_, v) => (v - mean) ** 2 + (v - mean) ** 4);
};

const initState = (n: number, weeks: number, rnd: () => number): SeasonState => {
  const half = n / 2;
  const sides: number[][] = [];
  const room = Array.from({ length: n }, () => Array(n).fill(0));
  const sideA = Array(n).fill(0);
  for (let w = 0; w < weeks; w++) {
    const order = shuffle(Array.from({ length: n }, (_, i) => i), rnd);
    const s = Array(n).fill(1);
    for (let k = 0; k < half; k++) s[order[k]] = 0;
    sides.push(s);
    for (let i = 0; i < n; i++) {
      if (s[i] === 0) sideA[i]++;
      for (let j = i + 1; j < n; j++) if (s[i] === s[j]) { room[i][j]++; room[j][i]++; }
    }
  }
  return { n, weeks, sides, room, sideA, pen: penaltyTable(n, weeks), sideWeight: SIDE_WEIGHT };
};

const SIDE_WEIGHT = 30;

/** Exact cost change of swapping x (Side A) with y (Side B) in week w. */
const swapDelta = (st: SeasonState, w: number, x: number, y: number): number => {
  const s = st.sides[w];
  const pen = st.pen;
  let d = 0;
  for (let k = 0; k < st.n; k++) {
    if (k === x || k === y) continue;
    const rx = st.room[x][k], ry = st.room[y][k];
    if (s[k] === 0) {
      // k stays on A: loses x, gains y
      d += pen[rx - 1] - pen[rx] + pen[ry + 1] - pen[ry];
    } else {
      // k stays on B: gains x, loses y
      d += pen[rx + 1] - pen[rx] + pen[ry - 1] - pen[ry];
    }
  }
  const target = st.weeks / 2;
  const sx = st.sideA[x], sy = st.sideA[y];
  d += st.sideWeight * (((sx - 1 - target) ** 2 - (sx - target) ** 2) + ((sy + 1 - target) ** 2 - (sy - target) ** 2));
  return d;
};

const applySwap = (st: SeasonState, w: number, x: number, y: number) => {
  const s = st.sides[w];
  for (let k = 0; k < st.n; k++) {
    if (k === x || k === y) continue;
    if (s[k] === 0) {
      st.room[x][k]--; st.room[k][x]--;
      st.room[y][k]++; st.room[k][y]++;
    } else {
      st.room[x][k]++; st.room[k][x]++;
      st.room[y][k]--; st.room[k][y]--;
    }
  }
  s[x] = 1; s[y] = 0;
  st.sideA[x]--; st.sideA[y]++;
};

/**
 * Simulated annealing over the whole season: pick a week, a team on each side,
 * and swap them; accept improvements always and worsenings with probability
 * exp(-delta/T) while T cools. Finishes with a pure descent so the result is a
 * local minimum. `iterations` of ~150k takes well under a second.
 */
const optimiseRooms = (st: SeasonState, rnd: () => number, iterations: number) => {
  const n = st.n;
  const tStart = 4, tEnd = 0.05;
  const cool = Math.pow(tEnd / tStart, 1 / Math.max(1, iterations));
  let temperature = tStart;
  for (let it = 0; it < iterations; it++) {
    const w = Math.floor(rnd() * st.weeks);
    const s = st.sides[w];
    let x = Math.floor(rnd() * n);
    let y = Math.floor(rnd() * n);
    if (s[x] === s[y]) { temperature *= cool; continue; }
    if (s[x] === 1) { const t = x; x = y; y = t; }
    const d = swapDelta(st, w, x, y);
    if (d <= 0 || rnd() < Math.exp(-d / temperature)) applySwap(st, w, x, y);
    temperature *= cool;
  }
  // Final pure descent so we end in a local minimum.
  let improved = true;
  while (improved) {
    improved = false;
    for (let w = 0; w < st.weeks; w++) {
      const s = st.sides[w];
      for (let x = 0; x < n; x++) {
        if (s[x] !== 0) continue;
        for (let y = 0; y < n; y++) {
          if (s[y] !== 1) continue;
          if (swapDelta(st, w, x, y) < -1e-9) { applySwap(st, w, x, y); improved = true; }
        }
      }
    }
  }
};

const roomCost = (st: SeasonState): number => {
  let c = 0;
  for (let i = 0; i < st.n; i++) for (let j = i + 1; j < st.n; j++) c += st.pen[st.room[i][j]];
  const target = st.weeks / 2;
  for (let i = 0; i < st.n; i++) c += st.sideWeight * (st.sideA[i] - target) ** 2;
  return c;
};

const stateFromSides = (sides: number[][]): SeasonState => {
  const weeks = sides.length, n = sides[0].length;
  const room = Array.from({ length: n }, () => Array(n).fill(0));
  const sideA = Array(n).fill(0);
  for (const s of sides) {
    for (let i = 0; i < n; i++) {
      if (s[i] === 0) sideA[i]++;
      for (let j = i + 1; j < n; j++) if (s[i] === s[j]) { room[i][j]++; room[j][i]++; }
    }
  }
  return { n, weeks, sides, room, sideA, pen: penaltyTable(n, weeks), sideWeight: SIDE_WEIGHT };
};

/** Best perfect matching of `room` given current games[][] (lowest sum of squared totals). */
const bestMatching = (room: number[], games: number[][], rnd: () => number): [number, number][] => {
  const matchings = matchingsFor(room.length);
  let bestCost = Infinity;
  let best: number[][][] = [];
  for (const m of matchings) {
    let c = 0;
    for (const [x, y] of m) c += (games[room[x]][room[y]] + 1) ** 2;
    if (c < bestCost - 1e-9) { bestCost = c; best = [m]; }
    else if (Math.abs(c - bestCost) < 1e-9) best.push(m);
  }
  const chosen = best[Math.floor(rnd() * best.length)];
  return chosen.map(([x, y]) => [room[x], room[y]] as [number, number]);
};

const buildSeasonOnce = (teamIds: string[], weeks: number, seed: number, startWeek = 1): LeagueSeason => {
  const n = teamIds.length;
  const rnd = mulberry32(seed);

  // Phase 1: rooms.
  const st = initState(n, weeks, rnd);
  optimiseRooms(st, rnd, 300000);

  const rooms: { a: number[]; b: number[] }[] = st.sides.map(s => {
    const a: number[] = [], b: number[] = [];
    for (let i = 0; i < n; i++) (s[i] === 0 ? a : b).push(i);
    return { a, b };
  });

  // Phase 2: doubles.
  const games = st.room.map(r => r.slice());
  const doubles: [number, number][][][] = rooms.map(() => [[], []]);
  for (let pass = 0; pass < 4; pass++) {
    for (let w = 0; w < weeks; w++) {
      [rooms[w].a, rooms[w].b].forEach((room, side) => {
        // Remove this room's current doubles, then re-pick given everything else.
        for (const [x, y] of doubles[w][side]) { games[x][y]--; games[y][x]--; }
        const m = bestMatching(room, games, rnd);
        for (const [x, y] of m) { games[x][y]++; games[y][x]++; }
        doubles[w][side] = m;
      });
    }
  }

  const out: LeagueWeek[] = [];
  for (let w = 0; w < weeks; w++) {
    const pairings: LeaguePairing[] = [];
    const addRoom = (room: number[], side: LeagueSide, dbl: [number, number][]) => {
      for (let i = 0; i < room.length; i++) {
        for (let j = i + 1; j < room.length; j++) {
          pairings.push({ teamA: teamIds[room[i]], teamB: teamIds[room[j]], side, gameNo: 1 });
        }
      }
      for (const [x, y] of dbl) pairings.push({ teamA: teamIds[x], teamB: teamIds[y], side, gameNo: 2 });
    };
    addRoom(rooms[w].a, 'A', doubles[w][0]);
    addRoom(rooms[w].b, 'B', doubles[w][1]);
    out.push({
      week: startWeek + w,
      sideA: rooms[w].a.map(i => teamIds[i]).sort(byTeamId),
      sideB: rooms[w].b.map(i => teamIds[i]).sort(byTeamId),
      pairings,
    });
  }

  // Stats
  let minPair = Infinity, maxPair = -Infinity, minRoom = Infinity, maxRoom = -Infinity;
  const pairGames: Record<string, Record<string, number>> = {};
  for (let i = 0; i < n; i++) {
    pairGames[teamIds[i]] = {};
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      pairGames[teamIds[i]][teamIds[j]] = games[i][j];
      if (j > i) {
        minPair = Math.min(minPair, games[i][j]);
        maxPair = Math.max(maxPair, games[i][j]);
        minRoom = Math.min(minRoom, st.room[i][j]);
        maxRoom = Math.max(maxRoom, st.room[i][j]);
      }
    }
  }
  let sideImbalance = 0;
  for (let i = 0; i < n; i++) sideImbalance = Math.max(sideImbalance, Math.abs(st.sideA[i] - (weeks - st.sideA[i])));

  return {
    weeks: out,
    pairGames,
    stats: { minPairGames: minPair, maxPairGames: maxPair, minRoomShares: minRoom, maxRoomShares: maxRoom, sideImbalance },
  };
};

const byTeamId = (x: string, y: string) => {
  const nx = Number(x), ny = Number(y);
  if (!isNaN(nx) && !isNaN(ny)) return nx - ny;
  return x.localeCompare(y);
};

const seasonScore = (s: LeagueSeason): number => {
  // Lower is better: spread of games between pairs first, then room-share spread, then side balance.
  const spread = s.stats.maxPairGames - s.stats.minPairGames;
  const roomSpread = s.stats.maxRoomShares - s.stats.minRoomShares;
  return spread * 100 + roomSpread * 10 + s.stats.sideImbalance;
};

/**
 * Generates a full league season. Runs several randomized attempts and keeps
 * the most balanced one (smallest spread in games-between-pairs, then in
 * room-shares, then in A/B side balance).
 *
 * Requires an even number of teams so the two sides are the same size. Works
 * for any even count; with an odd room size (e.g. 18 teams -> 9 per room) one
 * team per room has no extra game that week.
 */
export const generateLeagueSeason = (
  teamIds: string[],
  weeks: number,
  options: { attempts?: number; seed?: number; startWeek?: number } = {},
): LeagueSeason => {
  if (teamIds.length < 4) throw new Error('A league needs at least 4 teams.');
  if (teamIds.length % 2 !== 0) throw new Error('A league needs an even number of teams so both sides are the same size.');
  if (weeks < 1) throw new Error('A league needs at least 1 week.');

  const attempts = options.attempts ?? 12;
  const baseSeed = options.seed ?? (Date.now() & 0x7fffffff);
  let best: LeagueSeason | null = null;
  let bestScore = Infinity;
  for (let k = 0; k < attempts; k++) {
    const s = buildSeasonOnce(teamIds, weeks, baseSeed + k * 7919, options.startWeek ?? 1);
    const sc = seasonScore(s);
    if (sc < bestScore) { bestScore = sc; best = s; }
  }
  return best!;
};

// ---------------------------------------------------------------------------
// Matches <-> season
// ---------------------------------------------------------------------------

/** Turns a generated season into `matches` rows for the tournament. */
export const buildLeagueMatches = (tournamentId: string, season: LeagueSeason, tag: string = Date.now().toString(36)): ScheduleMatch[] => {
  const out: ScheduleMatch[] = [];
  for (const wk of season.weeks) {
    const counter: Record<LeagueSide, number> = { A: 0, B: 0 };
    for (const p of wk.pairings) {
      counter[p.side ?? 'A']++;
      const side = p.side ?? 'A';
      const id = `${tournamentId}-s${tag}-w${wk.week}-${side}${counter[side]}${p.gameNo === 2 ? 'x2' : ''}`;
      out.push({
        id,
        teamA: p.teamA,
        teamB: p.teamB,
        round: wk.week,
        tournamentId,
        table: p.side ? SIDE_TABLE[p.side] : OPEN_TABLE,
        isBye: false,
        isSameCity: false,
      });
    }
  }
  return out;
};

/** Rebuilds the week-by-week side grid from stored matches. */
export const leagueWeeksFromSchedule = (schedule?: TournamentSchedule | null): LeagueWeek[] => {
  if (!schedule) return [];
  const byWeek = new Map<number, LeagueWeek>();
  const sorted = schedule.matches.slice().sort((x, y) => x.round - y.round || x.id.localeCompare(y.id));
  for (const m of sorted) {
    const { week, side, gameNo, countsFor } = leagueMatchInfo(m);
    if (!byWeek.has(week)) byWeek.set(week, { week, sideA: [], sideB: [], pairings: [], teams: [] });
    const wk = byWeek.get(week)!;
    if (side) {
      const list = side === 'A' ? wk.sideA : wk.sideB;
      for (const t of [m.teamA, m.teamB]) if (!list.includes(t)) list.push(t);
    } else if (!countsFor) {
      // A sideless game that is not a makeup means the week itself is open play.
      wk.open = true;
    }
    for (const t of [m.teamA, m.teamB]) if (!wk.teams!.includes(t)) wk.teams!.push(t);
    wk.pairings.push({ teamA: m.teamA, teamB: m.teamB, side, gameNo });
  }
  const weeks = Array.from(byWeek.values()).sort((x, y) => x.week - y.week);
  for (const wk of weeks) { wk.sideA.sort(byTeamId); wk.sideB.sort(byTeamId); wk.teams!.sort(byTeamId); }
  return weeks;
};

export const teamSideForWeek = (weeks: LeagueWeek[], teamId: string, week: number): LeagueSide | null => {
  const wk = weeks.find(w => w.week === week);
  if (!wk) return null;
  if (wk.sideA.includes(teamId)) return 'A';
  if (wk.sideB.includes(teamId)) return 'B';
  return null;
};

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

export interface LeagueStandingRow {
  teamId: string;
  teamNumber: number;
  teamName: string;
  wins: number;
  losses: number;
  played: number;
  points: number;
  pointsAgainst: number;
  hands: number;
  bostons: number;
  /** per-week breakdown */
  weeks: Record<number, { wins: number; losses: number; points: number; bostons: number; side: LeagueSide | null }>;
  rank: number;
}

const isConfirmed = (g: Game) => Boolean(g.confirmed) || g.status === 'confirmed';

/** A game row belongs to a match only if it is for the same two teams (guards against stale rows). */
export const gameBelongsToMatch = (g: Game, m: ScheduleMatch): boolean => {
  if (String(g.matchId) !== m.id) return false;
  const a = String(g.teamA), b = String(g.teamB), ma = String(m.teamA), mb = String(m.teamB);
  return (a === ma && b === mb) || (a === mb && b === ma);
};

/**
 * Cumulative standings for a league. Sort: wins, then points, then team number.
 * Only confirmed games count. `throughWeek` limits the standings to weeks <= N.
 */
export const getLeagueStandings = (
  teams: Team[],
  games: Game[],
  schedule: TournamentSchedule | null | undefined,
  throughWeek?: number,
): LeagueStandingRow[] => {
  if (!schedule) return [];
  const weeks = leagueWeeksFromSchedule(schedule);
  const matchById = new Map(schedule.matches.map(m => [m.id, m]));
  const teamIds = new Set<string>();
  schedule.matches.forEach(m => { teamIds.add(String(m.teamA)); teamIds.add(String(m.teamB)); });

  const rows = new Map<string, LeagueStandingRow>();
  for (const id of teamIds) {
    const t = teams.find(tt => String(tt.id) === id);
    const row: LeagueStandingRow = {
      teamId: id,
      teamNumber: Number(t?.teamNumber ?? id) || 0,
      teamName: t?.name ?? `Team ${id}`,
      wins: 0, losses: 0, played: 0, points: 0, pointsAgainst: 0, hands: 0, bostons: 0,
      weeks: {},
      rank: 0,
    };
    for (const wk of weeks) {
      row.weeks[wk.week] = { wins: 0, losses: 0, points: 0, bostons: 0, side: teamSideForWeek(weeks, id, wk.week) };
    }
    rows.set(id, row);
  }

  for (const g of games) {
    if (!isConfirmed(g) || !g.matchId) continue;
    const m = matchById.get(String(g.matchId));
    if (!m || !gameBelongsToMatch(g, m)) continue;
    if (throughWeek && m.round > throughWeek) continue;
    const a = rows.get(String(g.teamA));
    const b = rows.get(String(g.teamB));
    if (!a || !b) continue;
    const scoreA = Number(g.scoreA) || 0, scoreB = Number(g.scoreB) || 0;
    const aWon = g.winner === 'teamA';
    const { countsFor } = leagueMatchInfo(m);
    const apply = (row: LeagueStandingRow, my: number, opp: number, won: boolean, hands: number, bostons: number) => {
      row.played++;
      row.points += my;
      row.pointsAgainst += opp;
      row.hands += hands;
      row.bostons += bostons;
      if (won) row.wins++; else row.losses++;
      const wk = row.weeks[m.round] ?? (row.weeks[m.round] = { wins: 0, losses: 0, points: 0, bostons: 0, side: null });
      wk.points += my;
      wk.bostons += bostons;
      if (won) wk.wins++; else wk.losses++;
    };
    // A one-sided makeup counts only for the team that owed the game.
    if (!countsFor || countsFor === String(g.teamA)) apply(a, scoreA, scoreB, aWon, Number(g.handsA) || 0, Number(g.boston_a) || 0);
    if (!countsFor || countsFor === String(g.teamB)) apply(b, scoreB, scoreA, !aWon, Number(g.handsB) || 0, Number(g.boston_b) || 0);
  }

  const list = Array.from(rows.values()).sort((x, y) =>
    y.wins - x.wins || y.points - x.points || x.teamNumber - y.teamNumber,
  );
  list.forEach((r, i) => { r.rank = i + 1; });
  return list;
};

export interface LeagueLeader {
  value: number;
  /** Every team tied at the top value. Empty when nothing has been scored yet. */
  teams: { teamId: string; teamName: string }[];
}

export interface LeagueLeaders {
  wins: LeagueLeader;
  points: LeagueLeader;
  bostons: LeagueLeader;
}

const topOf = (rows: LeagueStandingRow[], pick: (r: LeagueStandingRow) => number): LeagueLeader => {
  let value = 0;
  for (const r of rows) value = Math.max(value, pick(r));
  if (value <= 0) return { value: 0, teams: [] };
  return {
    value,
    teams: rows.filter(r => pick(r) === value).sort((x, y) => x.teamNumber - y.teamNumber).map(r => ({ teamId: String(r.teamNumber || r.teamId), teamName: r.teamName })),
  };
};

/** Season leaders in wins, points and Bostons (ties list every tied team). */
export const leagueSeasonLeaders = (rows: LeagueStandingRow[]): LeagueLeaders => ({
  wins: topOf(rows, r => r.wins),
  points: topOf(rows, r => r.points),
  bostons: topOf(rows, r => r.bostons),
});

/** Leaders for one week only. */
export const leagueWeekLeaders = (rows: LeagueStandingRow[], week: number): LeagueLeaders => ({
  wins: topOf(rows, r => r.weeks[week]?.wins ?? 0),
  points: topOf(rows, r => r.weeks[week]?.points ?? 0),
  bostons: topOf(rows, r => r.weeks[week]?.bostons ?? 0),
});

/** First week that still has an unconfirmed game (for the whole league, or for one team). */
/** Marker stored in games.submittedBy for a no-show forfeit. */
export const FORFEIT_MARK = 'forfeit';
export const FORFEIT_WIN_POINTS = 3;
export const isForfeitGame = (g: Game | undefined) => !!g && String(g.submittedBy) === FORFEIT_MARK;

/**
 * The week the league is actually playing: the latest week with any confirmed
 * score (or week 1). Makeup games from earlier weeks do not pull this back.
 */
export const leagueLiveWeek = (schedule: TournamentSchedule | null | undefined, games: Game[]): number => {
  if (!schedule || schedule.matches.length === 0) return 1;
  const byId = new Map(schedule.matches.map(m => [m.id, m]));
  let live = 0;
  for (const g of games) {
    if (!isConfirmed(g)) continue;
    const m = byId.get(String(g.matchId));
    if (m && gameBelongsToMatch(g, m)) live = Math.max(live, m.round);
  }
  return live || 1;
};

/** A team's still-open games in weeks before `beforeWeek` (its makeups), grouped by week. */
export const teamMakeupGames = (schedule: TournamentSchedule | null | undefined, games: Game[], teamId: string, beforeWeek: number): { week: number; count: number; open: boolean }[] => {
  if (!schedule) return [];
  const weeks = leagueWeeksFromSchedule(schedule);
  const out = new Map<number, { count: number; open: boolean }>();
  for (const wk of weeks) {
    if (wk.week >= beforeWeek) continue;
    const mine = schedule.matches.filter(m => m.round === wk.week && (String(m.teamA) === teamId || String(m.teamB) === teamId));
    const countsForMe = (m: ScheduleMatch) => { const c = leagueMatchInfo(m).countsFor; return !c || c === teamId; };
    if (wk.open) {
      // Open week: a team owes LEAGUE_GAMES_PER_WEEK games and may play anyone (as makeups).
      const played = mine.filter(m => countsForMe(m) && games.some(g => isConfirmed(g) && gameBelongsToMatch(g, m))).length;
      const owed = Math.max(0, LEAGUE_GAMES_PER_WEEK - played);
      if (owed > 0) out.set(wk.week, { count: owed, open: true });
    } else {
      const open = mine.filter(m => countsForMe(m) && !games.some(g => isConfirmed(g) && gameBelongsToMatch(g, m))).length;
      if (open > 0) out.set(wk.week, { count: open, open: false });
    }
  }
  return Array.from(out.entries()).map(([week, v]) => ({ week, ...v })).sort((x, y) => x.week - y.week);
};

/** Matches for a hand-scored open-play week (no sides). */
export const buildOpenWeekMatches = (tournamentId: string, week: number, pairs: { teamA: string; teamB: string }[], tag: string = Date.now().toString(36)): ScheduleMatch[] =>
  pairs.map((p, i) => ({
    id: `${tournamentId}-s${tag}-w${week}-O${i + 1}`,
    teamA: p.teamA, teamB: p.teamB, round: week, tournamentId, table: OPEN_TABLE, isBye: false, isSameCity: false,
  }));

/** A one-sided makeup match: `forTeam` owes the game; the result counts for `forTeam` only. */
export const buildMakeupMatch = (tournamentId: string, week: number, forTeam: string, opponent: string): ScheduleMatch => ({
  id: `${tournamentId}-w${week}-mk${Date.now().toString(36)}-for${forTeam}`,
  teamA: forTeam, teamB: opponent, round: week, tournamentId, table: OPEN_TABLE, isBye: false, isSameCity: false,
});

/** Weeks that must be kept when (re)generating: open-play weeks and any week with a confirmed score. */
export const lockedLeagueWeeks = (schedule: TournamentSchedule | null | undefined, games: Game[]): number[] => {
  if (!schedule) return [];
  const weeks = leagueWeeksFromSchedule(schedule);
  const confirmedIds = new Set(games.filter(isConfirmed).map(g => String(g.matchId)));
  return weeks.filter(w => w.open || schedule.matches.some(m => m.round === w.week && confirmedIds.has(m.id))).map(w => w.week);
};

/**
 * Rows to write for a no-show: every unplayed game of `teamId` in `week` becomes
 * a confirmed loss, opponent credited with the win and FORFEIT_WIN_POINTS.
 */
export const buildForfeitRows = (schedule: TournamentSchedule, games: Game[], teamId: string, week: number) => {
  const rows: Record<string, unknown>[] = [];
  const stamp = Date.now();
  let n = 0;
  for (const m of schedule.matches) {
    if (m.round !== week) continue;
    if (String(m.teamA) !== teamId && String(m.teamB) !== teamId) continue;
    if (games.some(g => isConfirmed(g) && gameBelongsToMatch(g, m))) continue;
    const forfeitIsA = String(m.teamA) === teamId;
    rows.push({
      id: `${stamp}${String(n++).padStart(3, '0')}`,
      matchId: m.id,
      teamA: String(m.teamA),
      teamB: String(m.teamB),
      scoreA: forfeitIsA ? 0 : FORFEIT_WIN_POINTS,
      scoreB: forfeitIsA ? FORFEIT_WIN_POINTS : 0,
      handsA: 0, handsB: 0, boston_a: 0, boston_b: 0,
      winner: forfeitIsA ? 'teamB' : 'teamA',
      submittedBy: FORFEIT_MARK,
      confirmed: true,
      confirmedBy: 'admin',
      round: week,
      timestamp: new Date().toISOString(),
      status: 'confirmed',
      entered_by_team_id: null,
    });
  }
  return rows;
};

export const currentLeagueWeek = (schedule: TournamentSchedule | null | undefined, games: Game[], teamId?: string): number => {
  if (!schedule || schedule.matches.length === 0) return 1;
  const confirmedMatchIds = new Set(games.filter(isConfirmed).map(g => String(g.matchId)));
  const weeks = Array.from(new Set(schedule.matches.map(m => m.round))).sort((a, b) => a - b);
  for (const w of weeks) {
    const ms = schedule.matches.filter(m => m.round === w && (!teamId || String(m.teamA) === teamId || String(m.teamB) === teamId));
    if (ms.some(m => !confirmedMatchIds.has(m.id))) return w;
  }
  return weeks[weeks.length - 1];
};

/** CSV of the side grid: one row per team, one column per week. */
export const leagueGridCsv = (weeks: LeagueWeek[], teams: Team[]): string => {
  const ids = new Set<string>();
  weeks.forEach(w => { w.sideA.forEach(t => ids.add(t)); w.sideB.forEach(t => ids.add(t)); (w.teams ?? []).forEach(t => ids.add(t)); });
  const sorted = Array.from(ids).sort(byTeamId);
  const header = ['Team #', 'Team', ...weeks.map(w => `Week ${w.week}`)];
  const lines = [header.join(',')];
  for (const id of sorted) {
    const t = teams.find(tt => String(tt.id) === id);
    const name = (t?.name ?? '').replace(/"/g, '""');
    lines.push([leagueTeamNo(teams, id), `"${name}"`, ...weeks.map(w => w.open ? 'open' : (teamSideForWeek(weeks, id, w.week) ?? ''))].join(','));
  }
  return lines.join('\n');
};

/** Internal hooks for the balance test harness; not used by the app. */
export const __leagueDebug = { initState, optimiseRooms, roomCost, swapDelta, applySwap, mulberry32 };
