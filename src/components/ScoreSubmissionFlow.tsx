import React, { useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';

interface ScoreSubmissionFlowProps {
  tournamentId: string;
}

export const ScoreSubmissionFlow: React.FC<ScoreSubmissionFlowProps> = ({ tournamentId }) => {
  const { teams, tournaments, submitGame, currentUser } = useAppContext();
  const [teamAId, setTeamAId] = useState('');
  const [teamBId, setTeamBId] = useState('');
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [boston, setBoston] = useState<'none' | 'teamA' | 'teamB'>('none');
  const [round, setRound] = useState('1');
  const [submitting, setSubmitting] = useState(false);

  const tournament = tournaments.find(t => t.id === tournamentId);
  const tournamentTeams = teams.filter(team => 
    team.registeredTournaments?.includes(tournamentId)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamAId || !teamBId || !scoreA || !scoreB) return;

    const teamA = teams.find(t => t.id === teamAId)!;
    const teamB = teams.find(t => t.id === teamBId)!;
    const scoreANum = parseInt(scoreA);
    const scoreBNum = parseInt(scoreB);
    const winner = scoreANum > scoreBNum ? 'teamA' : 'teamB';

    setSubmitting(true);
    try {
      submitGame({
        teamA,
        teamB,
        scoreA: scoreANum,
        scoreB: scoreBNum,
        boston,
        winner,
        matchId: `${tournamentId}-${round}-${Date.now()}`,
        round: parseInt(round),
        teamAScore: scoreANum,
        teamBScore: scoreBNum
      });

      // Reset form
      setTeamAId('');
      setTeamBId('');
      setScoreA('');
      setScoreB('');
      setBoston('none');
      setRound('1');
    } finally {
      setSubmitting(false);
    }
  };

  if (!tournament) {
    return (
      <Alert>
        <AlertDescription>
          Please select a tournament to submit scores.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Manual Score Entry - {tournament.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="teamA">Team A</Label>
              <Select value={teamAId} onValueChange={setTeamAId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Team A" />
                </SelectTrigger>
                <SelectContent>
                  {tournamentTeams.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      #{team.teamNumber} {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="teamB">Team B</Label>
              <Select value={teamBId} onValueChange={setTeamBId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Team B" />
                </SelectTrigger>
                <SelectContent>
                  {tournamentTeams.filter(t => t.id !== teamAId).map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      #{team.teamNumber} {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="scoreA">Team A Score</Label>
              <Input
                id="scoreA"
                type="number"
                value={scoreA}
                onChange={(e) => setScoreA(e.target.value)}
                placeholder="0"
                min="0"
              />
            </div>
            <div>
              <Label htmlFor="scoreB">Team B Score</Label>
              <Input
                id="scoreB"
                type="number"
                value={scoreB}
                onChange={(e) => setScoreB(e.target.value)}
                placeholder="0"
                min="0"
              />
            </div>
            <div>
              <Label htmlFor="round">Round</Label>
              <Select value={round} onValueChange={setRound}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map(r => (
                    <SelectItem key={r} value={r.toString()}>
                      Round {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="boston">Boston</Label>
            <Select value={boston} onValueChange={(value: 'none' | 'teamA' | 'teamB') => setBoston(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Boston</SelectItem>
                <SelectItem value="teamA">Team A Boston</SelectItem>
                <SelectItem value="teamB">Team B Boston</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={submitting || !teamAId || !teamBId || !scoreA || !scoreB}>
            {submitting ? 'Submitting...' : 'Submit Score'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ScoreSubmissionFlow;