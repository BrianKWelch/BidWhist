import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import type { Game, ScheduleMatch, Team } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Download, Printer, RefreshCw, Trophy, CalendarDays, ListChecks, AlertTriangle, Pencil, Trash2, Check, X, UserX } from 'lucide-react';
import {
  FORFEIT_WIN_POINTS,
  buildForfeitRows,
  buildLeagueMatches,
  currentLeagueWeek,
  isForfeitGame,
  gameBelongsToMatch,
  generateLeagueSeason,
  getLeagueStandings,
  isLeagueTournament,
  leagueGridCsv,
  leagueMatchInfo,
  leagueSeasonLeaders,
  leagueWeekLeaders,
  leagueWeekTable,
  leagueWeeksFromSchedule,
  leagueWeeksOf,
  leagueAudit,
  leagueTeamNo,
  lockedLeagueWeeks,
  buildMakeupMatch,
  buildWeekMatchesFromSides,
  buildMissingTeamMatches,
  planOrphanFixes,
  pairGamesInSchedule,
  LEAGUE_GAMES_PER_WEEK,
  teamSideForWeek,
  type LeagueSide,
  type LeagueWeek,
} from '@/lib/league';
import { createLeagueTournament, loadSeedWeek, type SeedWeekData } from '@/lib/leagueSeed';
import week1Data from '@/data/league2026FallWeek1.json';
import { LeagueRestoreCard } from '@/components/LeagueRestoreCard';
import { originalTag } from '@/lib/leagueRecover';
import LeagueLeadersPanel from './LeagueLeadersPanel';

const SEED: SeedWeekData = week1Data as SeedWeekData;

const BRAND = '#a60002';

const sideClasses: Record<LeagueSide, string> = {
  A: 'bg-blue-100 text-blue-800 border-blue-300',
  B: 'bg-amber-100 text-amber-800 border-amber-300',
};

const isConfirmed = (g: Game) => Boolean(g.confirmed) || g.status === 'confirmed';

