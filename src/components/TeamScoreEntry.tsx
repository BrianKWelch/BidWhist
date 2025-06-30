import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trophy, Users, ArrowLeft, CheckCircle } from 'lucide-react';

interface Game {
  id: string;
  round: number;
  team1: string;
  team2: string;
  status: 'pending' | 'in-progress' | 'completed';
  winner?: string;
}

interface TeamScoreEntryProps {
  game: Game;
  teamName: string;
  onBack: () => void;
  onScoreSubmitted: () => void;
}

export const TeamScoreEntry: React.FC<TeamScoreEntryProps> = ({ 
  game, 
  teamName, 
  onBack, 
  onScoreSubmitted 
}) => {
  const [myScore, setMyScore] = useState('');
  const [opponentScore, setOpponentScore] = useState('');
  const [bostonSelected, setBostonSelected] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const opponentName = game.team1 === teamName ? game.team2 : game.team1;

  const handleSubmitScore = async () => {
    if (!myScore || !opponentScore) return;
    
    setIsSubmitting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('Score submitted:', {
      gameId: game.id,
      winningTeam: teamName,
      winningScore: myScore,
      losingScore: opponentScore,
      boston: bostonSelected
    });
    
    setIsSubmitting(false);
    onScoreSubmitted();
  };

  const isValidScore = () => {
    const my = parseInt(myScore);
    const opp = parseInt(opponentScore);
    return my > 0 && opp >= 0 && my > opp;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Enter Score - Game {game.id}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="default">{teamName} (You)</Badge>
            <span className="text-muted-foreground">vs</span>
            <Badge variant="secondary">{opponentName}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Trophy className="h-4 w-4" />
            <AlertDescription>
              Congratulations on winning! Please enter the final score for confirmation.
            </AlertDescription>
          </Alert>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-2 border-green-200 bg-green-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {teamName} (Winner)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="myScore">Your Score</Label>
                  <Input
                    id="myScore"
                    type="number"
                    placeholder="21"
                    value={myScore}
                    onChange={(e) => setMyScore(e.target.value)}
                    className="text-2xl font-bold text-center"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {opponentName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="oppScore">Opponent Score</Label>
                  <Input
                    id="oppScore"
                    type="number"
                    placeholder="15"
                    value={opponentScore}
                    onChange={(e) => setOpponentScore(e.target.value)}
                    className="text-2xl font-bold text-center"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Boston Selection</CardTitle>
              <p className="text-sm text-muted-foreground">
                Did you win by Boston (shutout)?
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button
                  variant={bostonSelected ? "default" : "outline"}
                  size="lg"
                  onClick={() => setBostonSelected(true)}
                  className="flex-1"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Yes - Boston Win
                </Button>
                <Button
                  variant={!bostonSelected ? "default" : "outline"}
                  size="lg"
                  onClick={() => setBostonSelected(false)}
                  className="flex-1"
                >
                  No - Regular Win
                </Button>
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={handleSubmitScore}
            disabled={!isValidScore() || isSubmitting}
            className="w-full"
            size="lg"
          >
            {isSubmitting ? 'Submitting Score...' : 'Submit Score for Confirmation'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};