import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PlayerScoreInterface } from './PlayerScoreInterface';
import { MessageDisplay } from './MessageDisplay';
import { Smartphone, Users, ArrowRight } from 'lucide-react';

interface GameState {
  teamA: string;
  teamB: string;
  status: 'entering' | 'pending_confirmation' | 'confirmed' | 'disputed';
  submittedScore?: {
    teamAScore: number;
    teamBScore: number;
    boston?: string;
    submittedBy: 'teamA' | 'teamB';
  };
  messages: Array<{
    id: string;
    to: string;
    message: string;
    timestamp: Date;
  }>;
}

export const ScoreSimulator: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    teamA: 'Team Thunder',
    teamB: 'Team Lightning',
    status: 'entering',
    messages: []
  });
  
  const [currentView, setCurrentView] = useState<'teamA' | 'teamB' | 'admin'>('admin');

  const handleScoreSubmit = (score: { teamScore: number; opponentScore: number; boston?: string }) => {
    const winningTeam = score.teamScore > score.opponentScore ? 'teamA' : 'teamB';
    const losingTeam = winningTeam === 'teamA' ? 'teamB' : 'teamA';
    const losingTeamName = losingTeam === 'teamA' ? gameState.teamA : gameState.teamB;
    
    const newMessage = {
      id: Date.now().toString(),
      to: losingTeamName,
      message: `Score reported: ${gameState.teamA} ${score.teamScore} - ${gameState.teamB} ${score.opponentScore}${score.boston ? ` (Boston: ${score.boston === 'us' ? gameState.teamA : gameState.teamB})` : ''}. Please confirm this score by replying CONFIRM or DISPUTE.`,
      timestamp: new Date()
    };

    setGameState(prev => ({
      ...prev,
      status: 'pending_confirmation',
      submittedScore: {
        teamAScore: score.teamScore,
        teamBScore: score.opponentScore,
        boston: score.boston,
        submittedBy: 'teamA'
      },
      messages: [...prev.messages, newMessage]
    }));
  };

  const handleScoreConfirm = (confirmed: boolean) => {
    const responseMessage = {
      id: (Date.now() + 1).toString(),
      to: 'System',
      message: confirmed ? 
        `${gameState.teamB} confirmed the score. Game recorded successfully!` :
        `${gameState.teamB} disputed the score. Please contact tournament director.`,
      timestamp: new Date()
    };

    setGameState(prev => ({
      ...prev,
      status: confirmed ? 'confirmed' : 'disputed',
      messages: [...prev.messages, responseMessage]
    }));
  };

  const resetGame = () => {
    setGameState({
      teamA: 'Team Thunder',
      teamB: 'Team Lightning', 
      status: 'entering',
      messages: []
    });
  };

  const getPlayerInterface = (team: 'teamA' | 'teamB') => {
    const isTeamA = team === 'teamA';
    const teamName = isTeamA ? gameState.teamA : gameState.teamB;
    const opponentName = isTeamA ? gameState.teamB : gameState.teamA;
    const isWinningTeam = gameState.status === 'entering' && team === 'teamA';
    
    let pendingScore;
    if (gameState.submittedScore) {
      pendingScore = {
        teamScore: isTeamA ? gameState.submittedScore.teamAScore : gameState.submittedScore.teamBScore,
        opponentScore: isTeamA ? gameState.submittedScore.teamBScore : gameState.submittedScore.teamAScore,
        boston: gameState.submittedScore.boston
      };
    }

    return (
      <PlayerScoreInterface
        teamName={teamName}
        opponentName={opponentName}
        isWinningTeam={isWinningTeam}
        onSubmitScore={team === 'teamA' ? handleScoreSubmit : undefined}
        onConfirmScore={team === 'teamB' ? handleScoreConfirm : undefined}
        pendingScore={pendingScore}
        gameStatus={gameState.status}
      />
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Score Submission Simulator
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Simulate the player experience for score entry and confirmation
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Badge variant={gameState.status === 'entering' ? 'default' : 'secondary'}>
                {gameState.status === 'entering' && 'Entering Score'}
                {gameState.status === 'pending_confirmation' && 'Awaiting Confirmation'}
                {gameState.status === 'confirmed' && 'Score Confirmed'}
                {gameState.status === 'disputed' && 'Score Disputed'}
              </Badge>
              <span className="text-sm font-medium">
                {gameState.teamA} vs {gameState.teamB}
              </span>
            </div>
            <Button onClick={resetGame} variant="outline" size="sm">
              Reset Game
            </Button>
          </div>
          
          <div className="flex gap-2 mb-4">
            <Button
              variant={currentView === 'admin' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentView('admin')}
            >
              Admin View
            </Button>
            <Button
              variant={currentView === 'teamA' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentView('teamA')}
            >
              {gameState.teamA} View
            </Button>
            <Button
              variant={currentView === 'teamB' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentView('teamB')}
            >
              {gameState.teamB} View
            </Button>
          </div>
        </CardContent>
      </Card>

      {currentView === 'admin' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" />
              {gameState.teamA} Interface
            </h3>
            {getPlayerInterface('teamA')}
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" />
              {gameState.teamB} Interface
            </h3>
            {getPlayerInterface('teamB')}
          </div>
        </div>
      )}

      {currentView === 'teamA' && (
        <div>
          <h3 className="text-lg font-semibold mb-3">{gameState.teamA} View</h3>
          {getPlayerInterface('teamA')}
        </div>
      )}

      {currentView === 'teamB' && (
        <div>
          <h3 className="text-lg font-semibold mb-3">{gameState.teamB} View</h3>
          {getPlayerInterface('teamB')}
        </div>
      )}

      {gameState.messages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>SMS Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <MessageDisplay messages={gameState.messages} />
          </CardContent>
        </Card>
      )}
    </div>
  );
};