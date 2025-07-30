import React, { useState, useEffect } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import type { ScheduleMatch } from '@/contexts/AppContext';

interface WebScoreSheetProps {
  matchId?: string;
  gameId?: string;
}

export const WebScoreSheet: React.FC<WebScoreSheetProps> = ({ matchId, gameId }) => {
  const { schedules, games, submitScore, confirmScore } = useAppContext();
  const [teamAScore, setTeamAScore] = useState('');
  const [teamBScore, setTeamBScore] = useState('');
  const [match, setMatch] = useState<ScheduleMatch | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (matchId) {
      const foundMatch = schedules
        .flatMap(s => s.matches)
        .find(m => m.id === matchId);
      setMatch(foundMatch || null);
    }
  }, [matchId, schedules]);

  const handleSubmitScore = async () => {
    if (!match || !teamAScore || !teamBScore) {
      toast({ title: 'Please enter scores for both teams', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      await submitScore({
        matchId: match.id,
        teamAScore: parseInt(teamAScore),
        teamBScore: parseInt(teamBScore),
        submittedBy: match.teamA,
        timestamp: new Date().toISOString()
      });
      
      toast({ title: 'Score submitted! Waiting for confirmation.' });
      setTeamAScore('');
      setTeamBScore('');
    } catch (error) {
      toast({ title: 'Failed to submit score', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmScore = async (confirm: boolean) => {
    if (!gameId) return;
    
    setIsSubmitting(true);
    try {
      console.log('Confirming score for game:', gameId, 'Confirmation status:', confirm);
      await confirmScore(gameId, confirm);
      toast({ 
        title: confirm ? 'Score confirmed!' : 'Score rejected. Original team notified.',
        variant: confirm ? 'default' : 'destructive'
      });
    } catch (error) {
      toast({ title: 'Failed to process confirmation', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!match && !gameId) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">No match or game specified</p>
        </CardContent>
      </Card>
    );
  }

  const pendingGame = gameId ? games.find(g => g.id === gameId) : null;

  return (
    <div className="max-w-md mx-auto space-y-6">
      {match && (
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Score Entry</CardTitle>
            <div className="text-center">
              <Badge variant="outline">Round {match.round}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center mb-4">
              <p className="font-medium">{match.teamA} vs {match.teamB}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="teamA">{match.teamA} Score</Label>
                <Input
                  id="teamA"
                  type="number"
                  value={teamAScore}
                  onChange={(e) => setTeamAScore(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="teamB">{match.teamB} Score</Label>
                <Input
                  id="teamB"
                  type="number"
                  value={teamBScore}
                  onChange={(e) => setTeamBScore(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            
            <Button 
              onClick={handleSubmitScore}
              disabled={isSubmitting || !teamAScore || !teamBScore}
              className="w-full"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Score'}
            </Button>
          </CardContent>
        </Card>
      )}

      {pendingGame && (
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Confirm Score</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center mb-4">
              <p className="font-medium">{String(pendingGame.teamA)} vs {String(pendingGame.teamB)}</p>
              <p className="text-lg font-bold">
                {pendingGame.teamAScore} - {pendingGame.teamBScore}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Button 
                onClick={() => handleConfirmScore(true)}
                disabled={isSubmitting}
                variant="default"
              >
                Confirm
              </Button>
              <Button 
                onClick={() => handleConfirmScore(false)}
                disabled={isSubmitting}
                variant="destructive"
              >
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};