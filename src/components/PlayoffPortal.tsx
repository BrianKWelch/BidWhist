import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import type { Game, ScheduleMatch, Team } from '@/contexts/AppContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import MessageBanner from './MessageBanner';
import { getLeagueStandings, leagueTeamNo, leagueWeeksOf } from '@/lib/league';
import {
  PRELIM_GAMES_PER_TEAM, TIER_NAME,
  bracketMatchesToCreate, bracketPlacings, bracketState, parsePlayoffConfig, playoffMatchInfo, prelimComplete, prelimStandings,
  type SeriesState, type Tier,
} from '@/lib/playoff';

const BRAND = '#a60002';

type CardState = 'ready' | 'entering_me' | 'entering_opp' | 'pending_me' | 'pending_opp' | 'disputed_me' | 'disputed_opp' | 'done';
interface PortalMatch { match: ScheduleMatch; opponentId: string; opponent?: Team; label: string; state: CardState; game?: Game; result?: { my: number; opp: number; win: boolean } }
type ScoreComponent = React.ComponentType<{ team: Team; match: ScheduleMatch; onComplete: () => void }>;

/**
 * Player portal for league playoffs: the team's preliminary games, live seeds,
 * its best-of-three series and the bracket. Teams not in the field see the
 * final season standings and the bracket as spectators.
 */
