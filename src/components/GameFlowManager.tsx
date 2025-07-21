import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Trophy, ArrowRight, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { sendConfirmationSMS } from '@/api/messaging';

interface GameResult {
  id: string;
  round: number;
  table: number;
  team1: string;
  team2: string;
  winner: string;
  loser: string;
  nextRound?: { table: number; opponent: string; };
}

interface ScoreData {
  winner: number;
  loser: number;
  boston: boolean;
}

type FlowState = 'phone-entry' | 'winner-score' | 'loser-confirm' | 'completed';

export const GameFlowManager: React.FC = () => {
  const [currentFlow, setCurrentFlow] = useState<FlowState>('phone-entry');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [teamName, setTeamName] = useState('');
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [isWinner, setIsWinner] = useState(false);
  const [winnerScore, setWinnerScore] = useState('');
  const [loserScore, setLoserScore] = useState('');
  const [boston, setBoston] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { teams } = useAppContext();

  const mockGameResults: GameResult[] = [
    { id: 'R1G1', round: 1, table: 1, team1: 'Team A', team2: 'Team B', winner: 'Team A', loser: 'Team B', nextRound: { table: 3, opponent: 'Team C' } },
    { id: 'R1G2', round: 1, table: 2, team1: 'Team C', team2: 'Team D', winner: 'Team C', loser: 'Team D', nextRound: { table: 4, opponent: 'Team G' } }
  ];

  const handlePhoneSubmit = () => {
    if (!phoneNumber) return;
    const team = teams.find(t => (t.phone_Number || t.phoneNumber) === phoneNumber);
    if (!team) { alert('Team not found'); return; }
    const result = mockGameResults.find(r => r.team1 === team.name || r.team2 === team.name);
    if (result) {
      setGameResult(result);
      setTeamName(team.name);
      setIsWinner(result.winner === team.name);
      setCurrentFlow(result.winner === team.name ? 'winner-score' : 'loser-confirm');
      if (result.winner !== team.name) setScoreData({ winner: 21, loser: 15, boston: false });
    } else { alert('No game found'); }
  };

  const handleScoreSubmit = async () => {
    if (!winnerScore || !loserScore) { alert('Enter both scores'); return; }
    const winScore = parseInt(winnerScore), loseScore = parseInt(loserScore);
    if (winScore <= loseScore) { alert('Winner score must be higher'); return; }
    setIsSubmitting(true);
    const score = { winner: winScore, loser: loseScore, boston };
    setScoreData(score);
    if (gameResult) {
      const loserTeam = teams.find(t => t.name === gameResult.loser);
      if (loserTeam) {
        await sendConfirmationSMS(loserTeam.phone_Number || loserTeam.phoneNumber, {
          loserTeam: gameResult.loser, winnerTeam: gameResult.winner, round: gameResult.round,
          nextTable: gameResult.nextRound?.table || 0, nextOpponent: gameResult.nextRound?.opponent || ''
        });
      }
    }
    setCurrentFlow('completed');
    setIsSubmitting(false);
  };

  const handleConfirm = (confirmed: boolean) => {
    setCurrentFlow('completed');
    console.log(confirmed ? 'Score confirmed' : 'Score disputed');
  };

  const resetFlow = () => {
    setCurrentFlow('phone-entry'); setGameResult(null); setTeamName(''); setScoreData(null);
    setIsWinner(false); setPhoneNumber(''); setWinnerScore(''); setLoserScore(''); setBoston(false);
  };

  if (currentFlow === 'completed') {
    return (
      <div className="max-w-2xl mx-auto">
        <Alert><CheckCircle className="h-4 w-4" /><AlertDescription className="text-base">
          <strong>Game Complete!</strong> Score has been {isWinner ? 'submitted and confirmed' : 'confirmed'}.
          {gameResult?.nextRound && <span> Please proceed to Table {gameResult.nextRound.table} for your next match.</span>}
        </AlertDescription></Alert>
        <button onClick={resetFlow} className="mt-4 text-blue-600 hover:underline text-sm">Start New Game Flow</button>
      </div>
    );
  }

  if (currentFlow === 'winner-score' && gameResult) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" />Enter Final Score</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <Alert><Trophy className="h-4 w-4" /><AlertDescription>
            <strong>Congrats {teamName}!</strong> Please enter the final score. {gameResult.loser} will receive a text to confirm.
          </AlertDescription></Alert>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>{teamName} (Winner)</Label><Input type="number" placeholder="21" value={winnerScore} onChange={(e) => setWinnerScore(e.target.value)} /></div>
            <div><Label>{gameResult.loser}</Label><Input type="number" placeholder="15" value={loserScore} onChange={(e) => setLoserScore(e.target.value)} /></div>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox checked={boston} onCheckedChange={(checked) => setBoston(checked as boolean)} /><Label>Boston (Shutout)</Label>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setCurrentFlow('phone-entry')} className="flex-1"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
            <Button onClick={handleScoreSubmit} disabled={!winnerScore || !loserScore || isSubmitting} className="flex-1">
              {isSubmitting ? 'Submitting...' : 'Submit Score'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (currentFlow === 'loser-confirm' && gameResult && scoreData) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader><CardTitle>Confirm Game Results</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <Alert><AlertDescription>
            Tough loss, please confirm the final results below and then proceed to table {gameResult.nextRound?.table} to play {gameResult.nextRound?.opponent} in round {gameResult.round + 1}.
          </AlertDescription></Alert>
          <div className="bg-gray-50 p-4 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-center"><p className="font-medium">{gameResult.winner}</p><p className="text-2xl font-bold text-green-600">{scoreData.winner}</p><Badge>Winner</Badge></div>
              <div className="text-center text-muted-foreground"><p>vs</p></div>
              <div className="text-center"><p className="font-medium">{gameResult.loser}</p><p className="text-2xl font-bold">{scoreData.loser}</p><Badge variant="secondary">Loser</Badge></div>
            </div>
            {scoreData.boston && <div className="text-center"><Badge variant="destructive">Boston (Shutout)</Badge></div>}
          </div>
          <div className="flex gap-3">
            <Button variant="destructive" onClick={() => handleConfirm(false)} className="flex-1"><XCircle className="h-4 w-4 mr-2" />Dispute</Button>
            <Button onClick={() => handleConfirm(true)} className="flex-1"><CheckCircle className="h-4 w-4 mr-2" />Confirm</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader><CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5" />Team Access</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div><Label>Team Phone Number</Label><Input type="tel" placeholder="(555) 123-4567" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} /></div>
        <Button onClick={handlePhoneSubmit} disabled={!phoneNumber} className="w-full" size="lg">Access Game</Button>
        <Alert><AlertDescription><strong>Demo:</strong> Try phone numbers from registered teams.</AlertDescription></Alert>
      </CardContent>
    </Card>
  );
};