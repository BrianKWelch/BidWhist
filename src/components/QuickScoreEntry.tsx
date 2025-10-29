import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Trophy, Clock, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const QuickScoreEntry: React.FC = () => {
  const { schedules, games, teams, tournaments, getActiveTournament } = useAppContext();
  const [teamNumber, setTeamNumber] = useState('');
  const [score, setScore] = useState('');
  const [boston, setBoston] = useState('0');
  const [currentRound, setCurrentRound] = useState(1);
  const [pendingScores, setPendingScores] = useState<{[teamId: string]: {score: number, boston: number}}>({});
  const [completedMatches, setCompletedMatches] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const teamInputRef = useRef<HTMLInputElement>(null);
  const scoreInputRef = useRef<HTMLInputElement>(null);
  const bostonInputRef = useRef<HTMLInputElement>(null);

  const activeTournament = getActiveTournament();
  const tracksHands = activeTournament?.tracksHands;

  // Load completed matches when tournament changes
  useEffect(() => {
    if (activeTournament) {
      try {
        const storageKey = `quickCompletedMatches_${activeTournament.id}_${currentRound}`;
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          setCompletedMatches(new Set(JSON.parse(stored)));
        } else {
          setCompletedMatches(new Set());
        }
      } catch (error) {
        console.error('Error loading completed matches:', error);
        setCompletedMatches(new Set());
      }
    }
  }, [activeTournament?.id, currentRound]);

  const tournamentMatches = React.useMemo(() => {
    if (!activeTournament || !schedules) return [];

    const activeSchedule = schedules.find(s => s.tournamentId === activeTournament.id);
    if (!activeSchedule) return [];

    return activeSchedule.matches
      .filter(match => match.round === currentRound)
      .sort((a, b) => a.matchNumber - b.matchNumber);
  }, [activeTournament, schedules, currentRound]);

  const getTeamByNumber = (teamNum: string) => {
    return teams.find(team => team.id === teamNum);
  };

  const findMatchForTeam = (teamId: string) => {
    return tournamentMatches.find(match => 
      match.teamA === teamId || match.teamB === teamId
    );
  };

  const handleTeamNumberChange = (value: string) => {
    setTeamNumber(value);
    if (value && getTeamByNumber(value)) {
      // Auto-focus score input when valid team is entered
      setTimeout(() => scoreInputRef.current?.focus(), 100);
    }
  };

  const handleScoreChange = (value: string) => {
    setScore(value);
    // Remove auto-focus - let user control tab navigation
  };

  const handleBostonChange = (value: string) => {
    setBoston(value);
  };

  const handleSubmit = async () => {
    if (!teamNumber || !score) {
      toast.error('Please enter team number and score');
      return;
    }

    const team = getTeamByNumber(teamNumber);
    if (!team) {
      toast.error('Team not found');
      return;
    }

    const match = findMatchForTeam(team.id);
    if (!match) {
      toast.error('No match found for this team in current round');
      return;
    }

    const scoreNum = parseInt(score);
    const bostonNum = parseInt(boston) || 0;

    // Check if this is the second team in the match
    const opponentId = match.teamA === team.id ? match.teamB : match.teamA;
    const opponentScore = pendingScores[opponentId];

    if (opponentScore) {
      // Both teams have scores - complete the match
      await completeMatch(match, team.id, scoreNum, bostonNum, opponentId, opponentScore.score, opponentScore.boston);
    } else {
      // First team - store pending score
      setPendingScores(prev => ({
        ...prev,
        [team.id]: { score: scoreNum, boston: bostonNum }
      }));
      toast.success(`Score recorded for Team ${team.id}. Waiting for opponent...`);
    }

    // Clear form and focus team input
    setTeamNumber('');
    setScore('');
    setBoston('0');
    teamInputRef.current?.focus();
  };

  const completeMatch = async (match: any, teamAId: string, scoreA: number, bostonA: number, teamBId: string, scoreB: number, bostonB: number) => {
    setIsSubmitting(true);
    try {
      const { supabase } = await import('../supabaseClient');
      
      const gameRecord = {
        id: Date.now().toString(),
        matchId: match.id,
        teamA: teamAId,
        teamB: teamBId,
        scoreA: scoreA,
        scoreB: scoreB,
        handsA: 0, // Default for now
        handsB: 0, // Default for now
        boston_a: bostonA,
        boston_b: bostonB,
        winner: scoreA > scoreB ? 'teamA' : 'teamB',
        submittedBy: 'admin',
        status: 'confirmed',
        entered_by_team_id: null,
        confirmed: true,
        confirmedBy: 'admin',
        round: match.round,
        timestamp: new Date().toISOString()
      };

      const { error } = await supabase
        .from('games')
        .insert([gameRecord]);

      if (error) {
        console.error('Error inserting quick score:', error);
        toast.error('Error submitting score: ' + error.message);
      } else {
        toast.success('Match completed successfully!');
        
        // Mark match as completed
        const newCompleted = new Set([...completedMatches, match.id]);
        setCompletedMatches(newCompleted);
        
        // Save to localStorage
        if (activeTournament) {
          const storageKey = `quickCompletedMatches_${activeTournament.id}_${currentRound}`;
          localStorage.setItem(storageKey, JSON.stringify([...newCompleted]));
        }
        
        // Remove from pending scores
        setPendingScores(prev => {
          const updated = { ...prev };
          delete updated[teamAId];
          delete updated[teamBId];
          return updated;
        });
      }
    } catch (error: any) {
      console.error('Error completing match:', error);
      toast.error('Error completing match: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUndo = async (matchId: string) => {
    try {
      const { supabase } = await import('../supabaseClient');
      const { error } = await supabase
        .from('games')
        .delete()
        .eq('matchId', matchId)
        .eq('submittedBy', 'admin');

      if (error) {
        console.error('Error deleting score from database:', error);
        toast.error('Error undoing score: ' + error.message);
        return;
      }

      // Remove from completed matches
      const updated = new Set(completedMatches);
      updated.delete(matchId);
      setCompletedMatches(updated);

      // Save to localStorage
      if (activeTournament) {
        const storageKey = `quickCompletedMatches_${activeTournament.id}_${currentRound}`;
        localStorage.setItem(storageKey, JSON.stringify([...updated]));
      }

      toast.success('Score successfully undone!');
    } catch (error: any) {
      console.error('Error undoing score:', error);
      toast.error('Error undoing score: ' + error.message);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  if (!activeTournament) {
    return (
      <div className="p-6 text-center text-gray-500">
        Please select an active tournament to enter scores.
      </div>
    );
  }

  const totalMatches = tournamentMatches.length;
  const completedCount = completedMatches.size;
  const pendingCount = Object.keys(pendingScores).length;

  return (
    <div className="space-y-6 p-4">
      <div className="text-center mb-6">
        <Trophy className="h-12 w-12 mx-auto text-blue-600 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Quick Score Entry</h2>
        <p className="text-gray-600">Enter team number, score, and boston for fast data entry</p>
      </div>

      {/* Round Selector */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <Button
          variant="outline"
          onClick={() => setCurrentRound(Math.max(1, currentRound - 1))}
          disabled={currentRound <= 1}
        >
          ← Previous Round
        </Button>
        <div className="text-lg font-semibold">Round {currentRound}</div>
        <Button
          variant="outline"
          onClick={() => setCurrentRound(currentRound + 1)}
        >
          Next Round →
        </Button>
      </div>

      {/* Progress */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium">Round {currentRound} Progress</span>
          <span className="text-sm text-gray-600">{completedCount} of {totalMatches} matches completed</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${totalMatches > 0 ? (completedCount / totalMatches) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Entry Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-center">Enter Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Team Number</label>
              <Input
                ref={teamInputRef}
                type="text"
                value={teamNumber}
                onChange={(e) => handleTeamNumberChange(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter team number"
                className="text-center"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Score</label>
              <Input
                ref={scoreInputRef}
                type="number"
                value={score}
                onChange={(e) => handleScoreChange(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="0"
                className="text-center"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Boston</label>
              <Input
                ref={bostonInputRef}
                type="number"
                value={boston}
                onChange={(e) => handleBostonChange(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="0"
                className="text-center"
                min="0"
              />
            </div>
          </div>
          <div className="text-center mt-4">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !teamNumber || !score}
              className="w-full"
            >
              {isSubmitting ? 'Submitting...' : 'Enter Score'}
            </Button>
          </div>
        </CardContent>
      </Card>


      {/* All Matches - Color Coded by Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-blue-600" />
            Round {currentRound} Matches ({completedCount}/{totalMatches} completed)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {tournamentMatches.map(match => {
              const teamA = getTeamByNumber(match.teamA);
              const teamB = getTeamByNumber(match.teamB);
              const isCompleted = completedMatches.has(match.id);
              const teamAPending = pendingScores[match.teamA];
              const teamBPending = pendingScores[match.teamB];
              const hasPending = teamAPending || teamBPending;
              
              let bgColor = 'bg-white border-gray-200'; // Default white
              let statusText = '';
              
              if (isCompleted) {
                bgColor = 'bg-green-50 border-green-200';
                statusText = '✓ Completed';
              } else if (hasPending) {
                bgColor = 'bg-yellow-50 border-yellow-200';
                statusText = '⏳ Waiting for opponent';
              } else {
                bgColor = 'bg-white border-gray-200';
                statusText = '⏸️ Not started';
              }
              
              return (
                <div key={match.id} className={`flex items-center justify-between p-3 rounded border ${bgColor}`}>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm">
                      Team {match.teamA} {teamA?.player1FirstName}/{teamA?.player2FirstName}
                    </span>
                    <span className="text-gray-500">vs</span>
                    <span className="font-medium text-sm">
                      Team {match.teamB} {teamB?.player1FirstName}/{teamB?.player2FirstName}
                    </span>
                    <span className="text-xs text-gray-600 ml-2">{statusText}</span>
                  </div>
                  
                  {isCompleted ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUndo(match.id)}
                      className="text-red-600 hover:bg-red-50"
                    >
                      Undo
                    </Button>
                  ) : (
                    <div className="text-xs text-gray-500">
                      {teamAPending && `Team ${match.teamA}: ${teamAPending.score}`}
                      {teamBPending && `Team ${match.teamB}: ${teamBPending.score}`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QuickScoreEntry;
