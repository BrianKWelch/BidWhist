import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import type { Game, ScheduleMatch, Team } from '@/contexts/AppContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import MessageBanner from './MessageBanner';
import {
  currentLeagueWeek,
  getLeagueStandings,
  gameBelongsToMatch,
  leagueMatchInfo,
  leagueSeasonLeaders,
  leagueWeekLeaders,
  leagueWeeksFromSchedule,
  teamSideForWeek,
  type LeagueSide,
} from '@/lib/league';
import LeagueLeadersPanel from './LeagueLeadersPanel';

const BRAND = '#a60002';

const sideClasses: Record<LeagueSide, string> = {
  A: 'bg-blue-100 text-blue-800 border-blue-300',
  B: 'bg-amber-100 text-amber-800 border-amber-300',
};

type CardState =
  | 'ready'            // no game row yet: show Score button
  | 'entering_me'      // I hold the entry lock
  | 'entering_opp'     // opponent holds the lock
  | 'pending_me'       // I submitted, opponent must confirm
  | 'pending_opp'      // opponent submitted, I must confirm
  | 'disputed_me'      // my entry was disputed: re-enter
  | 'disputed_opp'     // I disputed: waiting on opponent
  | 'done';

interface PortalMatch {
  match: ScheduleMatch;
  opponent?: Team;
  opponentId: string;
  gameNo: 1 | 2;
  state: CardState;
  game?: Game;
  result?: { my: number; opp: number; win: boolean };
}

type ScoreComponent = React.ComponentType<{ team: Team; match: ScheduleMatch; onComplete: () => void }>;

/**
 * Player portal for league play. The score entry and confirmation widgets are
 * the same ones the tournament portal uses; they are passed in as props so the
 * two portal files do not import each other.
 */
