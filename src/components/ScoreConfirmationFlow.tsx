import React, { useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

interface ScoreConfirmationFlowProps {
  tournamentId: string;
}

export const ScoreConfirmationFlow: React.FC<ScoreConfirmationFlowProps> = ({ tournamentId }) => {
  const { games, confirmScore, teams, tournaments } = useAppContext();
  const [processing, setProcessing] = useState<string | null>(null);

  const tournament = tournaments.find(t => t.id === tournamentId);
  const pendingGames = games.filter(game => 
    !game.confirmed && 
    game.matchId?.startsWith(tournamentId)
  );

  const handleConfirmScore = async (gameId: string, confirm: boolean) => {
    setProcessing(gameId);
    console.log('Confirming score for game:', gameId, 'Confirmation status:', confirm);
    try {
      await confirmScore(gameId, confirm);
    } finally {
      setProcessing(null);
    }
  };

  const getTeamName = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    return team ? `#${team.teamNumber} ${team.name}` : 'Unknown Team';
  };

  if (!tournament) {
    return (
      <Alert>
        <AlertDescription>
          Please select a tournament to view score confirmations.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Score Confirmations - {tournament.name}</h3>
        <Badge variant="outline">
          {pendingGames.length} Pending
        </Badge>
      </div>

      {pendingGames.length === 0 ? (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            No pending score confirmations for this tournament.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3">
          {pendingGames.map((game) => (
            <Card key={game.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-orange-500" />
                      <span className="font-medium">Round {game.round || 1}</span>
                    </div>
                    <div className="text-sm">
                      <div className="font-medium">
                        {getTeamName(game.teamA.id)} vs {getTeamName(game.teamB.id)}
                      </div>
                      <div className="text-gray-600 mt-1">
                        Score: {game.scoreA} - {game.scoreB}
                        {game.boston !== 'none' && (
                          <span className="ml-2 text-blue-600">
                            (Boston: {game.boston === 'teamA' ? game.teamA.name : game.teamB.name})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Submitted by: {game.submittedBy}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleConfirmScore(game.id, false)}
                      disabled={processing === game.id}
                      className="text-red-600 hover:text-red-700"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleConfirmScore(game.id, true)}
                      disabled={processing === game.id}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Confirm
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};