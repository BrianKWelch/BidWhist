import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import type { Game, ScheduleMatch, Team, Tournament } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Trophy, Pencil, Trash2, Play, Flag } from 'lucide-react';
import { getLeagueStandings, leagueTeamNo, leagueWeeksOf } from '@/lib/league';
import {
  BRACKET_ROUND, PRELIM_GAMES_PER_TEAM, TIER_NAME,
  bracketMatchesToCreate, bracketPlacings, bracketState, buildDoubleRoundRobin, buildSkipRoundRobin,
  parsePlayoffConfig, playoffForLeague, playoffMatchInfo, prelimComplete, prelimStandings, serializePlayoffConfig,
  type PlayoffConfig, type SeriesState, type Tier,
} from '@/lib/playoff';
import { MatchScoreEditor, teamLabel } from '@/components/LeagueManager';

const BRAND = '#213A5B';
const CHAMPION_TIER_SIZE = 6;
const SECOND_TIER_ADVANCE = 4;

const matchRow = (pid: string, m: ScheduleMatch) => ({ id: m.id, team_a: m.teamA, team_b: m.teamB, round: m.round, tournament_id: pid, table_number: m.table ?? 0, is_bye: false, is_same_city: false });

const confirmedGame = (games: Game[], m: ScheduleMatch): Game | undefined =>
  games.filter(g => String(g.matchId) === m.id && (g.confirmed || g.status === 'confirmed')).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
const anyGame = (games: Game[], m: ScheduleMatch): Game | undefined => games.find(g => String(g.matchId) === m.id);

/**
 * Admin control for a league's playoffs: set the field from the final season
 * standings, generate the champion tier's preliminary games, seed and run the
 * best-of-three bracket. Lives in the League tab as its own sub-tab.
 */
