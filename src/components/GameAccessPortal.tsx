import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TeamScoreEntry } from './TeamScoreEntry';
import { WaitingForConfirmation } from './WaitingForConfirmation';
import { Smartphone, Trophy, Users, ArrowRight } from 'lucide-react';

interface Game {
  id: string;
  round: number;
  team1: string;
  team2: string;
  status: 'pending' | 'in-progress' | 'completed' | 'awaiting-confirmation';
  winner?: string;
  submittedScore?: { winner: number; loser: number; boston: boolean };
}

export const GameAccessPortal: React.FC = () => {
  const [teamCode, setTeamCode] = useState('');
  const [gameCode, setGameCode] = useState('');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [currentView, setCurrentView] = useState<'portal' | 'score-entry' | 'waiting'>('portal');

  // Mock games for demonstration
  const [mockGames, setMockGames] = useState<Game[]>([
    { id: 'R1G1', round: 1, team1: 'Team A', team2: 'Team B', status: 'completed', winner: 'Team A' },
    { id: 'R1G2', round: 1, team1: 'Team C', team2: 'Team D', status: 'pending' },
    { id: 'R2G1', round: 2, team1: 'Team A', team2: 'Winner of R1G2', status: 'pending' }
  ]);

  const handleAccessGame = () => {
    if (teamCode && gameCode) {
      const game = mockGames.find(g => g.id === gameCode);
      if (game) {
        setSelectedGame(game);
      }
    }
  };

  const handleEnterScore = () => {
    setCurrentView('score-entry');
  };

  const handleScoreSubmitted = () => {
    if (selectedGame) {
      // Update game status to awaiting confirmation
      const updatedGames = mockGames.map(g => 
        g.id === selectedGame.id 
          ? { ...g, status: 'awaiting-confirmation' as const, submittedScore: { winner: 21, loser: 15, boston: false } }
          : g
      );
      setMockGames(updatedGames);
      setSelectedGame({ ...selectedGame, status: 'awaiting-confirmation', submittedScore: { winner: 21, loser: 15, boston: false } });
      setCurrentView('waiting');
    }
  };

  const handleBackToPortal = () => {
    setCurrentView('portal');
    setSelectedGame(null);
    setTeamCode('');
    setGameCode('');
  };

  const isWinningTeam = (teamName: string, game: Game) => {
    return game.winner === teamName;
  };

  // Show score entry form
  if (currentView === 'score-entry' && selectedGame) {
    return (
      <TeamScoreEntry
        game={selectedGame}
        teamName={teamCode}
        onBack={() => setCurrentView('portal')}
        onScoreSubmitted={handleScoreSubmitted}
      />
    );
  }

  // Show waiting for confirmation
  if (currentView === 'waiting' && selectedGame) {
    return (
      <WaitingForConfirmation
        game={selectedGame}
        teamName={teamCode}
        onBack={handleBackToPortal}
      />
    );
  }

  // Show game details after access
  if (selectedGame && currentView === 'portal') {
    const isWinner = isWinningTeam(teamCode, selectedGame);
    
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Game {selectedGame.id} - Round {selectedGame.round}
            </CardTitle>
            <div className="flex gap-2">
              <Badge variant={selectedGame.team1 === teamCode ? 'default' : 'secondary'}>
                {selectedGame.team1}
              </Badge>
              <span className="text-muted-foreground">vs</span>
              <Badge variant={selectedGame.team2 === teamCode ? 'default' : 'secondary'}>
                {selectedGame.team2}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedGame.status === 'completed' && isWinner ? (
              <Alert>
                <Trophy className="h-4 w-4" />
                <AlertDescription>
                  Congratulations! You won this game. The score has been entered and confirmed.
                </AlertDescription>
              </Alert>
            ) : selectedGame.status === 'awaiting-confirmation' && isWinner ? (
              <Alert>
                <AlertDescription>
                  Score submitted! Waiting for {selectedGame.team1 === teamCode ? selectedGame.team2 : selectedGame.team1} to confirm.
                </AlertDescription>
              </Alert>
            ) : selectedGame.status === 'completed' && !isWinner ? (
              <Alert>
                <AlertDescription>
                  This game has been completed. You can view the final results.
                </AlertDescription>
              </Alert>
            ) : isWinner ? (
              <div className="space-y-4">
                <Alert>
                  <Trophy className="h-4 w-4" />
                  <AlertDescription>
                    You are the winning team! Please enter the final score for this game.
                  </AlertDescription>
                </Alert>
                <Button className="w-full" size="lg" onClick={handleEnterScore}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Enter Game Score
                </Button>
              </div>
            ) : (
              <Alert>
                <AlertDescription>
                  Waiting for the winning team to enter the score. You will receive a confirmation request once they submit.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
        
        <Button variant="outline" onClick={() => setSelectedGame(null)}>
          Back to Game Access
        </Button>
      </div>
    );
  }

  // Main portal view
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Team Game Access Portal
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your team code and game code to access score entry
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              <strong>How it works:</strong> After your game ends, the winning team enters their team name and game code to access the score entry form.
            </AlertDescription>
          </Alert>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="teamCode">Team Name</Label>
              <Input
                id="teamCode"
                placeholder="e.g., Team A"
                value={teamCode}
                onChange={(e) => setTeamCode(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gameCode">Game Code</Label>
              <Input
                id="gameCode"
                placeholder="e.g., R1G1"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value)}
              />
            </div>
          </div>
          
          <Button 
            onClick={handleAccessGame}
            disabled={!teamCode || !gameCode}
            className="w-full"
            size="lg"
          >
            Access Game
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available Games</CardTitle>
          <p className="text-sm text-muted-foreground">
            Current tournament games - Try "Team A" + "R1G1" to see the winning team flow
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockGames.map((game) => (
              <div key={game.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge variant="outline">Round {game.round}</Badge>
                  <div>
                    <p className="font-medium">{game.id}</p>
                    <p className="text-sm text-muted-foreground">
                      {game.team1} vs {game.team2}
                      {game.winner && <span className="ml-2 text-green-600">Winner: {game.winner}</span>}
                    </p>
                  </div>
                </div>
                <Badge 
                  variant={game.status === 'completed' ? 'default' : 
                          game.status === 'awaiting-confirmation' ? 'secondary' :
                          game.status === 'in-progress' ? 'secondary' : 'outline'}
                >
                  {game.status === 'completed' ? 'Completed' :
                   game.status === 'awaiting-confirmation' ? 'Awaiting Confirmation' :
                   game.status === 'in-progress' ? 'In Progress' : 'Pending'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};