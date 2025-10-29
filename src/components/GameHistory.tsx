import React from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Target, Award } from 'lucide-react';

const GameHistory = () => {
  const { games, teams, getTournamentResults } = useAppContext();
  
  // Get all completed games
  const completedGames = games.filter(game => game.confirmed)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Get overall tournament stats
  const tournamentResults = getTournamentResults('1');
  
  const overallStats = {
    totalGames: completedGames.length,
    totalPoints: completedGames.reduce((sum, game) => sum + game.scoreA + game.scoreB, 0),
    bostons: completedGames.filter(game => game.boston !== 'none').length,
    avgScore: completedGames.length > 0 ? 
      (completedGames.reduce((sum, game) => sum + game.scoreA + game.scoreB, 0) / completedGames.length).toFixed(1) : '0.0'
  };

  const formatGameResult = (game: any) => {
    const teamA = teams.find(t => t.id === game.teamA) || { id: game.teamA };
    const teamB = teams.find(t => t.id === game.teamB) || { id: game.teamB };
    
    // Calculate winner based on scores as a fallback if winner field is incorrect
    const scoreBasedWinner = game.scoreA > game.scoreB ? 'teamA' : 'teamB';
    const winner = scoreBasedWinner === 'teamA' ? teamA : teamB;
    const loser = scoreBasedWinner === 'teamA' ? teamB : teamA;
    const winnerScore = scoreBasedWinner === 'teamA' ? game.scoreA : game.scoreB;
    const loserScore = scoreBasedWinner === 'teamA' ? game.scoreB : game.scoreA;
    
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Tournament Game History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{overallStats.totalGames}</div>
            <div className="text-sm text-blue-600">Total Games</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{overallStats.totalPoints}</div>
            <div className="text-sm text-green-600">Total Points</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{overallStats.bostons}</div>
            <div className="text-sm text-yellow-600">Bostons</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{overallStats.avgScore}</div>
            <div className="text-sm text-purple-600">Avg Score</div>
          </div>
        </div>

        {/* Recent Games */}
        <div>
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <Target className="h-4 w-4" />
            Recent Games
          </h3>
          {completedGames.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No completed games yet</p>
              <p className="text-sm">Games will appear here after both teams confirm scores</p>
            </div>
          ) : (
            <div className="space-y-2">
              {completedGames.slice(0, 10).map((game) => {
                const result = formatGameResult(game);
                return (
                  <div 
                    key={game.id} 
                    className="p-3 rounded-lg border bg-gradient-to-r from-gray-50 to-white hover:from-gray-100 hover:to-gray-50 transition-all duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Round {result.round}
                        </Badge>
                        <span className="text-sm font-medium">
                          Team {result.winner.teamNumber || 'Unknown'} {result.winnerScore} - Team {result.loser.teamNumber || 'Unknown'} {result.loserScore}
                        </span>
                        {result.boston !== 'none' && (
                          <Award className="h-4 w-4 text-yellow-500" />
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(result.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {result.winner.player1FirstName} {result.winner.player1LastName} & {result.winner.player2FirstName} {result.winner.player2LastName} 
                      <span className="mx-2">vs</span>
                      {result.loser.player1FirstName} {result.loser.player1LastName} & {result.loser.player2FirstName} {result.loser.player2LastName}
                    </div>
                  </div>
                );
              })}
              {completedGames.length > 10 && (
                <div className="text-center text-sm text-gray-500 pt-2">
                  Showing 10 most recent games of {completedGames.length} total
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