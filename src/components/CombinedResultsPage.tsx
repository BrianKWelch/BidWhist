import React from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Target, Award, Calendar, Search } from 'lucide-react';
import { TournamentResults } from './TournamentResults';
const ExportResultsButton = React.lazy(() => import('./ExportResultsButton'));

const ScoreVerifier = ({ games, teams, schedules, activeTournamentId, onRefresh }: { games: any[]; teams: any[]; schedules: any[]; activeTournamentId: string | null; onRefresh: () => void }) => {
  const [roundInput, setRoundInput] = React.useState('');
  const [teamInput, setTeamInput] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  const [editValues, setEditValues] = React.useState({ myScore: '', oppScore: '', myHands: '', oppHands: '', myBostons: '', oppBostons: '' });
  const [saving, setSaving] = React.useState(false);

  const found = React.useMemo(() => {
    const round = parseInt(roundInput);
    const teamNum = teamInput.trim();
    if (!round || !teamNum) return null;

    const team = teams.find(t =>
      String(t.teamNumber) === teamNum || String(t.id) === teamNum
    );
    if (!team) return { error: `No team found for #${teamNum}` };

    const schedule = schedules.find(s => s.tournamentId === activeTournamentId);
    if (!schedule) return { error: 'No active tournament schedule found' };

    const match = schedule.matches.find((m: any) =>
      m.round === round &&
      (String(m.teamA) === String(team.id) || String(m.teamB) === String(team.id))
    );
    if (!match) return { error: `Team ${teamNum} not scheduled in Round ${round}` };

    const game = games.find(g =>
      String(g.matchId) === String(match.id) &&
      (g.status === 'confirmed' || g.confirmed === true)
    );
    if (!game) return { error: `No confirmed score yet for Team ${teamNum} Round ${round}` };

    const isA = String(game.teamA) === String(team.id);
    const myScore   = isA ? (game.scoreA ?? game.score_a ?? 0) : (game.scoreB ?? game.score_b ?? 0);
    const oppScore  = isA ? (game.scoreB ?? game.score_b ?? 0) : (game.scoreA ?? game.score_a ?? 0);
    const myHands   = isA ? (game.handsA ?? game.hands_a ?? 0) : (game.handsB ?? game.hands_b ?? 0);
    const oppHands  = isA ? (game.handsB ?? game.hands_b ?? 0) : (game.handsA ?? game.hands_a ?? 0);
    const myBostons  = isA ? (game.boston_a ?? 0) : (game.boston_b ?? 0);
    const oppBostons = isA ? (game.boston_b ?? 0) : (game.boston_a ?? 0);
    const oppId  = isA ? String(game.teamB) : String(game.teamA);
    const opp    = teams.find(t => String(t.id) === oppId);

    return { game, isA, myScore, oppScore, myHands, oppHands, myBostons, oppBostons, oppName: opp?.name ?? `Team ${oppId}`, teamName: team.name };
  }, [roundInput, teamInput, games, teams, schedules, activeTournamentId]);

  const startEdit = () => {
    if (!found || found.error) return;
    setEditValues({
      myScore: String(found.myScore),
      oppScore: String(found.oppScore),
      myHands: String(found.myHands),
      oppHands: String(found.oppHands),
      myBostons: String(found.myBostons),
      oppBostons: String(found.oppBostons),
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!found || found.error) return;
    setSaving(true);
    try {
      const { supabase } = await import('../supabaseClient');
      const { isA, game } = found;
      const myScore   = Number(editValues.myScore);
      const oppScore  = Number(editValues.oppScore);
      const myHands   = Number(editValues.myHands);
      const oppHands  = Number(editValues.oppHands);
      const myBostons  = Number(editValues.myBostons);
      const oppBostons = Number(editValues.oppBostons);

      const scoreA  = isA ? myScore  : oppScore;
      const scoreB  = isA ? oppScore : myScore;
      const handsA  = isA ? myHands  : oppHands;
      const handsB  = isA ? oppHands : myHands;
      const bostonA = isA ? myBostons  : oppBostons;
      const bostonB = isA ? oppBostons : myBostons;
      const winner  = scoreA > scoreB ? 'teamA' : scoreB > scoreA ? 'teamB' : game.winner;

      const { error } = await supabase.from('games').update({
        scoreA, scoreB, handsA, handsB, boston_a: bostonA, boston_b: bostonB, winner
      }).eq('id', game.id);

      if (error) {
        alert('Save failed: ' + error.message);
      } else {
        setEditing(false);
        onRefresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-16 border-2 border-gray-300 rounded px-1 py-1 text-center font-bold text-lg focus:border-red-600 outline-none';

  return (
    <Card className="border-2" style={{ borderColor: '#a60002' }}>
      <CardContent className="pt-4 pb-4">
        {/* Lookup row */}
        <div className="flex flex-wrap items-center gap-3">
          <Search className="h-5 w-5 shrink-0" style={{ color: '#a60002' }} />
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold whitespace-nowrap">Round</label>
            <input type="number" min="1" value={roundInput}
              onChange={e => { setRoundInput(e.target.value); setEditing(false); }}
              className="w-16 border rounded px-2 py-1 text-center font-bold text-lg" placeholder="—" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold whitespace-nowrap">Team #</label>
            <input type="number" min="1" value={teamInput}
              onChange={e => { setTeamInput(e.target.value); setEditing(false); }}
              className="w-24 border rounded px-2 py-1 text-center font-bold text-lg" placeholder="—" />
          </div>

          {found && (
            found.error
              ? <span className="text-sm text-red-600 font-medium">{found.error}</span>
              : !editing && (
                <div className="flex items-center gap-4 ml-2">
                  <div className="text-center">
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Score</div>
                    <div className="text-2xl font-black" style={{ color: '#a60002' }}>{found.myScore}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Hands</div>
                    <div className="text-2xl font-black">{found.myHands}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Bostons</div>
                    <div className="text-2xl font-black">{found.myBostons > 0 ? found.myBostons : '—'}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-500 uppercase tracking-wide">vs</div>
                    <div className="text-sm font-semibold">{found.oppName}</div>
                  </div>
                  <button onClick={startEdit}
                    className="ml-2 text-xs font-bold px-3 py-1 rounded text-white"
                    style={{ backgroundColor: '#a60002' }}>
                    Edit
                  </button>
                </div>
              )
          )}
        </div>

        {/* Edit row — shown below when editing */}
        {editing && found && !found.error && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-xs font-bold text-gray-500 uppercase mb-3">
              Editing: {found.teamName} vs {found.oppName}
            </div>
            <div className="flex flex-wrap gap-4 items-end">
              {/* Team side */}
              <div className="space-y-1">
                <div className="text-xs font-semibold text-center" style={{ color: '#a60002' }}>Team Score</div>
                <input type="number" className={inputCls} value={editValues.myScore}
                  onChange={e => setEditValues(v => ({ ...v, myScore: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-center" style={{ color: '#a60002' }}>Team Hands</div>
                <input type="number" className={inputCls} value={editValues.myHands}
                  onChange={e => setEditValues(v => ({ ...v, myHands: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-center" style={{ color: '#a60002' }}>Team Bos</div>
                <input type="number" className={inputCls} value={editValues.myBostons}
                  onChange={e => setEditValues(v => ({ ...v, myBostons: e.target.value }))} />
              </div>

              <div className="text-xl font-black text-gray-400 pb-1">vs</div>

              {/* Opponent side */}
              <div className="space-y-1">
                <div className="text-xs font-semibold text-center text-gray-500">Opp Score</div>
                <input type="number" className={inputCls} value={editValues.oppScore}
                  onChange={e => setEditValues(v => ({ ...v, oppScore: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-center text-gray-500">Opp Hands</div>
                <input type="number" className={inputCls} value={editValues.oppHands}
                  onChange={e => setEditValues(v => ({ ...v, oppHands: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-center text-gray-500">Opp Bos</div>
                <input type="number" className={inputCls} value={editValues.oppBostons}
                  onChange={e => setEditValues(v => ({ ...v, oppBostons: e.target.value }))} />
              </div>

              <div className="flex gap-2 pb-1">
                <button onClick={saveEdit} disabled={saving}
                  className="px-4 py-1 rounded text-white font-bold text-sm"
                  style={{ backgroundColor: '#a60002', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setEditing(false)}
                  className="px-4 py-1 rounded text-gray-600 font-bold text-sm border border-gray-300">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const CombinedResultsPage = () => {
  const { games, teams, schedules, getTournamentResults, tournaments, getActiveTournament, refreshGamesFromSupabase } = useAppContext();

  // Real-time updates for admin portal
  React.useEffect(() => {
    const interval = setInterval(() => {
      refreshGamesFromSupabase();
    }, 1500); // Refresh every 1.5 seconds for faster admin updates

    return () => clearInterval(interval);
  }, [refreshGamesFromSupabase]);

  const activeTournament = getActiveTournament();
  const tournamentResults = React.useMemo(() => (
    activeTournament ? getTournamentResults(activeTournament.id) : []
  ), [activeTournament, getTournamentResults]);
  const tournament = activeTournament;

  // Only show games for the active tournament
  const completedGames = activeTournament
    ? games.filter(game => game.confirmed && game.matchId &&
        // Find the schedule for this match and check tournamentId
        (() => {
          const schedule = tournaments && tournaments.length
            ? null
            : null;
          // We'll use the matchId to find the schedule
          // But better: just check if the match's schedule is for the active tournament
          // We'll assume matchId is unique per tournament
          // So, filter by tournamentResults (which is per tournament)
          // Or, if game has tournamentId, use that
          // But fallback: just show games that are in the results for this tournament
          return tournamentResults.some(r => r.teamId === game.teamA.id || r.teamId === game.teamB.id);
        })()
      ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    : [];

  const formatGameResult = (game: any) => {
    const teamA = teams.find(t => t.id === game.teamA) || { id: game.teamA };
    const teamB = teams.find(t => t.id === game.teamB) || { id: game.teamB };
    
    // Use the winner field from the game data, which handles tied scores correctly
    const winner = game.winner === 'teamA' ? teamA : teamB;
    const loser = game.winner === 'teamA' ? teamB : teamA;
    const winnerScore = game.winner === 'teamA' ? game.scoreA : game.scoreB;
    const loserScore = game.winner === 'teamA' ? game.scoreB : game.scoreA;
    
    return {
      winner,
      loser,
      winnerScore,
      loserScore,
      round: game.round,
      boston: game.boston,
      timestamp: game.timestamp
    };
  };
  if (!activeTournament) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>No Active Tournament</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 text-center">Please select an active tournament to view results.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ScoreVerifier games={games} teams={teams} schedules={schedules} activeTournamentId={activeTournament?.id ?? null} onRefresh={refreshGamesFromSupabase} />
      <div>
        {/* Export Button */}
        <div className="flex justify-end mb-2">
          {/* Dynamically import to avoid SSR issues if any */}
          {activeTournament && (
            <React.Suspense fallback={<span>Loading...</span>}>
              <ExportResultsButton tournamentId={activeTournament.id} />
            </React.Suspense>
          )}
        </div>
        <TournamentResults tournamentId={activeTournament.id} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Game Results - {tournament?.name || 'Tournament'}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {completedGames.length} completed game{completedGames.length !== 1 ? 's' : ''}
          </p>
        </CardHeader>
        <CardContent>
          {completedGames.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Trophy className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="font-medium">No completed games yet</p>
              <p className="text-sm">Games will appear here after both teams confirm scores</p>
            </div>
          ) : (
            <div className="space-y-4">
              {completedGames.map((game) => {
                const result = formatGameResult(game);
                return (
                  <div 
                    key={game.id} 
                    className="p-4 rounded-lg border bg-gradient-to-r from-gray-50 to-white hover:from-gray-100 hover:to-gray-50 transition-all duration-200"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-medium px-3 py-1">
                          Round {result.round}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <Trophy className="h-4 w-4 text-yellow-500" />
                          <span className="font-semibold text-green-700">
                            Team # {result.winner.teamNumber ?? result.winner.id}
                          </span>
                          <span className="font-bold text-lg mx-2">
                            {result.winnerScore} - {result.loserScore}
                          </span>
                          <span className="font-medium text-red-600">
                            Team # {result.loser.teamNumber ?? result.loser.id}
                          </span>
                        </div>
                        {game.boston !== 'none' && (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                            <Award className="h-3 w-3 mr-1" />
                            Boston
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 text-right">
                        <div>{new Date(result.timestamp).toLocaleDateString()}</div>
                        <div>{new Date(result.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CombinedResultsPage;