const PlayoffPortal: React.FC<{ team: Team; onLogout: () => void; ScoreEntry: ScoreComponent; Confirmation: ScoreComponent }> = ({ team, onLogout, ScoreEntry, Confirmation }) => {
  const { teams, tournaments, schedules, games, getActiveTournament, beginScoreEntry, releaseScoreEntryLock, retractScore, refreshGamesFromSupabase, refreshSchedules, refreshTournaments, getActiveMessages } = useAppContext();
  const no = (id: string) => leagueTeamNo(teams, id);
  const playoff = getActiveTournament();
  const cfg = useMemo(() => parsePlayoffConfig(playoff), [playoff]);
  const league = tournaments.find(t => String(t.id) === cfg?.playoffOf) ?? null;
  const pSchedule = playoff ? schedules.find(s => s.tournamentId === playoff.id) ?? null : null;
  const leagueSchedule = league ? schedules.find(s => s.tournamentId === league.id) ?? null : null;
  const myId = String(team.id);
  const myTier: Tier | null = cfg?.tiers[1]?.includes(myId) ? 1 : cfg?.tiers[2]?.includes(myId) ? 2 : null;
  const adminScoring = playoff?.scoringMode === 'admin';

  const season = useMemo(() => getLeagueStandings(teams, games, leagueSchedule, league ? leagueWeeksOf(league) || undefined : undefined), [teams, games, leagueSchedule, league]);
  const seasonRank = useMemo(() => Object.fromEntries(season.map(r => [r.teamId, r.rank])) as Record<string, number>, [season]);

  const tier: Tier = myTier ?? 1;
  const field = cfg?.tiers[tier] ?? [];
  const standings = useMemo(() => prelimStandings(teams, tier, field, pSchedule, games, seasonRank), [teams, tier, field, pSchedule, games, seasonRank]);
  const prelim = useMemo(() => prelimComplete(pSchedule, games, tier), [pSchedule, games, tier]);
  const seeds = cfg?.seeds[tier];
  const states = useMemo(() => bracketState(tier, seeds, pSchedule, games), [tier, seeds, pSchedule, games]);
  const placings = useMemo(() => bracketPlacings(states), [states]);
  const seedOf = (id?: string) => (id && seeds ? seeds.indexOf(id) + 1 : 0);

  // Seeds and the live tournament live on the tournament record, which has no
  // realtime feed, so poll it (small table) and pull schedules with it. Refresh does the same.
  const refreshAll = async () => { await Promise.all([refreshGamesFromSupabase(), refreshSchedules(), refreshTournaments()]); };
  useEffect(() => {
    const id = setInterval(() => { refreshTournaments(); refreshSchedules(); }, 20_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Any phone can carry the bracket forward: deterministic ids, duplicates ignored.
  useEffect(() => {
    if (!playoff || !seeds || !pSchedule) return;
    const toCreate = bracketMatchesToCreate(playoff.id, tier, states);
    if (toCreate.length === 0) return;
    let cancelled = false;
    (async () => {
      const { supabase } = await import('../supabaseClient');
      const rows = toCreate.map(m => ({ id: m.id, team_a: m.teamA, team_b: m.teamB, round: m.round, tournament_id: playoff.id, table_number: m.table ?? 0, is_bye: false, is_same_city: false }));
      const { error } = await supabase.from('matches').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
      if (!error && !cancelled) await refreshSchedules();
    })();
    return () => { cancelled = true; };
  }, [playoff, seeds, pSchedule, states, tier, refreshSchedules]);

  // ---- My games ---------------------------------------------------------
  const toPortalMatch = (m: ScheduleMatch, label: string): PortalMatch => {
    const opponentId = String(m.teamA) === myId ? String(m.teamB) : String(m.teamA);
    const game = games.find(g => String(g.matchId) === m.id);
    let state: CardState = 'ready';
    let result: PortalMatch['result'];
    if (game) {
      const mine = String(game.entered_by_team_id) === myId;
      if (game.confirmed || game.status === 'confirmed') state = 'done';
      else if (game.status === 'entering') state = mine ? 'entering_me' : 'entering_opp';
      else if (game.status === 'pending_confirmation') state = mine ? 'pending_me' : 'pending_opp';
      else if (game.status === 'disputed') state = mine ? 'disputed_me' : 'disputed_opp';
      if (game.winner) {
        const iAmA = String(game.teamA) === myId;
        result = { my: iAmA ? game.scoreA : game.scoreB, opp: iAmA ? game.scoreB : game.scoreA, win: (iAmA && game.winner === 'teamA') || (!iAmA && game.winner === 'teamB') };
      }
    }
    return { match: m, opponentId, opponent: teams.find(t => String(t.id) === opponentId), label, state, game, result };
  };
  const myPrelim = useMemo(() => (pSchedule?.matches ?? [])
    .filter(m => { const i = playoffMatchInfo(m); return i && i.round === 1 && i.tier === tier && (String(m.teamA) === myId || String(m.teamB) === myId); })
    .map(m => toPortalMatch(m, `Game ${playoffMatchInfo(m)?.game}`))
    .sort((x, y) => { const rank = (s: CardState) => (s === 'done' ? 2 : s === 'ready' ? 0 : 1); return rank(x.state) - rank(y.state) || Number(no(x.opponentId)) - Number(no(y.opponentId)) || x.label.localeCompare(y.label); }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pSchedule, games, myId, tier, teams]);
  const mySeries = states.filter(s => s.teamA === myId || s.teamB === myId);
  const mySeriesGames: PortalMatch[] = mySeries.flatMap(s => s.games.map(g => toPortalMatch(g.match, `${s.spec.label.split(' · ')[0]} · Game ${playoffMatchInfo(g.match)?.game}`)));
  const playedPrelim = myPrelim.filter(m => m.state === 'done').length;

  // ---- Score flow (same as the league portal) ---------------------------
  const [selected, setSelected] = useState<PortalMatch | null>(null);
  const [holdingLock, setHoldingLock] = useState(false);
  const [busy, setBusy] = useState(false);
  const startEntry = async (pm: PortalMatch) => {
    setBusy(true);
    try {
      const r = await beginScoreEntry({ matchId: pm.match.id, teamId: myId, teamA: String(pm.match.teamA), teamB: String(pm.match.teamB), round: pm.match.round });
      if (r.ok) { setHoldingLock(true); setSelected(pm); }
      else if (r.reason === 'teammate_entering') toast({ title: 'Partner is entering score', variant: 'destructive' });
      else { toast({ title: 'Opponent entering score', description: 'Please wait and try again in a moment.', variant: 'destructive' }); await refreshGamesFromSupabase(); }
    } finally { setBusy(false); }
  };
  const cancelEntry = async () => { if (holdingLock && selected) await releaseScoreEntryLock({ matchId: selected.match.id, teamId: myId }); setHoldingLock(false); setSelected(null); };
  const retract = async (pm: PortalMatch) => { if (!pm.game) return; setBusy(true); try { const r = await retractScore(pm.game.id, myId); toast(r.ok ? { title: 'Score retracted' } : { title: 'Could not retract', variant: 'destructive' }); } finally { setBusy(false); } };

  const card = (pm: PortalMatch) => {
    const border = pm.state === 'done' ? (pm.result?.win ? 'border-green-500 bg-green-50' : 'border-red-400 bg-red-50') : pm.state === 'ready' ? 'border-blue-400 bg-white' : 'border-yellow-400 bg-yellow-50';
    return (
      <Card key={pm.match.id} className={`border-2 ${border}`} data-testid={`pp-card-${pm.match.id}`}>
        <CardContent className="p-3">
          <div className="flex items-center justify-between min-h-16">
            <div className="flex flex-col items-start gap-1 w-24">
              <span className="text-[10px] text-gray-500 leading-tight">{pm.label}</span>
              {pm.state === 'done' && pm.result && <Badge className={`text-[10px] ${pm.result.win ? 'bg-green-600' : 'bg-red-600'} text-white`}>{pm.result.win ? 'WIN' : 'LOSS'}</Badge>}
            </div>
            <div className="flex flex-col items-center justify-center">
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">vs. Team</span>
              <span className="font-bold text-lg">{no(pm.opponentId)}</span>
              <span className="text-xs text-gray-600">{pm.opponent?.player1FirstName || ''}/{pm.opponent?.player2FirstName || ''}</span>
            </div>
            <div className="flex flex-col items-end gap-1 w-24">
              {pm.state === 'done' && pm.result && <span className="font-bold text-lg">{pm.result.my} <span className="text-gray-400 text-sm">–</span> {pm.result.opp}</span>}
              {pm.state === 'ready' && (adminScoring ? <span className="text-[11px] text-gray-500">Admin managed</span> : <Button size="sm" disabled={busy} onClick={() => startEntry(pm)} className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 animate-pulse">Score</Button>)}
              {pm.state === 'entering_me' && <Button size="sm" disabled={busy} onClick={() => { setHoldingLock(true); setSelected(pm); }} className="bg-blue-600 text-white text-xs px-3">Continue</Button>}
              {pm.state === 'entering_opp' && <Badge className="bg-yellow-200 text-yellow-900 text-[10px]">Opponent entering</Badge>}
              {pm.state === 'pending_me' && (<><Badge className="bg-green-100 text-green-800 text-[10px]">Awaiting confirm</Badge>{pm.result && <span className="text-xs text-gray-600">{pm.result.my} – {pm.result.opp}</span>}<button className="text-[11px] underline text-gray-500" disabled={busy} onClick={() => retract(pm)}>Retract</button></>)}
              {pm.state === 'pending_opp' && <Button size="sm" disabled={busy} onClick={() => { setHoldingLock(false); setSelected(pm); }} className="text-white text-xs px-3 animate-pulse" style={{ backgroundColor: BRAND }}>Confirm</Button>}
              {pm.state === 'disputed_me' && <Button size="sm" disabled={busy} onClick={() => startEntry(pm)} className="bg-orange-600 text-white text-xs px-3">Re-enter</Button>}
              {pm.state === 'disputed_opp' && <Badge className="bg-orange-100 text-orange-800 text-[10px]">Disputed · waiting</Badge>}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const seriesLine = (st: SeriesState) => (
    <div key={st.spec.key} className={`rounded border p-2 text-sm ${st.teamA === myId || st.teamB === myId ? 'bg-yellow-50 border-yellow-400' : 'bg-white'}`}>
      <div className="flex items-center justify-between"><span className="font-semibold text-xs">{st.spec.label}</span>{st.winner && <Badge className="bg-green-600 text-white text-[10px]">{no(st.winner)} wins</Badge>}</div>
      {st.teamA && st.teamB ? (
        <div className="text-xs mt-1">({seedOf(st.teamA)}) Team {no(st.teamA)} <span className="font-bold mx-1">{st.winsA} – {st.winsB}</span> ({seedOf(st.teamB)}) Team {no(st.teamB)}{st.games.filter(g => g.game).length > 0 && <span className="text-gray-500"> · games: {st.games.filter(g => g.game).map(g => `${g.game!.scoreA}-${g.game!.scoreB}`).join(', ')}</span>}</div>
      ) : <div className="text-xs text-gray-500 mt-1">Waiting on the semifinals</div>}
    </div>
  );

  const activeMessage = getActiveMessages()[0];
  const tierLabel = myTier ? TIER_NAME[myTier] : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="fixed top-0 left-0 right-0 z-60"><MessageBanner key={`po-${activeMessage?.id || 'none'}`} message={activeMessage?.text || ''} type={activeMessage?.type} /></div>
      <div className="fixed top-0 left-0 right-0 z-50 w-full bg-white shadow-sm" style={{ marginTop: activeMessage ? '60px' : '0px' }}>
        <div className="py-2 px-4 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => refreshAll()} className="text-white border-0" style={{ backgroundColor: BRAND }}>Refresh</Button>
          <img src={import.meta.env.BASE_URL + 'SetPlay_Logo.png'} alt="SetPlay Logo" className="h-24 w-auto" />
          <Button variant="outline" size="sm" onClick={async () => { await cancelEntry(); onLogout(); }} className="text-white border-0" style={{ backgroundColor: BRAND }}>Logout</Button>
        </div>
        <div className="w-full h-1 bg-black" />
        <div className="py-2 px-4 text-center">
          <div className="text-3xl font-black text-black tracking-tight">TEAM #{no(myId)}</div>
          <div className="text-sm text-gray-600">{team.player1FirstName} / {team.player2FirstName}</div>
          <div className="text-sm font-bold mt-1" style={{ color: BRAND }}>{playoff?.name}{tierLabel ? ` · ${tierLabel}` : ''}</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4" style={{ paddingTop: activeMessage ? 'calc(14rem + 60px)' : '14rem' }}>
        {!myTier ? (
          <Card><CardContent className="pt-4 text-center text-gray-700 text-sm">
            <div className="font-bold mb-1">Season complete</div>
            Your team is not in the playoff field{season.find(r => r.teamId === myId) ? ` (finished #${season.find(r => r.teamId === myId)!.rank} of ${season.length})` : ''}. Thanks for a great season.
          </CardContent></Card>
        ) : (
          <>
            {!seeds ? (
              <>
                <div className="text-center mb-3">
                  <h2 className="text-xl font-bold text-gray-900">Preliminary round</h2>
                  <p className="text-xs text-gray-600 mt-1">Play every team in your tier twice. No set order: when you and another team are both free, sit down and play.</p>
                  <p className="text-xs text-gray-500 mt-1" data-testid="pp-prelim-progress">{playedPrelim} of {PRELIM_GAMES_PER_TEAM} games in{playedPrelim >= PRELIM_GAMES_PER_TEAM ? '. Waiting for the bracket.' : '.'}</p>
                </div>
                <div className="space-y-2">{myPrelim.map(card)}</div>
              </>
            ) : (
              <>
                <div className="text-center mb-3">
                  <h2 className="text-xl font-bold text-gray-900">Bracket · you are seed {seedOf(myId)}</h2>
                  <p className="text-xs text-gray-600 mt-1">Every series is best of three. Game 3 appears when a series is 1–1; the next round appears when both semifinals are done.</p>
                </div>
                <div className="space-y-2">
                  {mySeriesGames.map(card)}
                  {mySeriesGames.length === 0 && <Card><CardContent className="pt-4 text-center text-gray-600 text-sm">{placings.find(p => p.teamId === myId) ? `You finished ${placings.find(p => p.teamId === myId)!.place === 1 ? 'as champion' : `in place ${placings.find(p => p.teamId === myId)!.place}`}.` : 'Your next series will appear here when the semifinals are decided.'}</CardContent></Card>}
                </div>
              </>
            )}
          </>
        )}

        {/* Standings / seeds */}
        {field.length > 0 && (
          <div className="mt-6">
            <h3 className="text-center text-lg font-bold text-gray-900 mb-2">{TIER_NAME[tier]} · {seeds ? 'seeds' : `standings (${prelim.done} of ${prelim.total} games in)`}</h3>
            <Card><CardContent className="p-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-500 border-b"><th className="p-1 text-left">Seed</th><th className="p-1 text-left">Team</th><th className="p-1">GP</th><th className="p-1">W</th><th className="p-1">L</th><th className="p-1">Pts</th></tr></thead>
                <tbody>
                  {(seeds ? seeds.map((id, i) => ({ ...(standings.find(r => r.teamId === id)!), seed: i + 1 })) : standings).map(r => (
                    <tr key={r.teamId} className={`border-b last:border-0 ${r.teamId === myId ? 'font-bold bg-yellow-50' : ''}`}>
                      <td className="p-1">{r.seed}</td><td className="p-1 whitespace-nowrap">{no(r.teamId)} · {r.teamName}</td><td className="p-1 text-center">{r.played}</td><td className="p-1 text-center">{r.wins}</td><td className="p-1 text-center">{r.losses}</td><td className="p-1 text-center">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent></Card>
          </div>
        )}

        {/* Bracket summary */}
        {seeds && (
          <div className="mt-6">
            <h3 className="text-center text-lg font-bold text-gray-900 mb-2">{TIER_NAME[tier]} · bracket</h3>
            <div className="space-y-2">{states.map(seriesLine)}</div>
            {placings.length > 0 && (
              <Card className="mt-2"><CardContent className="p-2">
                <div className="text-xs text-gray-500 uppercase tracking-wide text-center mb-1">Final placings</div>
                {placings.map(p => <div key={p.place} className={`text-sm flex justify-between px-2 ${p.teamId === myId ? 'font-bold' : ''}`}><span>{p.place === 1 ? 'Champion' : `${p.place}.`}</span><span>Team {no(p.teamId)} · {teams.find(t => String(t.id) === p.teamId)?.name ?? ''}</span></div>)}
              </CardContent></Card>
            )}
          </div>
        )}

        {/* Final season standings */}
        {season.length > 0 && (
          <div className="mt-6">
            <h3 className="text-center text-lg font-bold text-gray-900 mb-2">Final Season Standings</h3>
            <Card><CardContent className="p-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-gray-500 border-b"><th className="p-1 text-left">#</th><th className="p-1 text-left">Team</th><th className="p-1">W</th><th className="p-1">L</th><th className="p-1">Pts</th></tr></thead>
                <tbody>{season.map(r => (
                  <tr key={r.teamId} className={`border-b last:border-0 ${r.teamId === myId ? 'font-bold bg-yellow-50' : ''}`}><td className="p-1">{r.rank}</td><td className="p-1 whitespace-nowrap">{no(r.teamId)} · {r.teamName}</td><td className="p-1 text-center">{r.wins}</td><td className="p-1 text-center">{r.losses}</td><td className="p-1 text-center">{r.points}</td></tr>
                ))}</tbody>
              </table>
            </CardContent></Card>
          </div>
        )}
        <div className="mt-6 text-xs text-center text-gray-500">Built and Managed by Brian Welch</div>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{selected.state === 'pending_opp' ? 'Confirm Score' : 'Enter Score'} · {selected.label} vs Team {no(selected.opponentId)}</h3>
              <Button variant="ghost" size="sm" onClick={cancelEntry}>✕</Button>
            </div>
            {selected.state === 'pending_opp'
              ? <Confirmation team={team} match={selected.match} onComplete={() => { setSelected(null); setHoldingLock(false); }} />
              : <ScoreEntry team={team} match={selected.match} onComplete={() => { setSelected(null); setHoldingLock(false); }} />}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayoffPortal;
