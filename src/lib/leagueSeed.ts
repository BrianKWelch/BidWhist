/**
 * One-shot loader for a hand-scored league week (the 2026 Fall Week 1 sheet).
 *
 * The data file lists the teams by their league number and every game as it
 * was played (open play, no sides). Loading is idempotent: teams are matched
 * by team_number (then by name) before anything is created, match and game
 * ids are deterministic, and existing rows are left alone.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Team, TournamentSchedule } from '@/contexts/AppContext';
import { buildOpenWeekMatches } from '@/lib/league';

export interface SeedTeam { no: number; name: string; player1: string; player2: string; members: string }
export interface SeedGame { a: number; b: number; ptsA: number; ptsB: number; bosA: number; bosB: number; winner: 'a' | 'b' }
export interface SeedWeekData {
  season: string;
  week: number;
  sourceFile: string;
  notes: string[];
  teams: SeedTeam[];
  games: SeedGame[];
}

export interface SeedResult {
  teamsCreated: number;
  teamsMatched: number;
  registrationsAdded: number;
  matchesInserted: number;
  gamesInserted: number;
  skipped: number;
}

const splitName = (full: string): { first: string; last: string } => {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return { first: full.trim(), last: '' };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
};

/** Creates a league tournament row and returns its id. */
export const createLeagueTournament = async (supabase: SupabaseClient, name: string, weeks: number, status: 'active' | 'pending'): Promise<string> => {
  const { data, error } = await supabase
    .from('tournaments')
    .insert([{ name, status, cost: 0, boston_pot_cost: 0, tracks_hands: false, scoring_mode: 'team', rotation_type: 'league', malt_rounds: weeks, sort_order: 'wins,points,hands' }])
    .select()
    .single();
  if (error) throw new Error(`Create league: ${error.message}`);
  return String(data.id);
};

/**
 * Loads one hand-scored week into the league: makes sure every team exists
 * and is registered, then writes the games as confirmed results.
 */
export const loadSeedWeek = async (
  supabase: SupabaseClient,
  tournamentId: string,
  existingTeams: Team[],
  existingSchedule: TournamentSchedule | null | undefined,
  data: SeedWeekData,
  onProgress?: (msg: string) => void,
): Promise<SeedResult> => {
  const result: SeedResult = { teamsCreated: 0, teamsMatched: 0, registrationsAdded: 0, matchesInserted: 0, gamesInserted: 0, skipped: 0 };
  const idByNo = new Map<number, string>();

  // 1. Teams: match by team number, then by exact name; create the rest.
  for (const st of data.teams) {
    onProgress?.(`Team ${st.no}: ${st.name}`);
    let team = existingTeams.find(t => Number(t.teamNumber) === st.no && t.registeredTournaments?.includes(tournamentId))
      ?? existingTeams.find(t => Number(t.teamNumber) === st.no)
      ?? existingTeams.find(t => (t.name || '').trim().toUpperCase() === st.name.trim().toUpperCase());
    if (team) {
      result.teamsMatched++;
      if (Number(team.teamNumber) !== st.no) {
        const { error } = await supabase.from('teams').update({ team_number: st.no }).eq('id', team.id);
        if (error) throw new Error(`Team ${st.no} number: ${error.message}`);
      }
    } else {
      const p1 = splitName(st.player1), p2 = splitName(st.player2);
      const { data: p1Row, error: e1 } = await supabase.from('players').insert([{ first_name: p1.first, last_name: p1.last, phone_number: null, city: null }]).select().single();
      if (e1) throw new Error(`Player ${st.player1}: ${e1.message}`);
      const { data: p2Row, error: e2 } = await supabase.from('players').insert([{ first_name: p2.first, last_name: p2.last, phone_number: null, city: null }]).select().single();
      if (e2) throw new Error(`Player ${st.player2}: ${e2.message}`);
      const { data: tRow, error: e3 } = await supabase.from('teams').insert([{ name: st.name, player1_id: p1Row.id, player2_id: p2Row.id, team_number: st.no }]).select().single();
      if (e3) throw new Error(`Team ${st.name}: ${e3.message}`);
      team = { id: String(tRow.id), name: st.name, teamNumber: st.no, player1_id: p1Row.id, player2_id: p2Row.id, created_at: '', registeredTournaments: [] };
      result.teamsCreated++;
    }
    if (!team.registeredTournaments?.includes(tournamentId)) {
      const { data: reg } = await supabase.from('team_registrations').select('team_id').eq('team_id', team.id).eq('tournament_id', tournamentId);
      if (!reg || reg.length === 0) {
        const { error } = await supabase.from('team_registrations').insert([{ team_id: team.id, tournament_id: tournamentId }]);
        if (error) throw new Error(`Register team ${st.no}: ${error.message}`);
        result.registrationsAdded++;
      }
    }
    idByNo.set(st.no, String(team.id));
  }

  // 2. Matches for the open week (deterministic ids so a re-run is a no-op).
  const tag = `seedw${data.week}`;
  const pairs = data.games.map(g => ({ teamA: idByNo.get(g.a)!, teamB: idByNo.get(g.b)! }));
  const matches = buildOpenWeekMatches(tournamentId, data.week, pairs, tag);
  const existingIds = new Set((existingSchedule?.matches ?? []).map(m => m.id));
  const newMatches = matches.filter(m => !existingIds.has(m.id));
  if (newMatches.length > 0) {
    onProgress?.(`Writing ${newMatches.length} Week ${data.week} games`);
    const rows = newMatches.map(m => ({ id: m.id, team_a: m.teamA, team_b: m.teamB, round: m.round, tournament_id: tournamentId, table_number: m.table, is_bye: false, is_same_city: false }));
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supabase.from('matches').insert(rows.slice(i, i + 200));
      if (error) throw new Error(`Matches: ${error.message}`);
    }
    result.matchesInserted = newMatches.length;
  }

  // 3. Confirmed game rows.
  const { data: existingGames, error: gErr } = await supabase.from('games').select('matchId').in('matchId', matches.map(m => m.id));
  if (gErr) throw new Error(`Games lookup: ${gErr.message}`);
  const haveGame = new Set((existingGames ?? []).map((g: { matchId: string }) => String(g.matchId)));
  const gameRows = data.games.flatMap((g, i) => {
    const m = matches[i];
    if (haveGame.has(m.id)) { result.skipped++; return []; }
    return [{
      id: `${tag}-${tournamentId}-${i + 1}`,
      matchId: m.id,
      teamA: m.teamA,
      teamB: m.teamB,
      scoreA: g.ptsA,
      scoreB: g.ptsB,
      handsA: 0, handsB: 0,
      boston_a: g.bosA, boston_b: g.bosB,
      winner: g.winner === 'a' ? 'teamA' : 'teamB',
      submittedBy: 'import',
      confirmed: true,
      confirmedBy: 'admin',
      round: data.week,
      timestamp: new Date().toISOString(),
      status: 'confirmed',
      entered_by_team_id: null,
    }];
  });
  for (let i = 0; i < gameRows.length; i += 200) {
    const { error } = await supabase.from('games').insert(gameRows.slice(i, i + 200));
    if (error) throw new Error(`Games: ${error.message}`);
  }
  result.gamesInserted = gameRows.length;
  return result;
};