const PlayoffManager: React.FC<{ league: Tournament }> = ({ league }) => {
  const { teams, tournaments, schedules, games, refreshSchedules, refreshGamesFromSupabase, refreshTournaments, refreshTeams } = useAppContext();
  const no = (id: string) => leagueTeamNo(teams, id);
  const playoff = useMemo(() => playoffForLeague(tournaments, league.id), [tournaments, league.id]);
  const cfg = useMemo(() => parsePlayoffConfig(playoff), [playoff]);
  const leagueSchedule = schedules.find(s => s.tournamentId === league.id) ?? null;
  const pSchedule = playoff ? schedules.find(s => s.tournamentId === playoff.id) ?? null : null;

  // Final season standings (weeks of the season only) decide the field and the season-finish tiebreak.
  const season = useMemo(() => getLeagueStandings(teams, games, leagueSchedule, leagueWeeksOf(league) || undefined), [teams, games, leagueSchedule, league]);
  const seasonRank = useMemo(() => Object.fromEntries(season.map(r => [r.teamId, r.rank])) as Record<string, number>, [season]);

  const [excluded, setExcluded] = useState<string[]>([]);
  useEffect(() => { if (cfg) setExcluded(cfg.excluded); }, [cfg]);
  const champField = cfg?.tiers[1] ?? season.slice(0, CHAMPION_TIER_SIZE).map(r => r.teamId);

  const [busy, setBusy] = useState(false);
  const [filterTeam, setFilterTeam] = useState<string>('');
  const [editing, setEditing] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  // ---- Actions -----------------------------------------------------------
  const saveConfig = async (next: PlayoffConfig) => {
    if (!playoff) return;
    const { supabase } = await import('../supabaseClient');
    const { error } = await supabase.from('tournaments').update({ description: serializePlayoffConfig(next) }).eq('id', playoff.id);
    if (error) throw new Error(error.message);
    await refreshTournaments();
  };

  const createPlayoffs = async () => {
    if (champField.length !== CHAMPION_TIER_SIZE) { toast({ title: `Need ${CHAMPION_TIER_SIZE} teams in the season standings`, variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const { supabase } = await import('../supabaseClient');
      const config: PlayoffConfig = { playoffOf: String(league.id), tiers: { 1: champField }, seeds: {}, excluded };
      const { data, error } = await supabase.from('tournaments')
        .insert([{ name: `${league.name} Playoffs`, status: 'pending', cost: 0, boston_pot_cost: 0, tracks_hands: false, scoring_mode: 'team', rotation_type: 'playoff', malt_rounds: 2, sort_order: 'wins,points,hands', description: serializePlayoffConfig(config) }])
        .select().single();
      if (error) throw new Error(error.message);
      const pid = String(data.id);
      const { error: regErr } = await supabase.from('team_registrations').insert(champField.map(team_id => ({ team_id, tournament_id: pid })));
      if (regErr) throw new Error(regErr.message);
      const rows = buildDoubleRoundRobin(pid, 1, champField).map(m => matchRow(pid, m));
      const { error: mErr } = await supabase.from('matches').insert(rows);
      if (mErr) throw new Error(mErr.message);
      await Promise.all([refreshTournaments(), refreshTeams(), refreshSchedules()]);
      toast({ title: 'Playoffs created', description: `${TIER_NAME[1]}: ${rows.length} preliminary games for teams ${champField.map(no).join(', ')}.` });
    } catch (e) {
      toast({ title: 'Could not create playoffs', description: String(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const secondTierField = useMemo(() => season.map(r => r.teamId).filter(id => !champField.includes(id) && !excluded.includes(id)), [season, champField, excluded]);
  const createSecondTier = async () => {
    if (!playoff || !cfg) return;
    setBusy(true);
    try {
      const rows = buildSkipRoundRobin(playoff.id, 2, secondTierField).map(m => matchRow(playoff.id, m));
      const { supabase } = await import('../supabaseClient');
      const { data: regs } = await supabase.from('team_registrations').select('team_id').eq('tournament_id', playoff.id);
      const have = new Set((regs ?? []).map((r: { team_id: string }) => String(r.team_id)));
      const toReg = secondTierField.filter(id => !have.has(id)).map(team_id => ({ team_id, tournament_id: playoff.id }));
      if (toReg.length) { const { error } = await supabase.from('team_registrations').insert(toReg); if (error) throw new Error(error.message); }
      const { error: mErr } = await supabase.from('matches').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
      if (mErr) throw new Error(mErr.message);
      await saveConfig({ ...cfg, tiers: { ...cfg.tiers, 2: secondTierField }, excluded });
      await Promise.all([refreshTeams(), refreshSchedules()]);
      toast({ title: `${TIER_NAME[2]} generated`, description: `${secondTierField.length} teams, ${rows.length} games.` });
    } catch (e) {
      toast({ title: 'Could not generate the second tier', description: String(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const setLive = async (live: boolean) => {
    if (!playoff) return;
    setBusy(true);
    try {
      const { supabase } = await import('../supabaseClient');
      const { error: e1 } = await supabase.from('tournaments').update({ status: live ? 'finished' : 'active' }).eq('id', league.id);
      if (e1) throw new Error(e1.message);
      const { error: e2 } = await supabase.from('tournaments').update({ status: live ? 'active' : 'pending' }).eq('id', playoff.id);
      if (e2) throw new Error(e2.message);
      await refreshTournaments();
      toast({ title: live ? 'Playoffs are live in the portal' : 'League is back in the portal' });
    } catch (e) {
      toast({ title: 'Could not switch', description: String(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  // ---- Render --------------------------------------------------------------
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trophy className="w-4 h-4" /> Playoffs · {league.name}</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-700">
          <p>
            One night. <strong>{TIER_NAME[1]}</strong>: the top {CHAMPION_TIER_SIZE} play every other team twice ({PRELIM_GAMES_PER_TEAM} games each) to earn seeds 1 to 6, then 5 vs 6 for fifth, semifinals 1 vs 4 and 2 vs 3, the final and a third-place series, all best of three.
            Seeds are settled by wins, then head-to-head among tied teams, then points, then season finish.
          </p>
          {playoff ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{playoff.name}</Badge>
              <Badge className={playoff.status === 'active' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-800'}>{playoff.status === 'active' ? 'LIVE in the portal' : 'not live yet'}</Badge>
              {playoff.status !== 'active' ? (
                <Button size="sm" className="text-white" style={{ backgroundColor: BRAND }} disabled={busy} onClick={() => setLive(true)}><Play className="w-3 h-3 mr-1" /> Make playoffs live (portal shows playoffs, league marked finished)</Button>
              ) : (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setLive(false)}>Put the league back in the portal</Button>
              )}
            </div>
          ) : (
            <div className="text-xs text-gray-600">Not created yet. Set the field below.</div>
          )}
        </CardContent>
      </Card>

      {/* Field */}
      <Card>
        <CardHeader><CardTitle className="text-base">{playoff ? 'The field' : 'Set the field from the final season standings'}</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse min-w-[420px]">
              <thead><tr className="bg-gray-100"><th className="px-2 py-1 text-left">#</th><th className="px-2 py-1 text-left">Team</th><th className="px-2 py-1">W</th><th className="px-2 py-1">L</th><th className="px-2 py-1">Pts</th><th className="px-2 py-1 text-left">Playoff</th></tr></thead>
              <tbody>
                {season.map(r => {
                  const inChamp = champField.includes(r.teamId);
                  const out = excluded.includes(r.teamId);
                  return (
                    <tr key={r.teamId} className={`border-t ${inChamp ? 'bg-amber-50 font-semibold' : ''}`}>
                      <td className="px-2 py-1">{r.rank}</td>
                      <td className="px-2 py-1 whitespace-nowrap">{no(r.teamId)} · {r.teamName}</td>
                      <td className="px-2 py-1 text-center">{r.wins}</td>
                      <td className="px-2 py-1 text-center">{r.losses}</td>
                      <td className="px-2 py-1 text-center">{r.points}</td>
                      <td className="px-2 py-1">
                        {inChamp ? <Badge className="bg-amber-500 text-white text-[10px]">{TIER_NAME[1]}</Badge> : (
                          <label className="flex items-center gap-1 text-xs">
                            <input type="checkbox" checked={out} disabled={!!playoff && !!cfg?.tiers[2]} onChange={e => {
                              const next = e.target.checked ? [...excluded, r.teamId] : excluded.filter(x => x !== r.teamId);
                              setExcluded(next);
                              if (playoff && cfg) saveConfig({ ...cfg, excluded: next }).catch(err => toast({ title: 'Could not save', description: String(err), variant: 'destructive' }));
                            }} />
                            {out ? 'Not playing' : TIER_NAME[2]}
                          </label>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!playoff && (
            <div className="flex flex-wrap items-center gap-2">
              <Button className="text-white" style={{ backgroundColor: BRAND }} disabled={busy || champField.length !== CHAMPION_TIER_SIZE} onClick={createPlayoffs} data-testid="po-create">
                {busy ? 'Creating…' : `Create playoffs and generate ${TIER_NAME[1]} games (${CHAMPION_TIER_SIZE * (CHAMPION_TIER_SIZE - 1)})`}
              </Button>
              <span className="text-xs text-gray-600">Creates a separate playoff tournament. The league season is not changed.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {playoff && cfg && (
        <>
          <TierPanel tier={1} playoff={playoff} cfg={cfg} field={cfg.tiers[1] ?? []} seasonRank={seasonRank} saveConfig={saveConfig} />
          {cfg.tiers[2] ? (
            <TierPanel tier={2} playoff={playoff} cfg={cfg} field={cfg.tiers[2]} seasonRank={seasonRank} saveConfig={saveConfig} />
          ) : (
            <Card className="border-amber-300">
              <CardHeader><CardTitle className="text-base">{TIER_NAME[2]} · not generated yet</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  Every team outside the top {CHAMPION_TIER_SIZE} that is playing: <strong>{secondTierField.map(no).join(', ')}</strong> ({secondTierField.length} teams).
                  Each plays {PRELIM_GAMES_PER_TEAM} games, one game per opponent; the top {SECOND_TIER_ADVANCE} go to the bracket (1 vs 4, 2 vs 3, final, third place), winner take all.
                </div>
                <div className="text-xs text-gray-600">Tick "Not playing" in the field table for any team that is out before generating. Opponents are assigned by season rank so every card has the same strength.</div>
                <Button className="text-white" style={{ backgroundColor: BRAND }} disabled={busy || secondTierField.length < SECOND_TIER_ADVANCE} onClick={createSecondTier} data-testid="po-create-t2">
                  {busy ? 'Generating…' : `Generate ${TIER_NAME[2]} games (${secondTierField.length} teams, ${(secondTierField.length * PRELIM_GAMES_PER_TEAM) / 2} games)`}
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};


// ---------------------------------------------------------------------------
// One tier: preliminary round, seeds, bracket
// ---------------------------------------------------------------------------

const TierPanel: React.FC<{ tier: Tier; playoff: Tournament; cfg: PlayoffConfig; field: string[]; seasonRank: Record<string, number>; saveConfig: (c: PlayoffConfig) => Promise<void> }> = ({ tier, playoff, cfg, field, seasonRank, saveConfig }) => {
  const { teams, schedules, games, refreshSchedules, refreshGamesFromSupabase } = useAppContext();
  const no = (id: string) => leagueTeamNo(teams, id);
  const pSchedule = schedules.find(s => s.tournamentId === playoff.id) ?? null;
  const champField = field;
  const advance = tier === 1 ? field.length : SECOND_TIER_ADVANCE;
  const [busy, setBusy] = useState(false);
  const [filterTeam, setFilterTeam] = useState<string>('');
  const [editing, setEditing] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  // ---- Preliminary -----------------------------------------------------
  const prelimMatches = useMemo(() => (pSchedule?.matches ?? []).filter(m => { const i = playoffMatchInfo(m); return i && i.round === 1 && i.tier === tier; }), [pSchedule]);
  const prelim = useMemo(() => prelimComplete(pSchedule, games, tier), [pSchedule, games]);
  const standings = useMemo(() => prelimStandings(teams, tier, champField, pSchedule, games, seasonRank), [teams, champField, pSchedule, games, seasonRank]);
  const playedBy = (id: string) => prelimMatches.filter(m => (String(m.teamA) === id || String(m.teamB) === id) && confirmedGame(games, m)).length;

  // ---- Bracket -----------------------------------------------------------
  const seeds = cfg.seeds[tier];
  const states = useMemo(() => bracketState(tier, seeds, pSchedule, games), [seeds, pSchedule, games]);
  const placings = useMemo(() => bracketPlacings(states), [states]);
  const bracketHasScores = states.some(s => s.games.some(g => anyGame(games, g.match)));
  const [seedOrder, setSeedOrder] = useState<string[]>([]);
  useEffect(() => { if (!seeds) setSeedOrder(standings.map(r => r.teamId)); }, [standings, seeds]);
  const [confirmSeed, setConfirmSeed] = useState(false);

  // Keep the bracket moving: later games and later series are created as results come in.
  useEffect(() => {
    if (!seeds || !pSchedule) return;
    const toCreate = bracketMatchesToCreate(playoff.id, tier, states);
    if (toCreate.length === 0) return;
    let cancelled = false;
    (async () => {
      const { supabase } = await import('../supabaseClient');
      const { error } = await supabase.from('matches').upsert(toCreate.map(m => matchRow(playoff.id, m)), { onConflict: 'id', ignoreDuplicates: true });
      if (!error && !cancelled) await refreshSchedules();
    })();
    return () => { cancelled = true; };
  }, [playoff.id, seeds, pSchedule, states, refreshSchedules]);

  const seedBracket = async () => {
    if (new Set(seedOrder).size !== champField.length) { toast({ title: 'Each seed must be a different team', variant: 'destructive' }); return; }
    if (!confirmSeed) { setConfirmSeed(true); return; }
    setBusy(true);
    try {
      await saveConfig({ ...cfg, seeds: { ...cfg.seeds, [tier]: seedOrder } });
      const { supabase } = await import('../supabaseClient');
      const toCreate = bracketMatchesToCreate(playoff.id, tier, bracketState(tier, seedOrder, pSchedule, games));
      const { error } = await supabase.from('matches').upsert(toCreate.map(m => matchRow(playoff.id, m)), { onConflict: 'id', ignoreDuplicates: true });
      if (error) throw new Error(error.message);
      await refreshSchedules();
      setConfirmSeed(false);
      toast({ title: 'Bracket seeded', description: `Seeds: ${seedOrder.map((id, i) => `${i + 1}·${no(id)}`).join('  ')}` });
    } catch (e) {
      toast({ title: 'Could not seed the bracket', description: String(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const resetBracket = async () => {
    if (bracketHasScores) return;
    setBusy(true);
    try {
      const { supabase } = await import('../supabaseClient');
      const { error } = await supabase.from('matches').delete().eq('tournament_id', playoff.id).eq('round', BRACKET_ROUND).eq('table_number', tier);
      if (error) throw new Error(error.message);
      const seedsLeft = { ...cfg.seeds }; delete seedsLeft[tier];
      await saveConfig({ ...cfg, seeds: seedsLeft });
      await refreshSchedules();
      toast({ title: 'Bracket reset', description: 'Seed it again when ready.' });
    } catch (e) {
      toast({ title: 'Could not reset', description: String(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const clearScore = async (m: ScheduleMatch) => {
    const { supabase } = await import('../supabaseClient');
    const { error } = await supabase.from('games').delete().eq('matchId', m.id);
    if (error) toast({ title: 'Could not clear', description: error.message, variant: 'destructive' });
    await refreshGamesFromSupabase();
  };

  // ---- Rendering helpers ---------------------------------------------------
  const seedOf = (id?: string) => (id && seeds ? seeds.indexOf(id) + 1 : 0);
  const renderMatch = (m: ScheduleMatch, label: string) => {
    const g = anyGame(games, m);
    const confirmed = g && (g.confirmed || g.status === 'confirmed');
    const status = !g ? 'not played' : confirmed ? 'confirmed' : g.status === 'entering' ? 'entering' : g.status === 'pending_confirmation' ? 'awaiting confirm' : g.status ?? '';
    return (
      <div key={m.id} className="rounded border bg-white p-2 text-sm" data-testid={`po-match-${m.id}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 w-24">{label}</span>
          <span className="font-semibold">{no(String(m.teamA))} · {teamLabel(teams, String(m.teamA))}</span>
          <span className="text-gray-400">vs</span>
          <span className="font-semibold">{no(String(m.teamB))} · {teamLabel(teams, String(m.teamB))}</span>
          <span className="ml-auto flex items-center gap-2">
            {confirmed ? (
              <span className="font-bold">{g!.scoreA} – {g!.scoreB} <span className="text-xs font-normal text-gray-500">({no(g!.winner === 'teamA' ? String(g!.teamA) : String(g!.teamB))} won)</span></span>
            ) : (
              <Badge variant="outline" className="text-[10px]">{status}</Badge>
            )}
            {editing !== m.id && (
              <Button size="sm" variant="outline" className="h-7" onClick={() => setEditing(m.id)}><Pencil className="w-3 h-3 mr-1" /> {confirmed ? 'Edit' : 'Score'}</Button>
            )}
            {g && <Button size="sm" variant="ghost" className="h-7 text-red-600" onClick={() => clearScore(m)}><Trash2 className="w-3 h-3" /></Button>}
          </span>
        </div>
        {editing === m.id && <MatchScoreEditor match={m} teams={teams} tracksHands={false} existing={confirmed ? g : undefined} onDone={() => setEditing(null)} />}
      </div>
    );
  };

  const visiblePrelim = prelimMatches
    .filter(m => !filterTeam || String(m.teamA) === filterTeam || String(m.teamB) === filterTeam)
    .sort((x, y) => (Number(no(String(x.teamA))) - Number(no(String(y.teamA)))) || (Number(no(String(x.teamB))) - Number(no(String(y.teamB)))) || x.id.localeCompare(y.id));

  const seriesCard = (st: SeriesState) => (
    <div key={st.spec.key} className="rounded-lg border p-3 space-y-2" data-testid={`po-series-${st.spec.key}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold">{st.spec.label}</span>
        <span className="text-xs text-gray-500">best of 3</span>
        {st.winner && <Badge className="bg-green-600 text-white text-[10px]">Winner: {no(st.winner)}</Badge>}
      </div>
      {st.teamA && st.teamB ? (
        <>
          <div className="text-sm">
            <span className="font-semibold">({seedOf(st.teamA) || '-'}) {no(st.teamA)} · {teamLabel(teams, st.teamA)}</span>
            <span className="mx-2 font-bold">{st.winsA} – {st.winsB}</span>
            <span className="font-semibold">({seedOf(st.teamB) || '-'}) {no(st.teamB)} · {teamLabel(teams, st.teamB)}</span>
          </div>
          <div className="space-y-1">{st.games.map(g => renderMatch(g.match, `Game ${playoffMatchInfo(g.match)?.game}`))}</div>
          {!st.winner && st.games.every(g => g.game) && st.games.length < 3 && st.winsA === st.winsB && <div className="text-xs text-gray-500">Game 3 is being added…</div>}
        </>
      ) : (
        <div className="text-xs text-gray-500">Waiting on {('winnersOf' in st.spec.from ? 'the winners' : 'the losers')} of both semifinals.</div>
      )}
    </div>
  );


  const tierName = TIER_NAME[tier];
  return (
    <>
      {/* Preliminary round */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex flex-wrap items-center gap-2">
            {tierName} · preliminary round
            <Badge variant="outline" data-testid={`po-prelim-count-${tier}`}>{prelim.done} of {prelim.total} games confirmed</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="text-xs text-gray-600">
            {tier === 1 ? `Every team plays every other team twice (${PRELIM_GAMES_PER_TEAM} games each). All six are seeded 1 to 6.` : `Each team plays ${PRELIM_GAMES_PER_TEAM} games, one per opponent on its card. The top ${SECOND_TIER_ADVANCE} advance.`}
            {' '}Seeds: wins, then head-to-head among tied teams, then points, then season finish.
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-xs text-gray-500 mr-1">Teams:</span>
            {champField.map(id => {
              const p = playedBy(id);
              return (
                <button key={id} type="button" onClick={() => setFilterTeam(filterTeam === id ? '' : id)}
                  className={`px-2 py-0.5 rounded border text-xs font-semibold ${filterTeam === id ? 'text-white border-transparent' : p >= PRELIM_GAMES_PER_TEAM ? 'bg-green-50 border-green-300 text-green-800' : 'bg-white border-gray-300'}`}
                  style={filterTeam === id ? { backgroundColor: BRAND } : undefined}>
                  {no(id)} <span className="font-normal">{p}/{PRELIM_GAMES_PER_TEAM}</span>
                </button>
              );
            })}
            <label className="ml-auto flex items-center gap-1 text-xs"><input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} /> Show all games</label>
          </div>
          {(filterTeam || showAll) && (
            <div className="space-y-1">
              {visiblePrelim.map(m => renderMatch(m, `Game ${playoffMatchInfo(m)?.game}`))}
            </div>
          )}
          <div>
            <div className="font-semibold mb-1">Standings and seeds</div>
            <table className="text-xs border-collapse min-w-[420px]">
              <thead><tr className="bg-gray-100"><th className="px-2 py-1">Seed</th><th className="px-2 py-1 text-left">Team</th><th className="px-2 py-1">GP</th><th className="px-2 py-1">W</th><th className="px-2 py-1">L</th><th className="px-2 py-1">Pts</th><th className="px-2 py-1">Bos</th><th className="px-2 py-1 text-left">Decided by</th></tr></thead>
              <tbody>
                {standings.map(r => (
                  <tr key={r.teamId} className={`border-t ${r.seed <= advance ? 'bg-amber-50' : ''}`} data-testid={`po-seed-${tier}-${r.seed}`}>
                    <td className="px-2 py-1 text-center font-bold">{r.seed}</td>
                    <td className="px-2 py-1 whitespace-nowrap">{no(r.teamId)} · {r.teamName}{tier === 2 && r.seed <= advance ? <span className="ml-1 text-[10px] text-amber-700 font-semibold">advances</span> : null}</td>
                    <td className="px-2 py-1 text-center">{r.played}</td>
                    <td className="px-2 py-1 text-center">{r.wins}</td>
                    <td className="px-2 py-1 text-center">{r.losses}</td>
                    <td className="px-2 py-1 text-center">{r.points}</td>
                    <td className="px-2 py-1 text-center">{r.bostons}</td>
                    <td className="px-2 py-1 text-gray-500">{r.tiebreak === 'h2h' ? 'head-to-head' : r.tiebreak === 'points' ? 'points' : r.tiebreak === 'season' ? 'season finish' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Bracket */}
      <Card className={seeds ? '' : 'border-amber-300'}>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Flag className="w-4 h-4" /> {tierName} · bracket</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!seeds ? (
            <>
              <div className="text-xs text-gray-600">
                {prelim.done < prelim.total ? `The preliminary round is not finished (${prelim.done} of ${prelim.total}). Seeding now uses the standings as they stand.` : 'Preliminary round complete. Check the seeds, adjust if a tie was settled off the table, then create the bracket.'}
              </div>
              <div className="grid gap-1 md:grid-cols-2">
                {seedOrder.slice(0, advance).map((id, i) => (
                  <label key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-14 font-bold">Seed {i + 1}</span>
                    <select className="border rounded px-2 py-1 bg-white" value={id} onChange={e => { const next = seedOrder.slice(); const j = next.indexOf(e.target.value); next[i] = e.target.value; if (j >= 0) next[j] = id; setSeedOrder(next); }} data-testid={`po-seed-select-${tier}-${i + 1}`}>
                      {champField.map(t => <option key={t} value={t}>{no(t)} · {teamLabel(teams, t)}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button className="text-white" style={{ backgroundColor: confirmSeed ? '#b91c1c' : BRAND }} disabled={busy} onClick={seedBracket} data-testid={`po-seed-bracket-${tier}`}>
                  {confirmSeed ? 'Yes, create the bracket with these seeds' : 'Seed the bracket'}
                </Button>
                {confirmSeed && <Button variant="outline" onClick={() => setConfirmSeed(false)}>Cancel</Button>}
              </div>
            </>
          ) : (
            <>
              <div className="text-xs text-gray-600">Seeds: {seeds.slice(0, advance).map((id, i) => `${i + 1} · ${no(id)}`).join('   ')}</div>
              <div className="grid gap-3 md:grid-cols-2">{states.map(seriesCard)}</div>
              {placings.length > 0 && (
                <div>
                  <div className="font-semibold mb-1">Final placings</div>
                  <table className="text-sm border-collapse" data-testid={`po-placings-${tier}`}>
                    <tbody>
                      {placings.map(p => (
                        <tr key={p.place} className="border-t"><td className="px-2 py-1 font-bold">{p.place === 1 ? (tier === 1 ? 'Champion' : 'Winner') : `${p.place}${p.place === 2 ? 'nd' : p.place === 3 ? 'rd' : 'th'}`}</td><td className="px-2 py-1">{no(p.teamId)} · {teamLabel(teams, p.teamId)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!bracketHasScores && <button type="button" className="text-xs underline text-gray-500" onClick={resetBracket}>Reset bracket (no scores entered yet)</button>}
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
};

export default PlayoffManager;
