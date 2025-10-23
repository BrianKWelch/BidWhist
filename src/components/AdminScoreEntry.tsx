import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppContext } from '@/contexts/AppContext';
import { Trophy, Users, Target } from 'lucide-react';

const AdminScoreEntry: React.FC = () => {
  const { schedules, games, teams, tournaments, submitGame, getActiveTournament } = useAppContext();
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [handsA, setHandsA] = useState('');
  const [handsB, setHandsB] = useState('');
  const [bostonA, setBostonA] = useState('0');
  const [bostonB, setBostonB] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeTournament = getActiveTournament();
  const tracksHands = activeTournament?.tracksHands !== false;

  // Get all matches for the active tournament
  const tournamentMatches = schedules
    .filter(s => s.tournamentId === activeTournament?.id)
    .flatMap(s => s.matches)
    .filter(match => match.teamA !== 'TBD' && match.teamB !== 'TBD');

  const handleSubmitScore = async () => {
    if (!selectedMatch || !scoreA || !scoreB) return;
    
    if (tracksHands && (!handsA || !handsB)) return;
    
    const teamA = teams.find(t => t.id === selectedMatch.teamA);
    const teamB = teams.find(t => t.id === selectedMatch.teamB);
    
    if (!teamA || !teamB) return;

    setIsSubmitting(true);
    try {
      const gameData = {
        teamA: teamA.id,
        teamB: teamB.id,
        scoreA: parseInt(scoreA),
        scoreB: parseInt(scoreB),
        handsA: parseInt(handsA) || 0,
        handsB: parseInt(handsB) || 0,
        boston_a: parseInt(bostonA) || 0,
        boston_b: parseInt(bostonB) || 0,
        winner: parseInt(scoreA) > parseInt(scoreB) ? 'teamA' : 'teamB',
        matchId: selectedMatch.id,
        round: selectedMatch.round,
        submittedBy: 'admin', // Mark as admin-submitted
        status: 'confirmed', // Auto-confirm admin scores
        entered_by_team_id: null
      };

      await submitGame(gameData);
      
      // Reset form
      setScoreA(''); 
      setScoreB(''); 
      setHandsA(''); 
      setHandsB('');
      setBostonA('0'); 
      setBostonB('0');
      setSelectedMatch(null);
    } catch (error) {
      console.error('Error submitting score:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!activeTournament) {
    return (
      <div className="text-center p-8">
        <Trophy className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-600 mb-2">No Active Tournament</h3>
        <p className="text-gray-500">Please select an active tournament to enter scores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Admin Score Entry - {activeTournament.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label>Select Match</Label>
            <Select onValueChange={(value) => {
              const match = tournamentMatches.find(m => m.id === value);
              setSelectedMatch(match);
              // Reset form when selecting new match
              setScoreA(''); setScoreB(''); setHandsA(''); setHandsB('');
              setBostonA('0'); setBostonB('0');
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a match to score" />
              </SelectTrigger>
              <SelectContent>
                {tournamentMatches.map(match => {
                  const teamA = teams.find(t => t.id === match.teamA);
                  const teamB = teams.find(t => t.id === match.teamB);
                  return (
                    <SelectItem key={match.id} value={match.id}>
                      {teamA?.name} vs {teamB?.name} (Round {match.round})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {selectedMatch && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Team A Score</Label>
                  <Input
                    type="number"
                    value={scoreA}
                    onChange={(e) => setScoreA(e.target.value)}
                    placeholder="Enter score"
                  />
                </div>
                <div>
                  <Label>Team B Score</Label>
                  <Input
                    type="number"
                    value={scoreB}
                    onChange={(e) => setScoreB(e.target.value)}
                    placeholder="Enter score"
                  />
                </div>
              </div>

              {tracksHands && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Team A Hands</Label>
                    <Input
                      type="number"
                      value={handsA}
                      onChange={(e) => setHandsA(e.target.value)}
                      placeholder="Enter hands won"
                    />
                  </div>
                  <div>
                    <Label>Team B Hands</Label>
                    <Input
                      type="number"
                      value={handsB}
                      onChange={(e) => setHandsB(e.target.value)}
                      placeholder="Enter hands won"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Team A Boston</Label>
                  <Input
                    type="number"
                    value={bostonA}
                    onChange={(e) => setBostonA(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Team B Boston</Label>
                  <Input
                    type="number"
                    value={bostonB}
                    onChange={(e) => setBostonB(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={handleSubmitScore} 
                  disabled={!selectedMatch || !scoreA || !scoreB || isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Score'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSelectedMatch(null);
                    setScoreA(''); setScoreB(''); setHandsA(''); setHandsB('');
                    setBostonA('0'); setBostonB('0');
                  }}
                >
                  Clear
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Match Summary */}
      {selectedMatch && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Match Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-800">
                  {teams.find(t => t.id === selectedMatch.teamA)?.name}
                </h4>
                <p className="text-sm text-blue-600">Team A</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <h4 className="font-semibold text-red-800">
                  {teams.find(t => t.id === selectedMatch.teamB)?.name}
                </h4>
                <p className="text-sm text-red-600">Team B</p>
              </div>
            </div>
            <div className="text-center mt-4">
              <p className="text-sm text-gray-600">Round {selectedMatch.round}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminScoreEntry;