const LeaguePortal: React.FC<{ team: Team; onLogout: () => void; ScoreEntry: ScoreComponent; Confirmation: ScoreComponent }> = ({ team, onLogout, ScoreEntry, Confirmation }) => {
  const {
    teams, schedules, games, getActiveTournament, beginScoreEntry, releaseScoreEntryLock, retractScore,
    refreshGamesFromSupabase, getActiveMessages,
  } = useAppContext();

  const league = getActiveTournament();
  const schedule = schedules.find(s => s.tournamentId === league?.id) ?? null;
  const weeks = useMemo(() => leagueWeeksFromSchedule(schedule), [schedule]);
  const adminScoring = league?.scoringMode === 'admin';
  const myId = String(team.id);

  const myCurrentWeek = useMemo(() => currentLeagueWeek(schedule, games, myId), [schedule, games, myId]);
  const [week, setWeek] = useState<number>(myCurrentWeek);
  useEffect(() => { setWeek(myCurrentWeek); }, [myCurrentWeek, league?.id]);

  const [selected, setSelected] = useState<PortalMatch | null>(null);
  const [holdingLock, setHoldingLock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showStandings, setShowStandings] = useState(false);

  const mySide = teamSideForWeek(weeks, myId, week);
  const roomMates = useMemo(() => {
    const wk = weeks.find(w => w.week === week);
    if (!wk || !mySide) return [];
    return (mySide === 'A' ? wk.sideA : wk.sideB).filter(t => t !== myId);
  }, [weeks, week, mySide, myId]);

  // ---- My matches for the selected week ---------------------------------
  const myMatches: PortalMatch[] = useMemo(() => {
    if (!schedule) return [];
    return schedule.matches
      .filter(m => m.round === week && (String(m.teamA) === myId || String(m.teamB) === myId))
      .map(m => {
        const opponentId = String(m.teamA) === myId ? String(m.teamB) : String(m.teamA);
        const opponent = teams.find(t => String(t.id) === opponentId);
        const game = games.find(g => gameBelongsToMatch(g, m));
        const { gameNo } = leagueMatchInfo(m);
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
            result = {
              my: iAmA ? game.scoreA : game.scoreB,
              opp: iAmA ? game.scoreB : game.scoreA,
              win: (iAmA && game.winner === 'teamA') || (!iAmA && game.winner === 'teamB'),
            };
          }
        }
        return { match: m, opponent, opponentId, gameNo, state, game, result };
      })
      .sort((x, y) => {
        // Open games first, then pending, then completed; within a group by opponent number.
        const rank = (s: CardState) => (s === 'done' ? 2 : s === 'ready' ? 0 : 1);
        return rank(x.state) - rank(y.state) || Number(x.opponentId) - Number(y.opponentId) || x.gameNo - y.gameNo;
      });
  }, [schedule, week, myId, teams, games]);

  const openCount = myMatches.filter(m => m.state !== 'done').length;

  // ---- Season record and standings --------------------------------------
  const standings = useMemo(() => getLeagueStandings(teams, games, schedule), [teams, games, schedule]);
  const myRow = standings.find(r => r.teamId === myId);
  const seasonLeaders = useMemo(() => leagueSeasonLeaders(standings), [standings]);
  const weekLeaders = useMemo(() => weeks.map(w => ({ week: w.week, leaders: leagueWeekLeaders(standings, w.week), played: standings.some(r => (r.weeks[w.week]?.wins ?? 0) + (r.weeks[w.week]?.losses ?? 0) > 0) })), [standings, weeks]);

  // ---- Actions ----------------------------------------------------------
  const startEntry = async (pm: PortalMatch) => {
    setBusy(true);
    try {
      const result = await beginScoreEntry({
        matchId: pm.match.id, teamId: myId, teamA: String(pm.match.teamA), teamB: String(pm.match.teamB), round: pm.match.round,
      });
      if (result.ok) {
        setHoldingLock(true);
        setSelected(pm);
      } else if (result.reason === 'teammate_entering') {
        toast({ title: 'Partner is entering score', description: 'Your partner is currently the score keeper. Ask them to log out first if you want to enter it.', variant: 'destructive' });
      } else {
        toast({ title: 'Opponent entering score', description: 'Please wait and try again in a moment.', variant: 'destructive' });
        await refreshGamesFromSupabase();
      }
    } finally {
      setBusy(false);
    }
  };

  const cancelEntry = async () => {
    if (holdingLock && selected) await releaseScoreEntryLock({ matchId: selected.match.id, teamId: myId });
    setHoldingLock(false);
    setSelected(null);
  };

  const retract = async (pm: PortalMatch) => {
    if (!pm.game) return;
    setBusy(true);
    try {
      const r = await retractScore(pm.game.id, myId);
      toast(r.ok ? { title: 'Score retracted', description: 'You can enter it again.' } : { title: 'Could not retract', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const oppLabel = (pm: PortalMatch) => (
    <div className="flex flex-col items-center justify-center">
      <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">vs. Team</span>
      <span className="font-bold text-lg">{pm.opponentId}</span>
      <span className="text-xs text-gray-600">{pm.opponent?.player1FirstName || ''}/{pm.opponent?.player2FirstName || ''}</span>
    </div>
  );

  const activeMessage = getActiveMessages()[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="fixed top-0 left-0 right-0 z-60">
        <MessageBanner key={`league-${activeMessage?.id || 'none'}`} message={activeMessage?.text || ''} type={activeMessage?.type} />
      </div>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 w-full bg-white shadow-sm" style={{ marginTop: activeMessage ? '60px' : '0px' }}>
        <div className="py-2 px-4 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => refreshGamesFromSupabase()} className="text-white border-0" style={{ backgroundColor: BRAND }}>Refresh</Button>
          <img src={import.meta.env.BASE_URL + 'SetPlay_Logo.png'} alt="SetPlay Logo" className="h-24 w-auto" />
          <Button variant="outline" size="sm" onClick={async () => { await cancelEntry(); onLogout(); }} className="text-white border-0" style={{ backgroundColor: BRAND }}>Logout</Button>
        </div>
        <div className="w-full h-1 bg-black" />
        <div className="py-2 px-4 text-center">
          <div className="text-3xl font-black text-black tracking-tight">TEAM #{team.id}</div>
          <div className="text-sm text-gray-600">{team.player1FirstName} / {team.player2FirstName}</div>
          <div className="text-sm font-bold mt-1" style={{ color: BRAND }}>{league?.name} · League</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4" style={{ paddingTop: activeMessage ? 'calc(14rem + 60px)' : '14rem' }}>
        {/* Season record */}
        <div className="grid grid-cols-4 gap-2 mb-4 text-center">
          <div className="p-2 bg-black rounded-lg text-white"><div className="text-xl font-bold">{myRow?.wins ?? 0}</div><div className="text-[11px]">Wins</div></div>
          <div className="p-2 rounded-lg text-white" style={{ backgroundColor: BRAND }}><div className="text-xl font-bold">{myRow?.losses ?? 0}</div><div className="text-[11px]">Losses</div></div>
          <div className="p-2 bg-black rounded-lg text-white"><div className="text-xl font-bold">{myRow?.points ?? 0}</div><div className="text-[11px]">Points</div></div>
          <div className="p-2 rounded-lg text-white" style={{ backgroundColor: BRAND }}><div className="text-xl font-bold">{myRow?.rank ? `#${myRow.rank}` : '—'}</div><div className="text-[11px]">of {standings.length}</div></div>
        </div>

        {!schedule || weeks.length === 0 ? (
          <Card><CardContent className="pt-4 text-center text-gray-600">The league schedule has not been generated yet. Check back soon.</CardContent></Card>
        ) : (
          <>
            {/* Week picker */}
            <div className="flex flex-wrap gap-1 justify-center mb-3">
              {weeks.map(w => {
                const s = teamSideForWeek(weeks, myId, w.week);
                const isCur = w.week === week;
                return (
                  <button key={w.week} onClick={() => setWeek(w.week)}
                    className={`px-2 py-1 rounded-md border text-xs font-semibold ${isCur ? 'text-white border-transparent' : 'bg-white text-gray-700 border-gray-300'}`}
                    style={isCur ? { backgroundColor: BRAND } : undefined}>
                    Wk {w.week}<span className={`ml-1 px-1 rounded ${isCur ? 'bg-white/20' : s ? sideClasses[s] : ''}`}>{s ?? '?'}</span>
                  </button>
                );
              })}
            </div>

            <div className="text-center mb-3">
              <h2 className="text-xl font-bold text-gray-900">
                Week {week}
                {mySide && <span className={`ml-2 align-middle inline-block px-3 py-0.5 rounded-full border text-sm font-bold ${sideClasses[mySide]}`}>Side {mySide}</span>}
              </h2>
              <p className="text-xs text-gray-600 mt-1">
                Play everyone in your room. No set order: when you and another team are both free, sit down and play.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {openCount === 0 ? 'All games for this week are in.' : `${openCount} game${openCount === 1 ? '' : 's'} left this week.`}
                {roomMates.length > 0 && <> Room: {roomMates.join(', ')}</>}
              </p>
            </div>

            {/* Match cards */}
            <div className="space-y-2">
              {myMatches.map(pm => {
                const border =
                  pm.state === 'done' ? (pm.result?.win ? 'border-green-500 bg-green-50' : 'border-red-400 bg-red-50')
                  : pm.state === 'ready' ? 'border-blue-400 bg-white'
                  : 'border-yellow-400 bg-yellow-50';
                return (
                  <Card key={pm.match.id} className={`border-2 ${border}`}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between min-h-16">
                        <div className="flex flex-col items-start gap-1 w-20">
                          {pm.gameNo === 2 ? <Badge variant="outline" className="text-[10px]">2nd game</Badge> : <span className="text-[10px] text-gray-400">Game</span>}
                          {pm.state === 'done' && pm.result && (
                            <Badge className={`text-[10px] ${pm.result.win ? 'bg-green-600' : 'bg-red-600'} text-white`}>{pm.result.win ? 'WIN' : 'LOSS'}</Badge>
                          )}
                        </div>

                        {oppLabel(pm)}

                        <div className="flex flex-col items-end gap-1 w-24">
                          {pm.state === 'done' && pm.result && (
                            <span className="font-bold text-lg">{pm.result.my} <span className="text-gray-400 text-sm">–</span> {pm.result.opp}</span>
                          )}
                          {pm.state === 'ready' && (adminScoring ? (
                            <span className="text-[11px] text-gray-500 text-right">Admin managed</span>
                          ) : (
                            <Button size="sm" disabled={busy} onClick={() => startEntry(pm)} className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 animate-pulse">Score</Button>
                          ))}
                          {pm.state === 'entering_me' && (
                            <Button size="sm" disabled={busy} onClick={() => { setHoldingLock(true); setSelected(pm); }} className="bg-blue-600 text-white text-xs px-3">Continue</Button>
                          )}
                          {pm.state === 'entering_opp' && <Badge className="bg-yellow-200 text-yellow-900 text-[10px]">Opponent entering</Badge>}
                          {pm.state === 'pending_me' && (
                            <>
                              <Badge className="bg-green-100 text-green-800 text-[10px]">Awaiting confirm</Badge>
                              {pm.result && <span className="text-xs text-gray-600">{pm.result.my} – {pm.result.opp}</span>}
                              <button className="text-[11px] underline text-gray-500" disabled={busy} onClick={() => retract(pm)}>Retract</button>
                            </>
                          )}
                          {pm.state === 'pending_opp' && (
                            <Button size="sm" disabled={busy} onClick={() => { setHoldingLock(false); setSelected(pm); }} className="text-white text-xs px-3 animate-pulse" style={{ backgroundColor: BRAND }}>Confirm</Button>
                          )}
                          {pm.state === 'disputed_me' && (
                            <Button size="sm" disabled={busy} onClick={() => startEntry(pm)} className="bg-orange-600 text-white text-xs px-3">Re-enter</Button>
                          )}
                          {pm.state === 'disputed_opp' && <Badge className="bg-orange-100 text-orange-800 text-[10px]">Disputed · waiting</Badge>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {myMatches.length === 0 && (
                <Card><CardContent className="pt-4 text-center text-gray-600">No games scheduled for you in Week {week}.</CardContent></Card>
              )}
            </div>
          </>
        )}

        {/* Standings */}
        {standings.length > 0 && (
          <div className="mt-6">
            <h3 className="text-center text-lg font-bold text-gray-900 mb-2">League Standings</h3>
            <div className="mb-2">
              <div className="text-[11px] text-center text-gray-500 uppercase tracking-wide mb-1">Season Leaders</div>
              <LeagueLeadersPanel leaders={seasonLeaders} highlightTeamId={myId} />
            </div>
            <button onClick={() => setShowStandings(s => !s)} className="w-full text-center text-sm font-bold py-2 rounded-lg text-white" style={{ backgroundColor: BRAND }}>
              {showStandings ? 'Hide' : 'Show'} Full Standings
            </button>
            {showStandings && (
              <Card className="mt-2">
                <CardContent className="p-2 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b">
                        <th className="p-1 text-left">#</th><th className="p-1 text-left">Team</th><th className="p-1">W</th><th className="p-1">L</th><th className="p-1">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map(r => (
                        <tr key={r.teamId} className={`border-b last:border-0 ${r.teamId === myId ? 'font-bold bg-yellow-50' : ''}`}>
                          <td className="p-1">{r.rank}</td>
                          <td className="p-1 whitespace-nowrap">{r.teamId} · {r.teamName}</td>
                          <td className="p-1 text-center">{r.wins}</td>
                          <td className="p-1 text-center">{r.losses}</td>
                          <td className="p-1 text-center">{r.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            {/* Weekly results: leaders for every week of the season */}
            <h3 className="text-center text-lg font-bold text-gray-900 mt-6 mb-2">Weekly Results</h3>
            <div className="space-y-2">
              {weekLeaders.map(({ week: w, leaders, played }) => {
                const side = teamSideForWeek(weeks, myId, w);
                const mine = myRow?.weeks[w];
                return (
                  <Card key={w} className={`border ${w === week ? 'border-gray-400' : 'border-gray-200'}`}>
                    <CardContent className="p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm">Week {w}</span>
                        <span className="text-[11px] text-gray-600">
                          {side && <span className={`inline-block px-1.5 rounded border font-bold mr-2 ${sideClasses[side]}`}>{side}</span>}
                          {mine ? `You: ${mine.wins}-${mine.losses}, ${mine.points} pts, ${mine.bostons} Bostons` : ''}
                        </span>
                      </div>
                      {played ? (
                        <LeagueLeadersPanel leaders={leaders} highlightTeamId={myId} compact />
                      ) : (
                        <div className="text-xs text-gray-500 text-center py-1">No games scored yet</div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-6 text-xs text-center text-gray-500">Built and Managed by Brian Welch</div>
      </div>

      {/* Score entry / confirmation modal */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {selected.state === 'pending_opp' ? 'Confirm Score' : 'Enter Score'} · Week {selected.match.round} vs Team {selected.opponentId}
              </h3>
              <Button variant="ghost" size="sm" onClick={cancelEntry}>✕</Button>
            </div>
            {selected.state === 'pending_opp' ? (
              <Confirmation team={team} match={selected.match} onComplete={() => { setSelected(null); setHoldingLock(false); }} />
            ) : (
              <ScoreEntry team={team} match={selected.match} onComplete={() => { setSelected(null); setHoldingLock(false); }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaguePortal;
