import React from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Target, Award, Calendar } from 'lucide-react';
import { TournamentResults } from './TournamentResults';

const CombinedResultsPage = () => {
  const { games, teams, getTournamentResults, tournaments, getActiveTournament } = useAppContext();

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
    const teamA = teams.find(t => t.id === game.teamA.id) || game.teamA;
    const teamB = teams.find(t => t.id === game.teamB.id) || game.teamB;
    const winner = game.scoreA > game.scoreB ? teamA : teamB;
    const loser = game.scoreA > game.scoreB ? teamB : teamA;
    const winnerScore = Math.max(game.scoreA, game.scoreB);
    const loserScore = Math.min(game.scoreA, game.scoreB);
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
      <TournamentResults tournamentId={activeTournament.id} />
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
                            Team {result.winner.teamNumber || 'Unknown'}
                          </span>
                          <span className="font-bold text-lg mx-2">
                            {result.winnerScore} - {result.loserScore}
                          </span>
                          <span className="font-medium text-red-600">
                            Team {result.loser.teamNumber || 'Unknown'}
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