import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, ArrowRight } from 'lucide-react';

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

interface ScoreData {
  winner: number;
  loser: number;
  boston: boolean;
}

interface LoserConfirmationProps {
  gameResult: GameResult;
  teamName: string;
  scoreData: ScoreData;
  onConfirm: (confirmed: boolean) => void;
}

export const LoserConfirmation: React.FC<LoserConfirmationProps> = ({
  gameResult,
  teamName,
  scoreData,
  onConfirm
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirmation = async (confirmed: boolean) => {
    setIsSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      onConfirm(confirmed);
      setIsSubmitting(false);
    }, 1000);
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Confirm Game Results</CardTitle>
        <p className="text-sm text-muted-foreground">
          Round {gameResult.round} - Table {gameResult.table}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertDescription className="text-base">
            Tough loss, please confirm the final results below and then proceed to table {gameResult.nextRound?.table} to play {gameResult.nextRound?.opponent} in round {gameResult.round + 1}.
          </AlertDescription>
        </Alert>

        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
          <h3 className="font-semibold">Final Score</h3>
          <div className="flex items-center justify-between">
            <div className="text-center">
              <p className="font-medium">{gameResult.winner}</p>
              <p className="text-2xl font-bold text-green-600">{scoreData.winner}</p>
              <Badge variant="default">Winner</Badge>
            </div>
            <div className="text-center text-muted-foreground">
              <p className="text-lg">vs</p>
            </div>
            <div className="text-center">
              <p className="font-medium">{gameResult.loser}</p>
              <p className="text-2xl font-bold">{scoreData.loser}</p>
              <Badge variant="secondary">Loser</Badge>
            </div>
          </div>
          {scoreData.boston && (
            <div className="text-center">
              <Badge variant="destructive">Boston (Shutout)</Badge>
            </div>
          )}
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Next Round</h3>
          <p className="text-sm">
            After confirmation, proceed to <strong>Table {gameResult.nextRound?.table}</strong> to play <strong>{gameResult.nextRound?.opponent}</strong> in Round {gameResult.round + 1}.
          </p>
        </div>

        <div className="flex gap-3">
          <Button 
            variant="destructive"
            onClick={() => handleConfirmation(false)}
            disabled={isSubmitting}
            className="flex-1"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Dispute Score
          </Button>
          <Button 
            onClick={() => handleConfirmation(true)}
            disabled={isSubmitting}
            className="flex-1"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Confirming...' : 'Confirm Score'}
          </Button>
        </div>

        <Alert>
          <AlertDescription className="text-sm">
            By confirming, you agree that these results are accurate. If you dispute the score, a tournament official will be notified.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};