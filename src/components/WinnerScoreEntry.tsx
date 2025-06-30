import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trophy, ArrowLeft } from 'lucide-react';

interface GameResult {
  id: string;
  round: number;
  table: number;
  team1: string;
  team2: string;
  winner: string;
  loser: string;
  nextRound?: {
    table: number;
    opponent: string;
  };
}

interface WinnerScoreEntryProps {
  gameResult: GameResult;
  teamName: string;
  onBack: () => void;
  onScoreSubmitted: (score: { winner: number; loser: number; boston: boolean }) => void;
}

export const WinnerScoreEntry: React.FC<WinnerScoreEntryProps> = ({
  gameResult,
  teamName,
  onBack,
  onScoreSubmitted
}) => {
  const [winnerScore, setWinnerScore] = useState('');
  const [loserScore, setLoserScore] = useState('');
  const [boston, setBoston] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!winnerScore || !loserScore) {
      alert('Please enter both scores');
      return;
    }

    const winScore = parseInt(winnerScore);
    const loseScore = parseInt(loserScore);

    if (winScore <= loseScore) {
      alert('Winner score must be higher than loser score');
      return;
    }

    setIsSubmitting(true);
    
    // Simulate API call and SMS sending
    setTimeout(() => {
      onScoreSubmitted({
        winner: winScore,
        loser: loseScore,
        boston
      });
      setIsSubmitting(false);
    }, 1000);
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Enter Final Score
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {teamName} vs {gameResult.loser} - Round {gameResult.round}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Trophy className="h-4 w-4" />
          <AlertDescription>
            <strong>Congrats {teamName}!</strong> Please enter the final score below. 
            {gameResult.loser} will receive a text message to confirm these results.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="winnerScore">{teamName} (Winner)</Label>
            <Input
              id="winnerScore"
              type="number"
              placeholder="21"
              value={winnerScore}
              onChange={(e) => setWinnerScore(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="loserScore">{gameResult.loser}</Label>
            <Input
              id="loserScore"
              type="number"
              placeholder="15"
              value={loserScore}
              onChange={(e) => setLoserScore(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="boston"
            checked={boston}
            onCheckedChange={(checked) => setBoston(checked as boolean)}
          />
          <Label htmlFor="boston">Boston (Shutout)</Label>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Next Round</h3>
          <p className="text-sm">
            After confirmation, proceed to <strong>Table {gameResult.nextRound?.table}</strong> to play <strong>{gameResult.nextRound?.opponent}</strong> in Round {gameResult.round + 1}.
          </p>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="flex-1">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!winnerScore || !loserScore || isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Score'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};