const downloadText = (filename: string, text: string) => {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const teamLabel = (teams: Team[], id: string) => {
  const t = teams.find(tt => String(tt.id) === String(id));
  if (!t) return `Team ${id}`;
  const players = `${t.player1FirstName || ''}/${t.player2FirstName || ''}`;
  const isLeagueName = t.name && t.name !== players && !t.name.includes('/');
  return `${leagueTeamNo(teams, id)} · ${isLeagueName ? t.name : players}`;
};

// ---------------------------------------------------------------------------
// Inline admin score editor for one league match
// ---------------------------------------------------------------------------

const MatchScoreEditor: React.FC<{
  match: ScheduleMatch;
  teams: Team[];
  tracksHands: boolean;
  existing?: Game;
  onDone: () => void;
}> = ({ match, teams, tracksHands, existing, onDone }) => {
  const { refreshGamesFromSupabase } = useAppContext();
  const [scoreA, setScoreA] = useState(existing ? String(existing.scoreA ?? '') : '');
  const [scoreB, setScoreB] = useState(existing ? String(existing.scoreB ?? '') : '');
  const [handsA, setHandsA] = useState(existing ? String(existing.handsA ?? 0) : '0');
  const [handsB, setHandsB] = useState(existing ? String(existing.handsB ?? 0) : '0');
  const [bostonA, setBostonA] = useState(existing ? String(existing.boston_a ?? 0) : '0');
  const [bostonB, setBostonB] = useState(existing ? String(existing.boston_b ?? 0) : '0');
  const [tieWinner, setTieWinner] = useState<'teamA' | 'teamB' | null>(existing?.winner ?? null);
  const [saving, setSaving] = useState(false);

  const a = Number(scoreA), b = Number(scoreB);
  const isTie = scoreA !== '' && scoreB !== '' && a === b;
  const canSave = scoreA !== '' && scoreB !== '' && !isNaN(a) && !isNaN(b) && (!isTie || tieWinner);

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const { supabase } = await import('../supabaseClient');
      // One confirmed row per match: clear any entering/pending/disputed/old rows first.
      const { error: delErr } = await supabase.from('games').delete().eq('matchId', match.id);
      if (delErr) throw new Error(delErr.message);
      const winner: 'teamA' | 'teamB' = a > b ? 'teamA' : b > a ? 'teamB' : tieWinner!;
      const row = {
        id: existing?.id ?? Date.now().toString(),
        matchId: match.id,
        teamA: String(match.teamA),
        teamB: String(match.teamB),
        scoreA: a,
        scoreB: b,
        handsA: tracksHands ? Number(handsA) || 0 : 0,
        handsB: tracksHands ? Number(handsB) || 0 : 0,
        boston_a: Number(bostonA) || 0,
        boston_b: Number(bostonB) || 0,
        winner,
        submittedBy: 'admin',
        confirmed: true,
        confirmedBy: 'admin',
        round: match.round,
        timestamp: new Date().toISOString(),
        status: 'confirmed',
        entered_by_team_id: null,
      };
      const { error } = await supabase.from('games').insert([row]);
      if (error) throw new Error(error.message);
      await refreshGamesFromSupabase();
      toast({ title: 'Score saved' });
      onDone();
    } catch (e) {
      toast({ title: 'Save failed', description: String(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const numCls = 'w-16 text-center font-bold';
  // Plain function (not a component) so the inputs keep focus between keystrokes.
  type RowProps = { label: string; score: string; setScore: (v: string) => void; hands: string; setHands: (v: string) => void; boston: string; setBoston: (v: string) => void; tieKey: 'teamA' | 'teamB' };
  const renderRow = ({ label, score, setScore, hands, setHands, boston, setBoston, tieKey }: RowProps) => (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-40 text-sm font-semibold truncate">{label}</span>
      <span className="text-xs text-gray-500">Pts</span>
      <Input type="number" inputMode="numeric" value={score} onChange={e => setScore(e.target.value)} className={numCls} autoFocus={tieKey === 'teamA'} />
      {tracksHands && (<><span className="text-xs text-gray-500">Hands</span><Input type="number" inputMode="numeric" value={hands} onChange={e => setHands(e.target.value)} className={numCls} /></>)}
      <span className="text-xs text-gray-500">Bostons</span>
      <Input type="number" inputMode="numeric" value={boston} onChange={e => setBoston(e.target.value)} className={numCls} />
      {isTie && (
        <label className="flex items-center gap-1 text-xs text-orange-700 ml-2">
          <input type="radio" name={`tie-${match.id}`} checked={tieWinner === tieKey} onChange={() => setTieWinner(tieKey)} /> Tie winner
        </label>
      )}
    </div>
  );

  return (
    <div className="mt-2 p-3 rounded-lg border bg-white space-y-2">
      {renderRow({ label: teamLabel(teams, match.teamA), score: scoreA, setScore: setScoreA, hands: handsA, setHands: setHandsA, boston: bostonA, setBoston: setBostonA, tieKey: 'teamA' })}
      {renderRow({ label: teamLabel(teams, match.teamB), score: scoreB, setScore: setScoreB, hands: handsB, setHands: setHandsB, boston: bostonB, setBoston: setBostonB, tieKey: 'teamB' })}
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={save} disabled={!canSave || saving} style={{ backgroundColor: BRAND }} className="text-white">
          <Check className="w-3 h-3 mr-1" /> {saving ? 'Saving…' : 'Save score'}
        </Button>
        <Button size="sm" variant="outline" onClick={onDone} disabled={saving}><X className="w-3 h-3 mr-1" /> Cancel</Button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const LeagueManager: React.FC = () => {
  const { teams, tournaments, schedules, games, getActiveTournament, updateTournament, refreshGamesFromSupabase, refreshSchedules, refreshTeams, refreshTournaments } = useAppContext();

  const leagues = useMemo(() => tournaments.filter(isLeagueTournament), [tournaments]);
  const active = getActiveTournament();
  const [selectedId, setSelectedId] = useState<string>('');
  useEffect(() => {
    if (selectedId && leagues.some(l => l.id === selectedId)) return;
    const preferred = isLeagueTournament(active) ? active!.id : leagues[0]?.id;
    if (preferred) setSelectedId(preferred);
  }, [leagues, active, selectedId]);

  const league = leagues.find(l => l.id === selectedId) ?? null;
  const registered = useMemo(
    () => teams.filter(t => t.registeredTournaments?.includes(league?.id ?? '__none__')).sort((x, y) => Number(x.teamNumber ?? x.id) - Number(y.teamNumber ?? y.id)),
    [teams, league?.id],
  );
  const schedule = schedules.find(s => s.tournamentId === league?.id) ?? null;
  const weeks = useMemo(() => leagueWeeksFromSchedule(schedule), [schedule]);
  const plannedWeeks = leagueWeeksOf(league) || 9;
  const tracksHands = league?.tracksHands !== false;

  const [tab, setTab] = useState('season');
  const [weeksInput, setWeeksInput] = useState(String(plannedWeeks));
  useEffect(() => { setWeeksInput(String(plannedWeeks)); }, [plannedWeeks, league?.id]);
  const [generating, setGenerating] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [regenTyped, setRegenTyped] = useState('');
  // Room editor for one unlocked week
  const [editWeek, setEditWeek] = useState<number | null>(null);
  const [editA, setEditA] = useState<string[]>([]);
  const [editB, setEditB] = useState<string[]>([]);
  const [savingRooms, setSavingRooms] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');
  const [confirmSeed, setConfirmSeed] = useState(false);
  const no = (id: string) => leagueTeamNo(teams, id);
  const locked = useMemo(() => lockedLeagueWeeks(schedule, games), [schedule, games]);
  const nextWeek = locked.length ? Math.max(...locked) + 1 : 1;
  const maxExistingWeek = weeks.length ? Math.max(...weeks.map(w => w.week)) : 0;
  // Adding weeks keeps every existing week; only an explicit (advanced) reschedule rebuilds from nextWeek.
  const [rescheduleArmed, setRescheduleArmed] = useState(false);
  const startWeek = rescheduleArmed ? nextWeek : Math.max(nextWeek, maxExistingWeek + 1);
  const seedLoaded = useMemo(() => weeks.some(w => w.week === SEED.week && w.open), [weeks]);

  // ---- Hand-scored week loader ----------------------------------------------
  const runSeed = async (tournamentId: string) => {
    const { supabase } = await import('../supabaseClient');
    const sched = schedules.find(s => s.tournamentId === tournamentId) ?? null;
    const res = await loadSeedWeek(supabase, tournamentId, teams, sched, SEED, setSeedMsg);
    await Promise.all([refreshTeams(), refreshSchedules(), refreshGamesFromSupabase()]);
    toast({
      title: `Week ${SEED.week} loaded`,
      description: `${res.teamsCreated} teams created, ${res.teamsMatched} matched, ${res.gamesInserted} games written${res.skipped ? `, ${res.skipped} already present` : ''}.`,
    });
  };
  const handleSeed = async () => {
    if (!confirmSeed) { setConfirmSeed(true); return; }
    setSeeding(true); setSeedMsg('Starting…');
    try {
      let id = league?.id;
      if (!id) {
        const { supabase } = await import('../supabaseClient');
        const anyActive = tournaments.some(t => t.status === 'active');
        id = await createLeagueTournament(supabase, SEED.season, 9, anyActive ? 'pending' : 'active');
        await refreshTournaments();
        setSelectedId(id);
      }
      await runSeed(id);
      setConfirmSeed(false);
    } catch (e) {
      toast({ title: 'Load failed', description: String(e), variant: 'destructive' });
    } finally {
      setSeeding(false); setSeedMsg('');
    }
  };

  // ---- Makeup game (one-sided) ------------------------------------------
  const [mkTeam, setMkTeam] = useState('');
  const [mkOpp, setMkOpp] = useState('');
  const [mkWeek, setMkWeek] = useState<number>(1);
  /** Teams that still owe games in `week` (played fewer than 10 that count for them). */
  const owingTeams = (week: number) => {
    if (!schedule) return [] as Team[];
    return registered.filter(t => {
      const id = String(t.id);
      const played = schedule.matches.filter(m => m.round === week && (String(m.teamA) === id || String(m.teamB) === id))
        .filter(m => { const c = leagueMatchInfo(m).countsFor; return (!c || c === id) && confirmedFor(m); }).length;
      return played < LEAGUE_GAMES_PER_WEEK;
    });
  };

  /** Move a makeup's credit to the other team, keeping the score. */
  const flipMakeup = async (m: ScheduleMatch) => {
    if (!league) return;
    const { countsFor } = leagueMatchInfo(m);
    if (!countsFor) return;
    const other = String(m.teamA) === countsFor ? String(m.teamB) : String(m.teamA);
    const newId = m.id.slice(0, m.id.lastIndexOf('-for')) + `-for${other}`;
    try {
      const { supabase } = await import('../supabaseClient');
      const { error: e1 } = await supabase.from('matches').insert([{ id: newId, team_a: m.teamA, team_b: m.teamB, round: m.round, tournament_id: league.id, table_number: m.table ?? 0, is_bye: false, is_same_city: false }]);
      if (e1) throw new Error(e1.message);
      const { error: e2 } = await supabase.from('games').update({ matchId: newId }).eq('matchId', m.id);
      if (e2) throw new Error(e2.message);
      const { error: e3 } = await supabase.from('matches').delete().eq('id', m.id);
      if (e3) throw new Error(e3.message);
      await Promise.all([refreshSchedules(), refreshGamesFromSupabase()]);
      toast({ title: `Makeup now counts for Team ${no(other)} only` });
    } catch (e) {
      toast({ title: 'Could not flip makeup', description: String(e), variant: 'destructive' });
    }
  };

  const addMakeup = async () => {
    if (!league || !mkTeam || !mkOpp || mkTeam === mkOpp) return;
    try {
      const m = buildMakeupMatch(league.id, mkWeek, mkTeam, mkOpp);
      const { supabase } = await import('../supabaseClient');
      const { error } = await supabase.from('matches').insert([{ id: m.id, team_a: m.teamA, team_b: m.teamB, round: m.round, tournament_id: league.id, table_number: m.table, is_bye: false, is_same_city: false }]);
      if (error) throw new Error(error.message);
      await refreshSchedules();
      setSelectedWeek(mkWeek);
      setEditingMatchId(m.id);
      toast({ title: `Makeup game added for Team ${no(mkTeam)}`, description: `Week ${mkWeek} vs Team ${no(mkOpp)}. Counts for Team ${no(mkTeam)} only.` });
    } catch (e) {
      toast({ title: 'Could not add makeup game', description: String(e), variant: 'destructive' });
    }
  };

  // Keep scores fresh while the admin is on this tab.
  useEffect(() => {
    const id = setInterval(() => { refreshGamesFromSupabase(); }, 3000);
    return () => clearInterval(id);
  }, [refreshGamesFromSupabase]);

  // ---- Generation ---------------------------------------------------------
  const openRoomEditor = (w: number) => {
    const wk = weeks.find(x => x.week === w);
    if (!wk) return;
    setEditWeek(w); setEditA(wk.sideA.slice()); setEditB(wk.sideB.slice());
  };
  const addTeamToWeek = (id: string) => {
    if (editA.length <= editB.length) setEditA([...editA, id]); else setEditB([...editB, id]);
  };
  const removeTeamFromWeek = (id: string) => { setEditA(editA.filter(t => t !== id)); setEditB(editB.filter(t => t !== id)); };
  // Registered teams that a generated week left out (this is how a bad regenerate shows up).
  const missingByWeek = useMemo(() => weeks.filter(w => !w.open).map(w => ({
    week: w.week,
    missing: registered.map(t => String(t.id)).filter(id => !w.sideA.includes(id) && !w.sideB.includes(id)),
  })).filter(x => x.missing.length > 0), [weeks, registered]);
  const moveTeam = (id: string) => {
    if (editA.includes(id)) { setEditA(editA.filter(t => t !== id)); setEditB([...editB, id]); }
    else { setEditB(editB.filter(t => t !== id)); setEditA([...editA, id]); }
  };
  const saveRooms = async () => {
    if (!league || !schedule || editWeek === null) return;
    if (editA.length !== editB.length) { toast({ title: 'Both sides need the same number of teams', variant: 'destructive' }); return; }
    if (locked.includes(editWeek)) { toast({ title: `Week ${editWeek} already has scores and cannot be changed`, variant: 'destructive' }); return; }
    setSavingRooms(true);
    try {
      const { supabase } = await import('../supabaseClient');
      const { data: touched } = await supabase.from('games').select('id').in('matchId', schedule.matches.filter(m => m.round === editWeek).map(m => m.id));
      if (touched && touched.length > 0) throw new Error(`Week ${editWeek} has ${touched.length} score row(s); refusing to rebuild it.`);
      const fresh = buildWeekMatchesFromSides(league.id, editWeek, editA, editB, pairGamesInSchedule(schedule, editWeek), originalTag(schedule));
      const { error: delErr } = await supabase.from('matches').delete().eq('tournament_id', league.id).eq('round', editWeek);
      if (delErr) throw new Error(delErr.message);
      const rows = fresh.map(m => ({ id: m.id, team_a: m.teamA, team_b: m.teamB, round: m.round, tournament_id: league.id, table_number: m.table ?? 0, is_bye: false, is_same_city: false }));
      const { error } = await supabase.from('matches').insert(rows);
      if (error) throw new Error(error.message);
      await refreshSchedules();
      setEditWeek(null);
      toast({ title: `Week ${editWeek} rooms saved`, description: `${rows.length} games rebuilt from the sides you set.` });
    } catch (e) {
      toast({ title: 'Could not save rooms', description: String(e), variant: 'destructive' });
    } finally {
      setSavingRooms(false);
    }
  };

  // ---- Append-only repair for a locked week missing registered teams -------
  const [fixSides, setFixSides] = useState<Record<string, LeagueSide>>({});
  const [fixingWeek, setFixingWeek] = useState<number | null>(null);
  const addMissingToWeek = async (w: LeagueWeek, missing: string[]) => {
    if (!league || !schedule) return;
    const smaller = (): LeagueSide => (w.sideA.length <= w.sideB.length ? 'A' : 'B');
    const additions = missing.map(id => ({ teamId: id, side: fixSides[`${w.week}:${id}`] ?? smaller() }));
    setFixingWeek(w.week);
    try {
      const fresh = buildMissingTeamMatches(league.id, w.week, schedule, additions, originalTag(schedule) ?? Date.now().toString(36));
      if (fresh.length === 0) throw new Error('Nothing to add.');
      const { supabase } = await import('../supabaseClient');
      const rows = fresh.map(m => ({ id: m.id, team_a: m.teamA, team_b: m.teamB, round: m.round, tournament_id: league.id, table_number: m.table ?? 0, is_bye: false, is_same_city: false }));
      const { error } = await supabase.from('matches').insert(rows);
      if (error) throw new Error(error.message);
      await refreshSchedules();
      toast({ title: `Week ${w.week}: ${rows.length} games added`, description: `Teams ${missing.map(no).join(', ')} are back in Week ${w.week}. No existing game or score was changed.` });
    } catch (e) {
      toast({ title: 'Could not add games', description: String(e), variant: 'destructive' });
    } finally {
      setFixingWeek(null);
    }
  };

  const handleGenerate = async () => {
    if (!league) return;
    const n = registered.length;
    const w = parseInt(weeksInput) || plannedWeeks;
    if (n < 4) { toast({ title: 'Need at least 4 registered teams', variant: 'destructive' }); return; }
    if (n % 2 !== 0) { toast({ title: `Even number of teams required (currently ${n})`, description: 'Both sides must be the same size.', variant: 'destructive' }); return; }
    const replacesExisting = !!schedule && schedule.matches.some(m => m.round >= startWeek);
    if (replacesExisting && !confirmRegenerate) { setConfirmRegenerate(true); return; }
    if (startWeek > w) { toast({ title: `All ${w} weeks already exist`, description: 'Raise the Weeks number to add more, or use Advanced to reschedule.', variant: 'destructive' }); return; }
    setGenerating(true);
    try {
      // Weeks already played (or hand-scored) stay exactly as they are; only the rest is generated.
      const season = generateLeagueSeason(registered.map(t => String(t.id)), w - startWeek + 1, { startWeek });
      // Added weeks keep the season's original tag; a reschedule gets a fresh one so it can be told apart (and undone).
      const generated = buildLeagueMatches(league.id, season, rescheduleArmed ? undefined : originalTag(schedule));
      const matches = [...(schedule?.matches ?? []).filter(m => locked.includes(m.round)), ...generated];
      const { supabase } = await import('../supabaseClient');
      // Replace only the weeks being generated, straight from the database, so locked
      // weeks (and any makeup added from a phone a moment ago) are never touched.
      const { data: replaced, error: selErr } = await supabase.from('matches').select('id').eq('tournament_id', league.id).gte('round', startWeek);
      if (selErr) throw new Error(selErr.message);
      const oldIds = (replaced || []).map((m: { id: string }) => String(m.id));
      for (let i = 0; i < oldIds.length; i += 200) {
        const { error } = await supabase.from('games').delete().in('matchId', oldIds.slice(i, i + 200));
        if (error) throw new Error(error.message);
      }
      const { error: delErr } = await supabase.from('matches').delete().eq('tournament_id', league.id).gte('round', startWeek);
      if (delErr) throw new Error(delErr.message);
      const rows = generated.map(m => ({ id: m.id, team_a: m.teamA, team_b: m.teamB, round: m.round, tournament_id: league.id, table_number: m.table ?? 0, is_bye: false, is_same_city: false }));
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabase.from('matches').insert(rows.slice(i, i + 200));
        if (error) throw new Error(error.message);
      }
      if (w !== leagueWeeksOf(league)) {
        await updateTournament(league.id, league.name, league.cost, league.bostonPotCost, league.description, league.status, undefined, undefined, undefined, undefined, undefined, 'league', w);
      }
      await Promise.all([refreshSchedules(), refreshGamesFromSupabase()]);
      setConfirmRegenerate(false);
      toast({
        title: startWeek > 1 ? `Weeks ${startWeek} to ${w} generated (${season.weeks.length} weeks)` : `Season generated: ${w} weeks, ${matches.length} games`,
        description: `Every pair of teams meets ${season.stats.minPairGames} to ${season.stats.maxPairGames} times; sides balanced within ${season.stats.sideImbalance} week(s).`,
      });
      setTab('season');
    } catch (e) {
      toast({ title: 'Generation failed', description: String(e), variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  // ---- Derived data -------------------------------------------------------
  const gamesByMatch = useMemo(() => {
    const map = new Map<string, Game[]>();
    for (const g of games) {
      if (!g.matchId) continue;
      const list = map.get(String(g.matchId)) ?? [];
      list.push(g);
      map.set(String(g.matchId), list);
    }
    return map;
  }, [games]);
  const confirmedFor = (m: ScheduleMatch) => (gamesByMatch.get(m.id) ?? []).find(g => isConfirmed(g) && gameBelongsToMatch(g, m));
  const anyFor = (m: ScheduleMatch) => (gamesByMatch.get(m.id) ?? []).find(g => gameBelongsToMatch(g, m));

  const pairSummary = useMemo(() => {
    if (!schedule) return null;
    const counts = new Map<string, number>();
    for (const m of schedule.matches) {
      const k = [String(m.teamA), String(m.teamB)].sort().join('|');
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const vals = Array.from(counts.values());
    const hist: Record<number, number> = {};
    vals.forEach(v => { hist[v] = (hist[v] ?? 0) + 1; });
    return { min: Math.min(...vals), max: Math.max(...vals), hist, pairs: vals.length };
  }, [schedule]);

  const gridTeamIds = useMemo(() => {
    const ids = new Set<string>();
    weeks.forEach(w => { w.sideA.forEach(t => ids.add(t)); w.sideB.forEach(t => ids.add(t)); });
    return Array.from(ids).sort((x, y) => Number(x) - Number(y));
  }, [weeks]);

  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  useEffect(() => { if (schedule) setSelectedWeek(currentLeagueWeek(schedule, games)); }, [schedule?.tournamentId, weeks.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState('');
  const [showAllGames, setShowAllGames] = useState(false);
  const toggleTeamFilter = (num: string) => { setTeamFilter(f => (f === num ? '' : num)); setEditingMatchId(null); };
  const [throughWeek, setThroughWeek] = useState<number>(0);
  const [weekOnly, setWeekOnly] = useState<number>(0);

  const audit = useMemo(() => leagueAudit(games, schedule), [games, schedule]);
  /** Bring orphan scores back: attach to an existing match for the pair when one is free, else recreate the match under its original id with its side. */
  const [restoringOrphans, setRestoringOrphans] = useState(false);
  const applyOrphanFixes = async (orphans: Game[]) => {
    if (!league || !schedule) return;
    const fixes = planOrphanFixes(schedule, games, orphans);
    if (fixes.length === 0) { toast({ title: 'Nothing to restore' }); return; }
    setRestoringOrphans(true);
    let attached = 0, recreated = 0;
    try {
      const { supabase } = await import('../supabaseClient');
      const rows = fixes.filter(f => f.action === 'recreate').map(f => ({ id: f.matchId, team_a: f.teamA, team_b: f.teamB, round: f.week, tournament_id: league.id, table_number: f.table, is_bye: false, is_same_city: false }));
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabase.from('matches').insert(rows.slice(i, i + 200));
        if (error) throw new Error(`Recreate matches: ${error.message}`);
      }
      recreated = rows.length;
      for (const f of fixes.filter(x => x.action === 'attach')) {
        const { error } = await supabase.from('games').update({ matchId: f.matchId }).eq('id', f.gameId);
        if (error) throw new Error(`Attach score: ${error.message}`);
        attached++;
      }
      await Promise.all([refreshSchedules(), refreshGamesFromSupabase()]);
      toast({ title: `${orphans.length} score(s) restored`, description: `${recreated} game row(s) recreated, ${attached} score(s) moved onto an existing game. Standings now count them.` });
    } catch (e) {
      toast({ title: 'Restore failed', description: String(e), variant: 'destructive' });
      await Promise.all([refreshSchedules(), refreshGamesFromSupabase()]);
    } finally {
      setRestoringOrphans(false);
    }
  };
  const restoreOrphan = (g: Game) => applyOrphanFixes([g]);
  const removeExtraRows = async (ids: string[]) => {
    try {
      const { supabase } = await import('../supabaseClient');
      const { error } = await supabase.from('games').delete().in('id', ids);
      if (error) throw new Error(error.message);
      await refreshGamesFromSupabase();
      toast({ title: `Removed ${ids.length} duplicate score row${ids.length === 1 ? '' : 's'}` });
    } catch (e) {
      toast({ title: 'Remove failed', description: String(e), variant: 'destructive' });
    }
  };

  const standings = useMemo(
    () => getLeagueStandings(teams, games, schedule, throughWeek || undefined),
    [teams, games, schedule, throughWeek],
  );

  const [forfeitTeam, setForfeitTeam] = useState<string | null>(null);
  const [forfeiting, setForfeiting] = useState(false);

  const forfeitWeek = async (teamId: string) => {
    if (!schedule) return;
    const rows = buildForfeitRows(schedule, games, teamId, selectedWeek);
    if (rows.length === 0) { toast({ title: `Team ${teamId} has no unplayed games in Week ${selectedWeek}` }); setForfeitTeam(null); return; }
    setForfeiting(true);
    try {
      const { supabase } = await import('../supabaseClient');
      const ids = rows.map(r => r.matchId as string);
      const { error: delErr } = await supabase.from('games').delete().in('matchId', ids);
      if (delErr) throw new Error(delErr.message);
      const { error } = await supabase.from('games').insert(rows);
      if (error) throw new Error(error.message);
      await refreshGamesFromSupabase();
      toast({ title: `Team ${teamId} forfeited Week ${selectedWeek}`, description: `${rows.length} game${rows.length === 1 ? '' : 's'} recorded as 0 to ${FORFEIT_WIN_POINTS} losses.` });
      setForfeitTeam(null);
    } catch (e) {
      toast({ title: 'Forfeit failed', description: String(e), variant: 'destructive' });
    } finally {
      setForfeiting(false);
    }
  };

  const clearScore = async (match: ScheduleMatch) => {
    try {
      const { supabase } = await import('../supabaseClient');
      const { error } = await supabase.from('games').delete().eq('matchId', match.id);
      if (error) throw new Error(error.message);
      await refreshGamesFromSupabase();
      toast({ title: 'Score cleared' });
    } catch (e) {
      toast({ title: 'Clear failed', description: String(e), variant: 'destructive' });
    }
  };

  // ---- Render -------------------------------------------------------------
  if (leagues.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="w-5 h-5" /> League Play</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-700">
          <p>No league exists yet. To create one:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Go to <strong>Tournament Setup</strong> and add a tournament (or pick an existing one).</li>
            <li>Edit it and set <strong>Table Rotation</strong> to <strong>League</strong>, then set the number of <strong>League Weeks</strong>.</li>
            <li>Register the teams to it from the Command Center as usual (20 teams for a 10 / 10 split).</li>
            <li>Come back here and click <strong>Generate Season</strong>.</li>
          </ol>
          <div className="mt-4 p-3 rounded-lg border-2 border-emerald-400 bg-emerald-50 space-y-2">
            <div className="font-bold text-emerald-900">{SEED.season}: load Week {SEED.week} from the hand-scored workbook</div>
            <div className="text-xs text-emerald-900">
              Creates the league ({SEED.teams.length} teams with their numbers and names, no phone numbers yet) and writes all {SEED.games.length} Week {SEED.week} results as confirmed games.
              Then generate weeks 2 onward from the League tab.
            </div>
            {seedMsg && <div className="text-xs text-gray-600">{seedMsg}</div>}
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleSeed} disabled={seeding} className="text-white" style={{ backgroundColor: BRAND }}>{seeding ? 'Loading…' : confirmSeed ? 'Yes, create league and load Week 1' : `Create league and load Week ${SEED.week}`}</Button>
              {confirmSeed && !seeding && <Button variant="outline" onClick={() => setConfirmSeed(false)}>Cancel</Button>}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="shadow">
        <CardContent className="pt-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5" style={{ color: BRAND }} />
            <span className="font-bold text-lg">League Play</span>
          </div>
          <select className="border rounded px-3 py-1 text-sm bg-white" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            {leagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          {league && (
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">{registered.length} teams registered</Badge>
              <Badge variant="outline">{weeks.length > 0 ? `${weeks.length} of ${plannedWeeks} weeks generated` : `${plannedWeeks} weeks planned`}</Badge>
              <Badge variant="outline">{league.scoringMode === 'admin' ? 'Admin scoring' : 'Teams enter scores'}</Badge>
              {league.status === 'active' ? <Badge className="bg-green-600 text-white">Active</Badge> : <Badge variant="secondary">{league.status}</Badge>}
            </div>
          )}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => { refreshGamesFromSupabase(); refreshSchedules(); }}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </CardContent>
      </Card>

      {league && (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="season"><CalendarDays className="w-4 h-4 mr-1" /> Season Schedule</TabsTrigger>
            <TabsTrigger value="week"><ListChecks className="w-4 h-4 mr-1" /> Weekly Games</TabsTrigger>
            <TabsTrigger value="standings"><Trophy className="w-4 h-4 mr-1" /> Standings</TabsTrigger>
          </TabsList>

          {/* ---------------- Season ---------------- */}
          <TabsContent value="season" className="space-y-4">
            {!seedLoaded && (
              <Card className="border-emerald-400">
                <CardHeader><CardTitle className="text-base">Week {SEED.week} results (hand-scored workbook)</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm text-gray-700">
                    {SEED.sourceFile}: {SEED.teams.length} teams, {SEED.games.length} games as played (open play, no sides). Teams are matched by team number, created if missing, and registered to this league.
                  </div>
                  <ul className="text-xs text-gray-500 list-disc pl-5">{SEED.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
                  {seedMsg && <div className="text-xs text-gray-600">{seedMsg}</div>}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={handleSeed} disabled={seeding} className="text-white" style={{ backgroundColor: BRAND }}>{seeding ? 'Loading…' : confirmSeed ? `Yes, load Week ${SEED.week}` : `Load Week ${SEED.week} results`}</Button>
                    {confirmSeed && !seeding && <Button variant="outline" onClick={() => setConfirmSeed(false)}>Cancel</Button>}
                  </div>
                </CardContent>
              </Card>
            )}
            <LeagueRestoreCard league={league} schedule={schedule} games={games} teams={teams} plannedWeeks={plannedWeeks} onRestored={async () => { await Promise.all([refreshSchedules(), refreshGamesFromSupabase(), refreshTeams()]); }} />
            {(() => {
              const planned = parseInt(weeksInput) || plannedWeeks;
              const allGenerated = weeks.length > 0 && maxExistingWeek >= plannedWeeks;
              const regenerateMode = allGenerated && showAdvanced;
              if (allGenerated && !showAdvanced) {
                return (
                  <Card>
                    <CardContent className="pt-4 space-y-2 text-sm text-gray-700">
                      <div className="flex flex-wrap items-center gap-3">
                        <span>Season schedule is complete: weeks 1 to {maxExistingWeek} are generated. Weeks {locked.join(', ') || 'none'} are locked (played or in play).</span>
                        <button type="button" className="text-xs underline text-gray-500 ml-auto" onClick={() => { setShowAdvanced(true); setRescheduleArmed(true); }}>Advanced: reschedule future weeks</button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                        <span>Need a longer season? Total weeks:</span>
                        <Input type="number" min={maxExistingWeek + 1} max={52} value={weeksInput} onChange={e => setWeeksInput(e.target.value)} className="w-20 h-8" aria-label="Weeks" />
                        <Button size="sm" className="h-8 text-white" style={{ backgroundColor: BRAND }} disabled={generating || planned <= maxExistingWeek} onClick={handleGenerate}>
                          {generating ? 'Generating…' : planned > maxExistingWeek ? `Generate Weeks ${maxExistingWeek + 1} to ${planned}` : 'Add weeks'}
                        </Button>
                        <span>Existing weeks are never changed by this.</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              }
              return (
            <Card className={regenerateMode ? 'border-red-300' : ''}>
              <CardHeader><CardTitle className="text-base">{regenerateMode ? `Reschedule weeks ${nextWeek} onward (advanced)` : maxExistingWeek > 0 ? `Generate Weeks ${startWeek} to ${planned}` : 'Generate Season'}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {regenerateMode && (
                  <div className="p-2 rounded bg-red-50 border border-red-300 text-sm text-red-800">
                    This throws away the room assignments for weeks {nextWeek} onward and builds new ones. Players who were told their rooms will see different ones. Only use this if those weeks have not been announced. Weeks with any score are never touched. Type REGENERATE to enable the button.
                    <Input value={regenTyped} onChange={e => setRegenTyped(e.target.value)} placeholder="REGENERATE" className="w-44 mt-2 bg-white" />
                  </div>
                )}
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Weeks</label>
                    <Input type="number" min={1} max={52} value={weeksInput} onChange={e => setWeeksInput(e.target.value)} className="w-24" />
                  </div>
                  <div className="text-sm text-gray-600">
                    {registered.length} registered teams → {registered.length / 2} per side, {registered.length / 2} games per team per week
                    {registered.length % 2 === 1 && <span className="text-red-600 font-semibold"> (needs an even count)</span>}
                  </div>
                  <Button onClick={handleGenerate} disabled={generating || registered.length < 4 || registered.length % 2 !== 0 || (regenerateMode && regenTyped !== 'REGENERATE')} style={{ backgroundColor: BRAND }} className="text-white">
                    {generating ? 'Generating…' : regenerateMode ? `Reschedule Weeks ${nextWeek}+` : maxExistingWeek > 0 ? `Generate Weeks ${startWeek} to ${weeksInput}` : 'Generate Season'}
                  </Button>
                  {regenerateMode && <Button variant="outline" onClick={() => { setShowAdvanced(false); setRescheduleArmed(false); setRegenTyped(''); setConfirmRegenerate(false); }}>Close</Button>}
                  {!regenerateMode && maxExistingWeek > 0 && <span className="text-xs text-gray-500">Weeks 1 to {maxExistingWeek} stay exactly as they are.</span>}
                  {regenerateMode && locked.length > 0 && <span className="text-xs text-gray-500">Week{locked.length > 1 ? 's' : ''} {locked.join(', ')} {locked.length > 1 ? 'are' : 'is'} locked (played or in play) and will not change.</span>}
                  {confirmRegenerate && (
                    <div className="flex items-center gap-2 p-2 rounded bg-red-50 border border-red-300 text-sm text-red-700">
                      <AlertTriangle className="w-4 h-4" />
                      This replaces weeks {startWeek} onward and deletes their scores. Locked weeks ({locked.join(', ') || 'none'}) are untouched. Continue?
                      <Button size="sm" variant="destructive" onClick={handleGenerate} disabled={generating}>Yes, regenerate</Button>
                      <Button size="sm" variant="outline" onClick={() => setConfirmRegenerate(false)}>Cancel</Button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Each week every team plays everyone in its room once plus one designated opponent a second time. The generator spreads room assignments
                  so every pair of teams meets as evenly as possible across the season and every team alternates between Side A and Side B.
                </p>
                {pairSummary && (
                  <div className="text-xs text-gray-600 flex flex-wrap gap-3">
                    <span>Games between any two teams over the season: <strong>{pairSummary.min} to {pairSummary.max}</strong></span>
                    <span>
                      {Object.entries(pairSummary.hist).sort((x, y) => Number(x[0]) - Number(y[0])).map(([k, v]) => `${v} pairs meet ${k}×`).join(' · ')}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
              );
            })()}

            {weeks.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">Side Assignments</CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => downloadText(`${league.name.replace(/\s+/g, '_')}_sides.csv`, leagueGridCsv(weeks, teams))}>
                      <Download className="w-4 h-4 mr-1" /> CSV
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => window.print()}>
                      <Printer className="w-4 h-4 mr-1" /> Print
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="text-sm border-collapse w-full">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="text-left p-2 border">Team</th>
                        {weeks.map(w => <th key={w.week} className="p-2 border text-center">Wk {w.week}</th>)}
                        <th className="p-2 border text-center">A / B</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gridTeamIds.map(id => {
                        const sides = weeks.map(w => (w.open ? 'open' : teamSideForWeek(weeks, id, w.week)) as LeagueSide | 'open' | null);
                        const aCount = sides.filter(s => s === 'A').length;
                        const bCount = sides.filter(s => s === 'B').length;
                        return (
                          <tr key={id} className="odd:bg-white even:bg-gray-50">
                            <td className="p-2 border whitespace-nowrap font-medium">{teamLabel(teams, id)}</td>
                            {sides.map((s, i) => (
                              <td key={i} className="p-1 border text-center">
                                {s === 'open' ? <span className="inline-block px-1 py-0.5 rounded border border-gray-300 text-[10px] text-gray-500">open</span> : s && <span className={`inline-block w-8 py-0.5 rounded border font-bold ${sideClasses[s]}`}>{s}</span>}
                              </td>
                            ))}
                            <td className="p-2 border text-center text-xs text-gray-600">{aCount} / {bCount}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            {weeks.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Rooms by Week</CardTitle></CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {weeks.map(w => (
                    <div key={w.week} className="rounded-lg border p-3">
                      <div className="font-bold mb-2">Week {w.week}</div>
                      {w.open ? (
                        <div className="text-sm text-gray-600"><span className="inline-block px-2 py-0.5 rounded border text-xs font-bold mr-2 border-gray-300">Open play</span>{(w.teams ?? []).length} teams, hand-scored</div>
                      ) : editWeek === w.week ? (
                        <div className="space-y-2 text-sm">
                          <div className="text-xs text-gray-600">Click a team to move it to the other side. Sides must stay equal.</div>
                          {registered.filter(t => !editA.includes(String(t.id)) && !editB.includes(String(t.id))).length > 0 && (
                            <div className="p-2 rounded bg-orange-50 border border-orange-300">
                              <div className="text-xs font-semibold text-orange-800 mb-1">Not in this week yet. Click to add:</div>
                              <span className="inline-flex flex-wrap gap-1">
                                {registered.filter(t => !editA.includes(String(t.id)) && !editB.includes(String(t.id))).map(t => (
                                  <button key={t.id} type="button" className="px-2 py-0.5 rounded border border-orange-400 bg-white hover:bg-orange-100 text-xs font-semibold" onClick={() => addTeamToWeek(String(t.id))}>+ {no(String(t.id))}</button>
                                ))}
                              </span>
                            </div>
                          )}
                          {(['A', 'B'] as const).map(side => (
                            <div key={side}>
                              <span className={`inline-block px-2 py-0.5 rounded border text-xs font-bold mr-2 ${sideClasses[side]}`}>Side {side} ({(side === 'A' ? editA : editB).length})</span>
                              <span className="inline-flex flex-wrap gap-1 align-middle">
                                {(side === 'A' ? editA : editB).slice().sort((x, y) => Number(no(x)) - Number(no(y))).map(t => (
                                  <span key={t} className="inline-flex items-center rounded border bg-white">
                                    <button type="button" className="px-2 py-0.5 hover:bg-gray-100 text-xs font-semibold" title="Move to the other side" onClick={() => moveTeam(t)}>{no(t)}</button>
                                    <button type="button" className="px-1 text-[10px] text-gray-400 hover:text-red-600" title="Remove from this week" onClick={() => removeTeamFromWeek(t)}>×</button>
                                  </span>
                                ))}
                              </span>
                            </div>
                          ))}
                          <div className="flex gap-2">
                            <Button size="sm" className="text-white" style={{ backgroundColor: BRAND }} disabled={savingRooms || editA.length !== editB.length} onClick={saveRooms}>{savingRooms ? 'Saving…' : 'Save rooms'}</Button>
                            <Button size="sm" variant="outline" disabled={savingRooms} onClick={() => setEditWeek(null)}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {(['A', 'B'] as LeagueSide[]).map(side => (
                            <div key={side} className="mb-2">
                              <span className={`inline-block px-2 py-0.5 rounded border text-xs font-bold mr-2 ${sideClasses[side]}`}>Side {side}</span>
                              <span className="text-sm">{(side === 'A' ? w.sideA : w.sideB).map(no).join(', ')}</span>
                            </div>
                          ))}
                          {locked.includes(w.week) ? (
                            <>
                              <div className="text-[11px] text-gray-500">Locked: has scores</div>
                              {(() => {
                                const missing = registered.map(t => String(t.id)).filter(id => !w.sideA.includes(id) && !w.sideB.includes(id));
                                const smaller: LeagueSide = w.sideA.length <= w.sideB.length ? 'A' : 'B';
                                const wouldAdd = schedule ? buildMissingTeamMatches(league!.id, w.week, schedule, missing.map(id => ({ teamId: id, side: fixSides[`${w.week}:${id}`] ?? smaller })), 'preview').length : 0;
                                if (missing.length === 0 && wouldAdd === 0) return null;
                                return (
                                  <div className="mt-2 p-2 rounded bg-orange-50 border border-orange-300 space-y-1" data-testid={`fix-week-${w.week}`}>
                                    <div className="text-xs font-semibold text-orange-800">{missing.length > 0 ? `Missing from this week: ${missing.map(no).join(', ')}` : 'This week is short of games'} · {wouldAdd} game{wouldAdd === 1 ? '' : 's'} would be added</div>
                                    <div className="text-[11px] text-gray-700">{missing.length > 0 ? 'Pick a side for each, then add the games. ' : ''}Only pairings with no game yet are added. Every existing game and score stays exactly as it is.</div>
                                    <div className="flex flex-wrap gap-2">
                                      {missing.map(id => {
                                        const cur = fixSides[`${w.week}:${id}`] ?? smaller;
                                        return (
                                          <span key={id} className="inline-flex items-center gap-1 text-xs">
                                            <span className="font-semibold">{no(id)}</span>
                                            {(['A', 'B'] as LeagueSide[]).map(sd => (
                                              <button key={sd} type="button" className={`px-1.5 py-0.5 rounded border font-bold ${cur === sd ? sideClasses[sd] : 'bg-white text-gray-400 border-gray-200'}`} onClick={() => setFixSides(p => ({ ...p, [`${w.week}:${id}`]: sd }))}>{sd}</button>
                                            ))}
                                          </span>
                                        );
                                      })}
                                    </div>
                                    <Button size="sm" className="h-7 text-white" style={{ backgroundColor: BRAND }} disabled={fixingWeek === w.week} onClick={() => addMissingToWeek(w, missing)}>
                                      {fixingWeek === w.week ? 'Adding…' : missing.length > 0 ? `Add games for ${missing.map(no).join(', ')}` : `Add the ${wouldAdd} missing game${wouldAdd === 1 ? '' : 's'}`}
                                    </Button>
                                  </div>
                                );
                              })()}
                            </>
                          ) : (
                            <button type="button" className="text-xs underline text-gray-600" onClick={() => openRoomEditor(w.week)}>Edit rooms</button>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ---------------- Weekly games ---------------- */}
          <TabsContent value="week" className="space-y-4">
            {weeks.length === 0 ? (
              <Card><CardContent className="pt-4 text-sm text-gray-600">Generate the season first.</CardContent></Card>
            ) : (
              <>
                <Card>
                  <CardContent className="pt-4 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold mr-2">Week</span>
                    {weeks.map(w => {
                      const ms = schedule!.matches.filter(m => m.round === w.week);
                      const done = ms.filter(m => confirmedFor(m)).length;
                      return (
                        <Button key={w.week} size="sm" variant={selectedWeek === w.week ? 'default' : 'outline'}
                          style={selectedWeek === w.week ? { backgroundColor: BRAND } : undefined}
                          onClick={() => { setSelectedWeek(w.week); setEditingMatchId(null); }}>
                          {w.week} <span className="ml-1 text-[10px] opacity-75">{done}/{ms.length}</span>
                        </Button>
                      );
                    })}
                    <div className="ml-auto flex items-center gap-2">
                      {teamFilter ? (
                        <Button size="sm" variant="outline" className="h-8" onClick={() => setTeamFilter('')}>Team {teamFilter} <X className="w-3 h-3 ml-1" /></Button>
                      ) : (
                        <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                          <input type="checkbox" checked={showAllGames} onChange={e => setShowAllGames(e.target.checked)} /> Show all games
                        </label>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-dashed">
                  <CardContent className="pt-3 pb-3 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold">Makeup game</span>
                    <span className="text-xs text-gray-500">for a team that missed a week. The first team is the one that <strong>owes</strong> the game; the result counts for it only. The opponent's record is not affected.</span>
                    <select className="border rounded px-2 py-1 bg-white" value={mkTeam} onChange={e => setMkTeam(e.target.value)}>
                      <option value="">Team that owes the game…</option>
                      {owingTeams(mkWeek).map(t => <option key={t.id} value={String(t.id)}>{teamLabel(teams, String(t.id))}</option>)}
                    </select>
                    <span className="text-xs text-gray-500">vs</span>
                    <select className="border rounded px-2 py-1 bg-white" value={mkOpp} onChange={e => setMkOpp(e.target.value)}>
                      <option value="">Opponent…</option>
                      {registered.filter(t => String(t.id) !== mkTeam).map(t => <option key={t.id} value={String(t.id)}>{teamLabel(teams, String(t.id))}</option>)}
                    </select>
                    <span className="text-xs text-gray-500">week</span>
                    <select className="border rounded px-2 py-1 bg-white" value={mkWeek} onChange={e => setMkWeek(Number(e.target.value))}>
                      {weeks.map(w => <option key={w.week} value={w.week}>{w.week}</option>)}
                    </select>
                    <Button size="sm" disabled={!mkTeam || !mkOpp || mkTeam === mkOpp} onClick={addMakeup} className="text-white" style={{ backgroundColor: BRAND }}>Add and score</Button>
                    {mkTeam && mkOpp && mkTeam !== mkOpp && <span className="text-xs text-purple-700 font-semibold w-full">Counts for Team {no(mkTeam)} only. Team {no(mkOpp)}'s record does not change.</span>}
                    {owingTeams(mkWeek).length === 0 && <span className="text-xs text-gray-500 w-full">No team owes games in Week {mkWeek}.</span>}
                  </CardContent>
                </Card>

                {(() => {
                  const wk = weeks.find(w => w.week === selectedWeek)!;
                  const sides: (LeagueSide | null)[] = wk.open ? [null] : ['A', 'B'];
                  return sides.map(side => {
                  const roomTeams = wk.open ? (wk.teams ?? []) : side === 'A' ? wk.sideA : wk.sideB;
                  const roomMatches = schedule!.matches
                    .filter(m => m.round === selectedWeek && (wk.open || leagueMatchInfo(m).side === side || (leagueMatchInfo(m).countsFor !== null && roomTeams.includes(String(m.teamA)))))
                    .sort((x, y) => Number(no(x.teamA)) - Number(no(y.teamA)) || Number(no(x.teamB)) - Number(no(y.teamB)) || x.id.localeCompare(y.id));
                  const ms = roomMatches.filter(m => !teamFilter || no(String(m.teamA)) === teamFilter || no(String(m.teamB)) === teamFilter);
                  const doneCount = roomMatches.filter(m => confirmedFor(m)).length;
                  const countsFor = (m: ScheduleMatch, t: string) => { const c = leagueMatchInfo(m).countsFor; return !c || c === t; };
                  const playedBy = (t: string) => roomMatches.filter(m => (String(m.teamA) === t || String(m.teamB) === t) && confirmedFor(m) && countsFor(m, t)).length;
                  const owedBy = (t: string) => wk.open ? Math.max(0, LEAGUE_GAMES_PER_WEEK - playedBy(t)) : roomMatches.filter(m => (String(m.teamA) === t || String(m.teamB) === t) && countsFor(m, t) && !confirmedFor(m)).length;
                  const listOpen = showAllGames || !!teamFilter;
                  const filteredTeamInRoom = !!teamFilter && (roomTeams.some(t => no(t) === teamFilter) || roomMatches.some(m => no(String(m.teamA)) === teamFilter || no(String(m.teamB)) === teamFilter));
                  return (
                    <Card key={side ?? 'open'}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex flex-wrap items-center gap-2">
                          {side ? <span className={`inline-block px-2 py-0.5 rounded border ${sideClasses[side]}`}>Side {side}</span> : <span className="inline-block px-2 py-0.5 rounded border border-gray-300">Open play</span>}
                          <span className="text-sm font-normal text-gray-600">Week {selectedWeek} · {roomTeams.length} teams · {doneCount} of {roomMatches.length} games confirmed</span>
                        </CardTitle>
                        <div className="text-xs text-gray-600 flex flex-wrap items-center gap-1">
                          <span className="mr-1">Teams:</span>
                          {roomTeams.map(t => (
                            <span key={t} className={`inline-flex items-center rounded border ${teamFilter === no(t) ? 'bg-red-50 border-red-400' : 'bg-gray-50'}`} title={`Team ${no(t)}: ${playedBy(t)} in, ${owedBy(t)} to play. Click to see this team's games.`}>
                              <button type="button" className="pl-2 pr-1 py-0.5 flex items-center gap-1 hover:text-red-700" onClick={() => toggleTeamFilter(no(t))}>
                                <span className="font-semibold">{no(t)}</span>
                                <span className={`text-[10px] ${owedBy(t) === 0 ? 'text-green-700' : 'text-orange-700'}`}>{playedBy(t)}/{playedBy(t) + owedBy(t)}</span>
                              </button>
                              {!wk.open && (
                                <button
                                  type="button"
                                  title={`Team ${no(t)} did not show: record every unplayed Week ${selectedWeek} game as a 0 to ${FORFEIT_WIN_POINTS} loss`}
                                  className="ml-1 px-1.5 py-0.5 text-red-600 hover:bg-red-50 rounded-r"
                                  onClick={() => setForfeitTeam(forfeitTeam === t ? null : t)}
                                >
                                  <UserX className="w-3 h-3" />
                                </button>
                              )}
                              {wk.open && <span className="pr-1" />}
                            </span>
                          ))}
                          {wk.open && registered.filter(t => !roomTeams.includes(String(t.id))).map(t => (
                            <span key={t.id} className="inline-flex items-center rounded border border-orange-300 bg-orange-50 px-2 text-orange-800" title="No games this week yet">
                              <span className="font-semibold">{no(String(t.id))}</span><span className="ml-1 text-[10px]">0/{LEAGUE_GAMES_PER_WEEK}</span>
                            </span>
                          ))}
                        </div>
                        {forfeitTeam && roomTeams.includes(forfeitTeam) && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 p-2 rounded bg-red-50 border border-red-300 text-sm text-red-800">
                            <AlertTriangle className="w-4 h-4" />
                            Team {no(forfeitTeam)} no-show: every unplayed Week {selectedWeek} game becomes a loss, opponents get {FORFEIT_WIN_POINTS} points. Games already scored are untouched.
                            <Button size="sm" variant="destructive" disabled={forfeiting} onClick={() => forfeitWeek(forfeitTeam)}>{forfeiting ? 'Saving…' : 'Yes, forfeit'}</Button>
                            <Button size="sm" variant="outline" disabled={forfeiting} onClick={() => setForfeitTeam(null)}>Cancel</Button>
                          </div>
                        )}
                      </CardHeader>
                      {listOpen && (!teamFilter || filteredTeamInRoom) && (
                      <CardContent className="space-y-1">
                        {teamFilter && <div className="text-xs text-gray-600 mb-1">Team {teamFilter}: {ms.filter(m => confirmedFor(m)).length} of {ms.length} games in this week.</div>}
                        {ms.map(m => {
                          const info = leagueMatchInfo(m);
                          const confirmed = confirmedFor(m);
                          const pending = !confirmed ? anyFor(m) : undefined;
                          const editing = editingMatchId === m.id;
                          return (
                            <div key={m.id} className={`rounded border px-3 py-2 ${confirmed ? 'bg-green-50 border-green-200' : pending ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}`}>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-sm w-44 truncate">{teamLabel(teams, m.teamA)}</span>
                                <span className="text-xs text-gray-400">vs</span>
                                <span className="font-semibold text-sm w-44 truncate">{teamLabel(teams, m.teamB)}</span>
                                {info.gameNo === 2 && <Badge variant="outline" className="text-[10px]">2nd game</Badge>}
                                {info.countsFor && (
                                  <>
                                    <Badge className="text-[10px] bg-purple-700 text-white" title="One-sided makeup: counts for the owing team only">MAKEUP · counts for {no(info.countsFor)} only</Badge>
                                    <button type="button" className="text-[10px] underline text-purple-700" title="Move the credit to the other team, keeping the score" onClick={() => flipMakeup(m)}>
                                      flip to {no(String(m.teamA) === info.countsFor ? m.teamB : m.teamA)}
                                    </button>
                                  </>
                                )}
                                {isForfeitGame(confirmed) && <Badge className="text-[10px] bg-gray-700 text-white">FORFEIT</Badge>}
                                <span className="ml-auto flex items-center gap-2">
                                  {confirmed ? (
                                    <span className="text-sm">
                                      <span className={confirmed.winner === 'teamA' ? 'font-bold text-green-700' : ''}>{confirmed.scoreA}</span>
                                      {' – '}
                                      <span className={confirmed.winner === 'teamB' ? 'font-bold text-green-700' : ''}>{confirmed.scoreB}</span>
                                      <span className="text-xs text-gray-500 ml-2">W: {no(confirmed.winner === 'teamA' ? m.teamA : m.teamB)}</span>
                                    </span>
                                  ) : pending ? (
                                    <Badge className="bg-yellow-200 text-yellow-900 text-[10px]">
                                      {pending.status === 'entering' ? `Team ${no(String(pending.entered_by_team_id))} entering` : pending.status === 'pending_confirmation' ? `Entered by ${no(String(pending.entered_by_team_id))}, awaiting confirm` : pending.status}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] text-gray-500">Not played</Badge>
                                  )}
                                  {!editing && (
                                    <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setEditingMatchId(m.id)}>
                                      <Pencil className="w-3 h-3 mr-1" /> {confirmed ? 'Edit' : 'Enter'}
                                    </Button>
                                  )}
                                  {(confirmed || pending) && !editing && (
                                    <Button size="sm" variant="ghost" className="h-7 px-2 text-red-600" onClick={() => clearScore(m)} title="Clear this score">
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  )}
                                </span>
                              </div>
                              {editing && (
                                <MatchScoreEditor match={m} teams={teams} tracksHands={tracksHands} existing={confirmed} onDone={() => setEditingMatchId(null)} />
                              )}
                            </div>
                          );
                        })}
                        {ms.length === 0 && <div className="text-sm text-gray-500">No games for that team here.</div>}
                      </CardContent>
                      )}
                      {!listOpen && (
                        <CardContent className="pt-0 text-xs text-gray-500">Click a team to see its games, or tick "Show all games".</CardContent>
                      )}
                    </Card>
                  );
                  });
                })()}
              </>
            )}
          </TabsContent>

          {/* ---------------- Standings ---------------- */}
          <TabsContent value="standings" className="space-y-4">
            {weeks.length === 0 ? (
              <Card><CardContent className="pt-4 text-sm text-gray-600">Generate the season first.</CardContent></Card>
            ) : (
              <Card>
                <CardHeader className="flex flex-row flex-wrap items-center justify-between space-y-0 gap-2">
                  <CardTitle className="text-base">{weekOnly ? `Week ${weekOnly} Standings` : `Standings ${throughWeek ? `through Week ${throughWeek}` : '(season to date)'}`}</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Show</span>
                    <select className="border rounded px-2 py-1 text-sm bg-white" value={weekOnly ? `w${weekOnly}` : `t${throughWeek}`} onChange={e => {
                      const v = e.target.value;
                      if (v.startsWith('w')) { setWeekOnly(Number(v.slice(1))); setThroughWeek(0); } else { setWeekOnly(0); setThroughWeek(Number(v.slice(1))); }
                    }}>
                      <option value="t0">Season to date</option>
                      {weeks.map(w => <option key={`w${w.week}`} value={`w${w.week}`}>Week {w.week} only</option>)}
                      {weeks.map(w => <option key={`t${w.week}`} value={`t${w.week}`}>Season through Week {w.week}</option>)}
                    </select>
                    <Button size="sm" variant="outline" onClick={() => {
                      const header = ['Rank', 'Team #', 'Team', 'W', 'L', 'Played', 'Points', 'Points Against', ...(tracksHands ? ['Hands'] : []), 'Bostons', ...weeks.map(w => `Wk${w.week} W-L`)];
                      const lines = [header.join(',')];
                      standings.forEach(r => lines.push([r.rank, no(r.teamId), `"${r.teamName.replace(/"/g, '""')}"`, r.wins, r.losses, r.played, r.points, r.pointsAgainst, ...(tracksHands ? [r.hands] : []), r.bostons, ...weeks.map(w => `${r.weeks[w.week]?.wins ?? 0}-${r.weeks[w.week]?.losses ?? 0}`)].join(',')));
                      downloadText(`${league.name.replace(/\s+/g, '_')}_standings.csv`, lines.join('\n'));
                    }}>
                      <Download className="w-4 h-4 mr-1" /> CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {weekOnly ? (
                    <table className="text-sm border-collapse w-full">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="p-2 border">#</th>
                          <th className="p-2 border text-left">Team</th>
                          <th className="p-2 border">Side</th>
                          <th className="p-2 border">W</th>
                          <th className="p-2 border">L</th>
                          <th className="p-2 border">Pts</th>
                          <th className="p-2 border">Bostons</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leagueWeekTable(getLeagueStandings(teams, games, schedule), weekOnly).map(r => (
                          <tr key={r.teamId} className="odd:bg-white even:bg-gray-50">
                            <td className="p-2 border text-center font-bold">{r.rank}</td>
                            <td className="p-2 border whitespace-nowrap">{teamLabel(teams, r.teamId)}</td>
                            <td className="p-2 border text-center">{r.side ? <span className={`inline-block w-5 rounded text-[10px] font-bold ${sideClasses[r.side]}`}>{r.side}</span> : <span className="text-[10px] text-gray-400">open</span>}</td>
                            <td className="p-2 border text-center font-bold">{r.wins}</td>
                            <td className="p-2 border text-center">{r.losses}</td>
                            <td className="p-2 border text-center font-semibold">{r.points}</td>
                            <td className="p-2 border text-center">{r.bostons}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                  <table className="text-sm border-collapse w-full">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-2 border">#</th>
                        <th className="p-2 border text-left">Team</th>
                        <th className="p-2 border">W</th>
                        <th className="p-2 border">L</th>
                        <th className="p-2 border">GP</th>
                        <th className="p-2 border">Pts</th>
                        <th className="p-2 border">Pts Agst</th>
                        {tracksHands && <th className="p-2 border">Hands</th>}
                        <th className="p-2 border">Bostons</th>
                        {weeks.map(w => <th key={w.week} className="p-1 border text-[11px] text-gray-600">Wk {w.week}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map(r => (
                        <tr key={r.teamId} className="odd:bg-white even:bg-gray-50">
                          <td className="p-2 border text-center font-bold">{r.rank}</td>
                          <td className="p-2 border whitespace-nowrap">{teamLabel(teams, r.teamId)}</td>
                          <td className="p-2 border text-center font-bold">{r.wins}</td>
                          <td className="p-2 border text-center">{r.losses}</td>
                          <td className="p-2 border text-center">{r.played}</td>
                          <td className="p-2 border text-center font-semibold">{r.points}</td>
                          <td className="p-2 border text-center text-gray-600">{r.pointsAgainst}</td>
                          {tracksHands && <td className="p-2 border text-center">{r.hands}</td>}
                          <td className="p-2 border text-center">{r.bostons}</td>
                          {weeks.map(w => {
                            const wk = r.weeks[w.week];
                            const hidden = throughWeek && w.week > throughWeek;
                            return (
                              <td key={w.week} className="p-1 border text-center text-[11px] whitespace-nowrap">
                                {hidden ? '' : (<>
                                  {wk?.side && <span className={`inline-block w-4 rounded text-[10px] font-bold mr-1 ${sideClasses[wk.side]}`}>{wk.side}</span>}
                                  {wk ? `${wk.wins}-${wk.losses}` : ''}
                                </>)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  )}
                  <p className="text-xs text-gray-500 mt-2">Sorted by wins, then {weekOnly ? 'points that week' : 'total points'}, then team number. Only confirmed games count, one score per game.</p>
                </CardContent>
              </Card>
            )}

            {weeks.length > 0 && (
              <Card className={audit.duplicates.length || audit.orphans.length || audit.overCount.length ? 'border-orange-400' : ''}>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-orange-600" /> Data check</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {!audit.duplicates.length && !audit.orphans.length && !audit.overCount.length && !missingByWeek.length && (
                    <div className="text-gray-600">Clean: every game has one score, every score belongs to a game, and no team is over {LEAGUE_GAMES_PER_WEEK} games in any week.</div>
                  )}
                  {audit.duplicates.length > 0 && (
                    <div>
                      <div className="font-semibold text-orange-800">Games with more than one confirmed score ({audit.duplicates.length}). Standings use the newest; the rest can be removed.</div>
                      {audit.duplicates.map(d => (
                        <div key={d.match.id} className="flex flex-wrap items-center gap-2 mt-1 p-2 rounded bg-orange-50 border border-orange-200">
                          <span>Week {d.match.round}: {teamLabel(teams, d.match.teamA)} vs {teamLabel(teams, d.match.teamB)}</span>
                          <span className="text-xs text-gray-600">kept {d.kept.scoreA}–{d.kept.scoreB} ({new Date(d.kept.timestamp).toLocaleString()}); extra: {d.extra.map(g => `${g.scoreA}–${g.scoreB} by ${g.submittedBy || '?'}`).join(', ')}</span>
                          <Button size="sm" variant="outline" className="h-7" onClick={() => removeExtraRows(d.extra.map(g => g.id))}><Trash2 className="w-3 h-3 mr-1" /> Remove extra</Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {missingByWeek.length > 0 && (
                    <div>
                      <div className="font-semibold text-orange-800">Registered teams with no games in a week</div>
                      <div className="text-xs text-gray-700">
                        {missingByWeek.map(x => `Week ${x.week}: team${x.missing.length > 1 ? 's' : ''} ${x.missing.map(no).join(', ')}`).join(' · ')}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">Fix: Season Schedule, Rooms by Week, Edit rooms on that week, click the missing teams to add them, Save.</div>
                    </div>
                  )}
                  {audit.overCount.length > 0 && (
                    <div>
                      <div className="font-semibold text-orange-800">Teams over {LEAGUE_GAMES_PER_WEEK} games in a week</div>
                      <div className="text-xs text-gray-700">{audit.overCount.map(o => `Team ${no(o.teamId)}: Week ${o.week}, ${o.games} games`).join(' · ')}</div>
                    </div>
                  )}
                  {audit.orphans.length > 0 && (
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-orange-800">Confirmed scores not attached to any game ({audit.orphans.length}), ignored by standings</span>
                        <Button size="sm" className="h-7 text-white" style={{ backgroundColor: BRAND }} disabled={restoringOrphans} onClick={() => applyOrphanFixes(audit.orphans)} data-testid="restore-all-orphans">
                          <Check className="w-3 h-3 mr-1" /> {restoringOrphans ? 'Restoring…' : `Restore all ${audit.orphans.length}`}
                        </Button>
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">Each score goes back onto its game with its side and week. No existing score is changed.</div>
                      {audit.orphans.map(g => {
                        const id = String(g.matchId);
                        const at = id.lastIndexOf('-for');
                        const forTeam = at >= 0 ? id.slice(at + 4) : null;
                        const wk = /-w(\d+)-/.exec(id);
                        return (
                          <div key={g.id} className="flex flex-wrap items-center gap-2 mt-1 p-2 rounded bg-orange-50 border border-orange-200 text-xs">
                            <span>Week {wk ? wk[1] : (g.round ?? '?')}: {teamLabel(teams, String(g.teamA))} vs {teamLabel(teams, String(g.teamB))} · {g.scoreA}–{g.scoreB}{forTeam ? ` · makeup, counts for ${no(forTeam)} only` : ''}</span>
                            <Button size="sm" variant="outline" className="h-7" onClick={() => restoreOrphan(g)}><Check className="w-3 h-3 mr-1" /> Restore game</Button>
                            <Button size="sm" variant="ghost" className="h-7 text-red-600" onClick={() => removeExtraRows([g.id])}><Trash2 className="w-3 h-3 mr-1" /> Remove</Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {weeks.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Leaders {throughWeek ? `through Week ${throughWeek}` : '(season to date)'}</CardTitle></CardHeader>
                <CardContent><LeagueLeadersPanel leaders={leagueSeasonLeaders(standings)} /></CardContent>
              </Card>
            )}

            {weeks.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Weekly Results</CardTitle></CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  {weeks.map(w => {
                    const leaders = leagueWeekLeaders(standings, w.week);
                    const played = standings.some(r => (r.weeks[w.week]?.wins ?? 0) + (r.weeks[w.week]?.losses ?? 0) > 0);
                    return (
                      <div key={w.week} className="rounded-lg border p-3">
                        <div className="font-bold mb-2">Week {w.week}</div>
                        {played ? <LeagueLeadersPanel leaders={leaders} compact /> : <div className="text-xs text-gray-500">No games scored yet</div>}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default LeagueManager;
