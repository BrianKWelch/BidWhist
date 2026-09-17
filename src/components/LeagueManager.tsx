import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import type { Game, ScheduleMatch, Team } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Download, Printer, RefreshCw, Trophy, CalendarDays, ListChecks, AlertTriangle, Pencil, Trash2, Check, X } from 'lucide-react';
import {
  buildLeagueMatches,
  currentLeagueWeek,
  gameBelongsToMatch,
  generateLeagueSeason,
  getLeagueStandings,
  isLeagueTournament,
  leagueGridCsv,
  leagueMatchInfo,
  leagueWeeksFromSchedule,
  leagueWeeksOf,
  teamSideForWeek,
  type LeagueSide,
  type LeagueWeek,
} from '@/lib/league';

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
  return `${t.id} · ${t.player1FirstName || ''}/${t.player2FirstName || ''}`;
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
  const { teams, tournaments, schedules, games, getActiveTournament, saveSchedule, updateTournament, refreshGamesFromSupabase, refreshSchedules } = useAppContext();

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
    () => teams.filter(t => t.registeredTournaments?.includes(league?.id ?? '__none__')).sort((x, y) => Number(x.id) - Number(y.id)),
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

  // Keep scores fresh while the admin is on this tab.
  useEffect(() => {
    const id = setInterval(() => { refreshGamesFromSupabase(); }, 3000);
    return () => clearInterval(id);
  }, [refreshGamesFromSupabase]);

  // ---- Generation ---------------------------------------------------------
  const handleGenerate = async () => {
    if (!league) return;
    const n = registered.length;
    const w = parseInt(weeksInput) || plannedWeeks;
    if (n < 4) { toast({ title: 'Need at least 4 registered teams', variant: 'destructive' }); return; }
    if (n % 2 !== 0) { toast({ title: `Even number of teams required (currently ${n})`, description: 'Both sides must be the same size.', variant: 'destructive' }); return; }
    if (schedule && !confirmRegenerate) { setConfirmRegenerate(true); return; }
    setGenerating(true);
    try {
      const season = generateLeagueSeason(registered.map(t => String(t.id)), w);
      const matches = buildLeagueMatches(league.id, season);
      const { supabase } = await import('../supabaseClient');
      if (schedule) {
        // Regenerating: old match ids go away, so their scores must too.
        const oldIds = schedule.matches.map(m => m.id);
        for (let i = 0; i < oldIds.length; i += 200) {
          const { error } = await supabase.from('games').delete().in('matchId', oldIds.slice(i, i + 200));
          if (error) throw new Error(error.message);
        }
      }
      await saveSchedule({ tournamentId: league.id, rounds: w, matches });
      if (w !== leagueWeeksOf(league)) {
        await updateTournament(league.id, league.name, league.cost, league.bostonPotCost, league.description, league.status, undefined, undefined, undefined, undefined, undefined, 'league', w);
      }
      await Promise.all([refreshSchedules(), refreshGamesFromSupabase()]);
      setConfirmRegenerate(false);
      toast({
        title: `Season generated: ${w} weeks, ${matches.length} games`,
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
  const [throughWeek, setThroughWeek] = useState<number>(0);

  const standings = useMemo(
    () => getLeagueStandings(teams, games, schedule, throughWeek || undefined),
    [teams, games, schedule, throughWeek],
  );

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
            <Card>
              <CardHeader><CardTitle className="text-base">Generate Season</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Weeks</label>
                    <Input type="number" min={1} max={52} value={weeksInput} onChange={e => setWeeksInput(e.target.value)} className="w-24" />
                  </div>
                  <div className="text-sm text-gray-600">
                    {registered.length} registered teams → {registered.length / 2} per side, {registered.length / 2} games per team per week
                    {registered.length % 2 === 1 && <span className="text-red-600 font-semibold"> (needs an even count)</span>}
                  </div>
                  <Button onClick={handleGenerate} disabled={generating || registered.length < 4 || registered.length % 2 !== 0} style={{ backgroundColor: BRAND }} className="text-white">
                    {generating ? 'Generating…' : schedule ? 'Regenerate Season' : 'Generate Season'}
                  </Button>
                  {confirmRegenerate && (
                    <div className="flex items-center gap-2 p-2 rounded bg-red-50 border border-red-300 text-sm text-red-700">
                      <AlertTriangle className="w-4 h-4" />
                      This replaces the whole schedule and deletes every league score. Continue?
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
                        const sides = weeks.map(w => teamSideForWeek(weeks, id, w.week));
                        const aCount = sides.filter(s => s === 'A').length;
                        return (
                          <tr key={id} className="odd:bg-white even:bg-gray-50">
                            <td className="p-2 border whitespace-nowrap font-medium">{teamLabel(teams, id)}</td>
                            {sides.map((s, i) => (
                              <td key={i} className="p-1 border text-center">
                                {s && <span className={`inline-block w-8 py-0.5 rounded border font-bold ${sideClasses[s]}`}>{s}</span>}
                              </td>
                            ))}
                            <td className="p-2 border text-center text-xs text-gray-600">{aCount} / {sides.length - aCount}</td>
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
                      {(['A', 'B'] as LeagueSide[]).map(side => (
                        <div key={side} className="mb-2">
                          <span className={`inline-block px-2 py-0.5 rounded border text-xs font-bold mr-2 ${sideClasses[side]}`}>Side {side}</span>
                          <span className="text-sm">{(side === 'A' ? w.sideA : w.sideB).join(', ')}</span>
                        </div>
                      ))}
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
                      <span className="text-xs text-gray-500">Find team #</span>
                      <Input value={teamFilter} onChange={e => setTeamFilter(e.target.value.trim())} className="w-20" placeholder="—" />
                    </div>
                  </CardContent>
                </Card>

                {(['A', 'B'] as LeagueSide[]).map(side => {
                  const wk = weeks.find(w => w.week === selectedWeek)!;
                  const roomTeams = side === 'A' ? wk.sideA : wk.sideB;
                  const ms = schedule!.matches
                    .filter(m => m.round === selectedWeek && leagueMatchInfo(m).side === side)
                    .filter(m => !teamFilter || String(m.teamA) === teamFilter || String(m.teamB) === teamFilter)
                    .sort((x, y) => Number(x.teamA) - Number(y.teamA) || Number(x.teamB) - Number(y.teamB) || x.id.localeCompare(y.id));
                  const doneCount = ms.filter(m => confirmedFor(m)).length;
                  return (
                    <Card key={side}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex flex-wrap items-center gap-2">
                          <span className={`inline-block px-2 py-0.5 rounded border ${sideClasses[side]}`}>Side {side}</span>
                          <span className="text-sm font-normal text-gray-600">Week {selectedWeek} · {roomTeams.length} teams · {doneCount} of {ms.length} games confirmed</span>
                        </CardTitle>
                        <div className="text-xs text-gray-600">Teams: {roomTeams.join(', ')}</div>
                      </CardHeader>
                      <CardContent className="space-y-1">
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
                                <span className="ml-auto flex items-center gap-2">
                                  {confirmed ? (
                                    <span className="text-sm">
                                      <span className={confirmed.winner === 'teamA' ? 'font-bold text-green-700' : ''}>{confirmed.scoreA}</span>
                                      {' – '}
                                      <span className={confirmed.winner === 'teamB' ? 'font-bold text-green-700' : ''}>{confirmed.scoreB}</span>
                                      <span className="text-xs text-gray-500 ml-2">W: {confirmed.winner === 'teamA' ? m.teamA : m.teamB}</span>
                                    </span>
                                  ) : pending ? (
                                    <Badge className="bg-yellow-200 text-yellow-900 text-[10px]">
                                      {pending.status === 'entering' ? `Team ${pending.entered_by_team_id} entering` : pending.status === 'pending_confirmation' ? `Entered by ${pending.entered_by_team_id}, awaiting confirm` : pending.status}
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
                        {ms.length === 0 && <div className="text-sm text-gray-500">No games match that filter.</div>}
                      </CardContent>
                    </Card>
                  );
                })}
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
                  <CardTitle className="text-base">Standings {throughWeek ? `through Week ${throughWeek}` : '(season to date)'}</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Through week</span>
                    <select className="border rounded px-2 py-1 text-sm bg-white" value={throughWeek} onChange={e => setThroughWeek(Number(e.target.value))}>
                      <option value={0}>All</option>
                      {weeks.map(w => <option key={w.week} value={w.week}>{w.week}</option>)}
                    </select>
                    <Button size="sm" variant="outline" onClick={() => {
                      const header = ['Rank', 'Team #', 'Team', 'W', 'L', 'Played', 'Points', 'Points Against', ...(tracksHands ? ['Hands'] : []), 'Bostons', ...weeks.map(w => `Wk${w.week} W-L`)];
                      const lines = [header.join(',')];
                      standings.forEach(r => lines.push([r.rank, r.teamId, `"${r.teamName.replace(/"/g, '""')}"`, r.wins, r.losses, r.played, r.points, r.pointsAgainst, ...(tracksHands ? [r.hands] : []), r.bostons, ...weeks.map(w => `${r.weeks[w.week]?.wins ?? 0}-${r.weeks[w.week]?.losses ?? 0}`)].join(',')));
                      downloadText(`${league.name.replace(/\s+/g, '_')}_standings.csv`, lines.join('\n'));
                    }}>
                      <Download className="w-4 h-4 mr-1" /> CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
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
                  <p className="text-xs text-gray-500 mt-2">Sorted by wins, then total points, then team number. Only confirmed games count.</p>
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
