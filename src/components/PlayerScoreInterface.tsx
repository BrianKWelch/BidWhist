import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { WaitingForConfirmation } from './WaitingForConfirmation';

interface PlayerScoreInterfaceProps {
  teamName: string;
  opponentName: string;
  isWinningTeam: boolean;
  onSubmitScore?: (score: { teamScore: number; opponentScore: number; boston?: string }) => void;
  onConfirmScore?: (confirmed: boolean) => void;
  pendingScore?: {
    teamScore: number;
    opponentScore: number;
    boston?: string;
  };
  gameStatus: 'entering' | 'pending_confirmation' | 'confirmed' | 'disputed';
}

export const PlayerScoreInterface: React.FC<PlayerScoreInterfaceProps> = ({
  teamName,
  opponentName,
  isWinningTeam,
  onSubmitScore,
  onConfirmScore,
  pendingScore,
  gameStatus
}) => {
  const [teamScore, setTeamScore] = useState('');
  const [opponentScore, setOpponentScore] = useState('');
  const [boston, setBoston] = useState<'none' | 'us' | 'them'>('none');
  const [scoreMismatch, setScoreMismatch] = useState(false);

  const handleSubmit = () => {
    if (onSubmitScore && teamScore && opponentScore) {
      setScoreMismatch(false);
      onSubmitScore({
        teamScore: parseInt(teamScore),
        opponentScore: parseInt(opponentScore),
        boston: boston === 'none' ? undefined : boston
      });
    }
  };

  // Show waiting screen for winning team after score submission
  if (gameStatus === 'pending_confirmation' && isWinningTeam && pendingScore) {
    // If scores don't match, show error and allow resubmission
    if (scoreMismatch) {
      return (
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Score mismatch, please resolve</CardTitle>
            <p className="text-center text-sm text-muted-foreground">
              {teamName} vs {opponentName}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                The scores submitted by both teams do not match. Please update your score and resubmit.
              </AlertDescription>
            </Alert>
            {/* Reuse the score entry UI */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="teamScore">{teamName} Score</Label>
                <Input
                  id="teamScore"
                  type="number"
                  value={teamScore}
                  onChange={(e) => setTeamScore(e.target.value)}
                  placeholder="0"
                  min="0"
                />
              </div>
              <div>
                <Label htmlFor="opponentScore">{opponentName} Score</Label>
                <Input
                  id="opponentScore"
                  type="number"
                  value={opponentScore}
                  onChange={(e) => setOpponentScore(e.target.value)}
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>
            <div>
              <Label>Boston</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  variant={boston === 'none' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBoston('none')}
                >
                  No Boston
                </Button>
                <Button
                  variant={boston === 'us' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBoston('us')}
                >
                  We Boston
                </Button>
                <Button
                  variant={boston === 'them' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBoston('them')}
                >
                  They Boston
                </Button>
              </div>
            </div>
            <Button 
              onClick={handleSubmit}
              disabled={!teamScore || !opponentScore}
              className="w-full"
            >
              Resubmit Score
            </Button>
          </CardContent>
        </Card>
      );
    }
    return (
      <WaitingForConfirmation
        teamName={teamName}
        opponentName={opponentName}
        submittedScore={pendingScore}
      />
    );
  }

  if (gameStatus === 'entering' && isWinningTeam) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-center">
            Enter Game Score
          </CardTitle>
          <p className="text-center text-sm text-muted-foreground">
            {teamName} vs {opponentName}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="teamScore">{teamName} Score</Label>
              <Input
                id="teamScore"
                type="number"
                value={teamScore}
                onChange={(e) => setTeamScore(e.target.value)}
                placeholder="0"
                min="0"
              />
            </div>
            <div>
              <Label htmlFor="opponentScore">{opponentName} Score</Label>
              <Input
                id="opponentScore"
                type="number"
                value={opponentScore}
                onChange={(e) => setOpponentScore(e.target.value)}
                placeholder="0"
                min="0"
              />
            </div>
          </div>
          
          <div>
            <Label>Boston</Label>
            <div className="flex gap-2 mt-2">
              <Button
                variant={boston === 'none' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setBoston('none')}
              >
                No Boston
              </Button>
              <Button
                variant={boston === 'us' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setBoston('us')}
              >
                We Boston
              </Button>
              <Button
                variant={boston === 'them' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setBoston('them')}
              >
                They Boston
              </Button>
            </div>
          </div>

          <Button 
            onClick={handleSubmit}
            disabled={!teamScore || !opponentScore}
            className="w-full"
          >
            Submit Score
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (gameStatus === 'pending_confirmation' && !isWinningTeam && pendingScore) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-center flex items-center justify-center gap-2">
            <Clock className="h-5 w-5" />
            Confirm Game Score
          </CardTitle>
          <p className="text-center text-sm text-muted-foreground">
            {teamName} vs {opponentName}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {opponentName} reported the following score. Please confirm if this is correct.
            </AlertDescription>
          </Alert>
          
          <div className="bg-muted p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="font-semibold">{teamName}</p>
                <p className="text-2xl font-bold">{pendingScore.teamScore}</p>
              </div>
              <div>
                <p className="font-semibold">{opponentName}</p>
                <p className="text-2xl font-bold">{pendingScore.opponentScore}</p>
              </div>
            </div>
            {pendingScore.boston && (
              <div className="mt-2 text-center">
                <Badge variant="secondary">
                  Boston: {pendingScore.boston === 'us' ? teamName : opponentName}
                </Badge>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Button 
              onClick={() => onConfirmScore?.(true)}
              className="w-full"
            >
              Confirm Score
            </Button>
            <Button 
              variant="destructive"
              onClick={() => onConfirmScore?.(false)}
              className="w-full"
            >
              Dispute Score
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (gameStatus === 'confirmed') {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-center flex items-center justify-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Score Confirmed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="font-semibold">{teamName}</p>
                <p className="text-2xl font-bold">{pendingScore?.teamScore}</p>
              </div>
              <div>
                <p className="font-semibold">{opponentName}</p>
                <p className="text-2xl font-bold">{pendingScore?.opponentScore}</p>
              </div>
            </div>
            {pendingScore?.boston && (
              <div className="mt-2 text-center">
                <Badge variant="secondary">
                  Boston: {pendingScore.boston === 'us' ? teamName : opponentName}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="pt-6">
        <p className="text-center text-muted-foreground">
          Waiting for game to start...
        </p>
      </CardContent>
    </Card>
  );
};