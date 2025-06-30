import React from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Target, Award } from 'lucide-react';
import type { Team } from '@/contexts/AppContext';

interface GameHistoryProps {
  team: Team;
}

const GameHistory = ({ team }: GameHistoryProps) => {
  const { games, teams, getTournamentResults } = useAppContext();
  
  // Get team's completed games
  const teamGames = games.filter(game => 
    game.confirmed && (game.teamA.id === team.id || game.teamB.id === team.id)
  ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Get tournament results for this team
  const tournamentResults = getTournamentResults('1');
  const teamResult = tournamentResults.find(result => result.teamId === team.id);
  
  const stats = {
    wins: teamResult?.totalWins || 0,
    losses: Object.values(teamResult?.rounds || {}).filter(r => r.wl === 'L').length,
    totalPoints: teamResult?.totalPoints || 0,
    bostons: teamResult?.totalBoston || 0
  };

  const formatGameResult = (game: any) => {
    const isTeamA = game.teamA.id === team.id;
    const myScore = isTeamA ? game.scoreA : game.scoreB;
    const opponentScore = isTeamA ? game.scoreB : game.scoreA;
    const won = myScore > opponentScore;
    const opponent = isTeamA ? game.teamB : game.teamA;
    const opponentTeam = teams.find(t => t.id === opponent.id) || opponent;
    
    return {
      won,
      myScore,
      opponentScore,
      opponent: opponentTeam,
      round: game.round,
      boston: game.boston
    };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Team Record & History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Team Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{stats.wins}</div>
            <div className="text-sm text-green-600">Wins</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{stats.losses}</div>
            <div className="text-sm text-red-600">Losses</div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{stats.totalPoints}</div>
            <div className="text-sm text-blue-600">Points</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{stats.bostons}</div>
            <div className="text-sm text-yellow-600">Bostons</div>
          </div>
        </div>

        {/* Recent Games */}
        <div>
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <Target className="h-4 w-4" />
            Recent Games
          </h3>
          {teamGames.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No completed games yet</p>
              <p className="text-sm">Games will appear here after both teams confirm scores</p>
            </div>
          ) : (
            <div className="space-y-2">
              {teamGames.slice(0, 5).map((game) => {
                const result = formatGameResult(game);
                return (
                  <div 
                    key={game.id} 
                    className={`p-3 rounded-lg border ${
                      result.won ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          Round {result.round} {result.won ? 'W' : 'L'} You {result.myScore} - Team {result.opponent.teamNumber || 'Unknown'} {result.opponentScore}
                        </span>
                        {game.boston !== 'none' && (
                          <Award className="h-4 w-4 text-yellow-500" title="Boston" />
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(game.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                    {result.opponent.player1FirstName && (
                      <div className="text-xs text-gray-600 mt-1">
                        vs {result.opponent.player1FirstName} {result.opponent.player1LastName} & {result.opponent.player2FirstName} {result.opponent.player2LastName}
                      </div>
                    )}
                  </div>
                );
              })}
              {teamGames.length > 5 && (
                <div className="text-center text-sm text-gray-500 pt-2">
                  Showing 5 most recent games of {teamGames.length} total
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default GameHistory;