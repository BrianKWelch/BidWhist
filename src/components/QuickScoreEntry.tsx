import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Trophy, Clock, CheckCircle, Search } from 'lucide-react';
import { toast } from 'sonner';

const QuickScoreEntry: React.FC = () => {
  const { schedules, games, teams, tournaments, getActiveTournament } = useAppContext();
  const [teamNumber, setTeamNumber] = useState('');
  const [teamScore, setTeamScore] = useState('');
  const [teamBoston, setTeamBoston] = useState('');
  const [opponentScore, setOpponentScore] = useState('');
  const [opponentBoston, setOpponentBoston] = useState('');
  const [currentRound, setCurrentRound] = useState(1);
  const [pendingScores, setPendingScores] = useState<{[teamId: string]: {score: number, boston: number}}>({});
  const [completedMatches, setCompletedMatches] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Verification state
  const [verificationRound, setVerificationRound] = useState(1);
  const [verificationTeamNumber, setVerificationTeamNumber] = useState('');
  
  const teamNumberRef = useRef<HTMLInputElement>(null);
  const teamScoreRef = useRef<HTMLInputElement>(null);
  const teamBostonRef = useRef<HTMLInputElement>(null);
  const opponentScoreRef = useRef<HTMLInputElement>(null);
  const opponentBostonRef = useRef<HTMLInputElement>(null);
  const verificationTeamRef = useRef<HTMLInputElement>(null);

  const activeTournament = getActiveTournament();
  const tracksHands = activeTournament?.tracksHands;

  // Calculate the current round based on incomplete matches
  const calculateCurrentRound = React.useMemo(() => {
    if (!activeTournament || !schedules || !games) return 1;

    const activeSchedule = schedules.find(s => s.tournamentId === activeTournament.id);
    if (!activeSchedule || !activeSchedule.matches || activeSchedule.matches.length === 0) return 1;

    // Get all unique rounds from the schedule
    const allRounds = [...new Set(activeSchedule.matches.map(m => m.round))].sort((a, b) => a - b);
    if (allRounds.length === 0) return 1;

    // Find the lowest round with incomplete matches (the current round to work on)
    let currentRoundNum = null;
    for (const round of allRounds) {
      const roundMatches = activeSchedule.matches.filter(m => m.round === round && !m.isBye);
      
      if (roundMatches.length === 0) continue;
      
      // Check if any matches in this round are incomplete
      const hasIncomplete = roundMatches.some(match => {
        const completed = games.some(g => 
          g.matchId === match.id && g.confirmed
        );
        return !completed;
      });

      if (hasIncomplete) {
        currentRoundNum = round;
        break;
      }
    }

    // If all rounds are complete, default to the highest round
    // Otherwise, default to the first incomplete round (current round)
    return currentRoundNum ?? (allRounds.length > 0 ? Math.max(...allRounds) : 1);
  }, [activeTournament?.id, schedules, games]);

  // Set current round when tournament, schedule, or games change
  useEffect(() => {
    setCurrentRound(calculateCurrentRound);
    setVerificationRound(calculateCurrentRound);
  }, [calculateCurrentRound]);

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

  // Get matches for verification round
  const verificationRoundMatches = React.useMemo(() => {
    if (!activeTournament || !schedules) return [];
    const activeSchedule = schedules.find(s => s.tournamentId === activeTournament.id);
    if (!activeSchedule) return [];
    return activeSchedule.matches.filter(m => m.round === verificationRound);
  }, [activeTournament, schedules, verificationRound]);

  const getTeamByNumber = (teamNum: string) => {
    return teams.find(team => team.id === teamNum);
  };

  const findMatchForTeam = (teamId: string) => {
    return tournamentMatches.find(match => 
      match.teamA === teamId || match.teamB === teamId
    );
  };

  // Handle quick entry submission with both teams' scores
  const handleQuickEntrySubmit = async () => {
    if (!teamNumber || !teamScore || !opponentScore) {
      toast.error('Please enter team number, team points, and opponent points');
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

    const teamScoreNum = parseInt(teamScore);
    const teamBostonNum = parseInt(teamBoston) || 0;
    const opponentScoreNum = parseInt(opponentScore);
    const opponentBostonNum = parseInt(opponentBoston) || 0;

    // Determine which team is the entered team and which is the opponent
    const isTeamA = match.teamA === team.id;
    const opponentId = isTeamA ? match.teamB : match.teamA;

    // Complete the match immediately with both scores
    await completeMatch(
      match,
      isTeamA ? team.id : opponentId,
      isTeamA ? teamScoreNum : opponentScoreNum,
      isTeamA ? teamBostonNum : opponentBostonNum,
      isTeamA ? opponentId : team.id,
      isTeamA ? opponentScoreNum : teamScoreNum,
      isTeamA ? opponentBostonNum : teamBostonNum
    );

    // Clear form and focus team number for next entry
    setTeamNumber('');
    setTeamScore('');
    setTeamBoston('');
    setOpponentScore('');
    setOpponentBoston('');
    teamNumberRef.current?.focus();
  };

  // Handle enter key navigation (Enter moves to next field, last field submits)
  const handleTeamNumberKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (teamNumber) {
        teamScoreRef.current?.focus();
      }
    }
  };

  const handleTeamScoreKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (teamScore) {
        teamBostonRef.current?.focus();
      }
    }
  };

  const handleTeamBostonKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      opponentScoreRef.current?.focus();
    }
  };

  const handleOpponentScoreKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (opponentScore) {
        opponentBostonRef.current?.focus();
      }
    }
  };

  const handleOpponentBostonKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await handleQuickEntrySubmit();
    }
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

      {/* Quick Entry Form */}
      <Card className="mb-6 bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-center">Quick Entry</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Team #</label>
              <Input
                ref={teamNumberRef}
                type="text"
                value={teamNumber}
                onChange={(e) => setTeamNumber(e.target.value)}
                onKeyDown={handleTeamNumberKeyDown}
                placeholder=""
                className="text-center font-semibold"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Team Points</label>
              <Input
                ref={teamScoreRef}
                type="number"
                value={teamScore}
                onChange={(e) => setTeamScore(e.target.value)}
                onKeyDown={handleTeamScoreKeyDown}
                placeholder=""
                className="text-center"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Team Bostons</label>
              <Input
                ref={teamBostonRef}
                type="number"
                value={teamBoston}
                onChange={(e) => setTeamBoston(e.target.value)}
                onKeyDown={handleTeamBostonKeyDown}
                placeholder=""
                className="text-center"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Opponent Points</label>
              <Input
                ref={opponentScoreRef}
                type="number"
                value={opponentScore}
                onChange={(e) => setOpponentScore(e.target.value)}
                onKeyDown={handleOpponentScoreKeyDown}
                placeholder=""
                className="text-center"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Opponent Bostons</label>
              <Input
                ref={opponentBostonRef}
                type="number"
                value={opponentBoston}
                onChange={(e) => setOpponentBoston(e.target.value)}
                onKeyDown={handleOpponentBostonKeyDown}
                placeholder=""
                className="text-center"
                min="0"
              />
            </div>
          </div>
          <div className="text-center mt-4">
            <Button
              onClick={handleQuickEntrySubmit}
              disabled={isSubmitting || !teamNumber || !teamScore || !opponentScore}
              className="w-full max-w-md"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Score'}
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
              
              // Find the completed game for this match
              const completedGame = games.find(g => 
                g.matchId === match.id && g.confirmed
              );
              
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
              
              // Determine winner if game is completed
              const isTeamAWinner = completedGame && completedGame.scoreA > completedGame.scoreB;
              const isTeamBWinner = completedGame && completedGame.scoreB > completedGame.scoreA;
              const isTie = completedGame && completedGame.scoreA === completedGame.scoreB;

              return (
                <div key={match.id} className={`flex items-center justify-between p-3 rounded border ${bgColor}`}>
                  <div className="flex items-center gap-3">
                    {match.table && (
                      <span className="font-semibold text-sm text-blue-600 min-w-[60px]">
                        Table {match.table}
                      </span>
                    )}
                    <span className={`text-sm ${isTeamAWinner ? 'font-bold text-green-700' : isTeamBWinner ? 'font-medium text-gray-600' : 'font-medium'}`}>
                      Team {match.teamA} {teamA?.player1FirstName}/{teamA?.player2FirstName}
                    </span>
                    {completedGame && (
                      <span className={`font-bold text-sm ${isTeamAWinner ? 'text-green-700' : isTeamBWinner ? 'text-red-600' : 'text-green-700'}`}>
                        {completedGame.scoreA}
                      </span>
                    )}
                    <span className="text-gray-500">vs</span>
                    {completedGame && (
                      <span className={`font-bold text-sm ${isTeamBWinner ? 'text-green-700' : isTeamAWinner ? 'text-red-600' : 'text-green-700'}`}>
                        {completedGame.scoreB}
                      </span>
                    )}
                    <span className={`text-sm ${isTeamBWinner ? 'font-bold text-green-700' : isTeamAWinner ? 'font-medium text-gray-600' : 'font-medium'}`}>
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

      {/* Score Verification Card */}
      <Card className="mb-6 bg-green-50 border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-green-600" />
            Score Verification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="verify-round">Round</Label>
              <Input
                id="verify-round"
                type="number"
                value={verificationRound}
                onChange={(e) => setVerificationRound(parseInt(e.target.value) || 1)}
                min="1"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="verify-team">Team #</Label>
              <Input
                ref={verificationTeamRef}
                id="verify-team"
                type="text"
                value={verificationTeamNumber}
                onChange={(e) => setVerificationTeamNumber(e.target.value)}
                placeholder="Enter team number"
                className="mt-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    // Keep focus on input to allow quick entry of next team
                    setTimeout(() => {
                      setVerificationTeamNumber('');
                      verificationTeamRef.current?.focus();
                    }, 500);
                  }
                }}
              />
            </div>
          </div>
          
          {verificationTeamNumber && (() => {
            const verifyTeam = getTeamByNumber(verificationTeamNumber);
            if (!verifyTeam) {
              return (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">
                  Team {verificationTeamNumber} not found
                </div>
              );
            }

            // Find match for this team in the verification round
            const verifyMatch = verificationRoundMatches.find(m => 
              m.teamA === verifyTeam.id || m.teamB === verifyTeam.id
            );

            if (!verifyMatch) {
              return (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-700">
                  Team {verificationTeamNumber} ({verifyTeam.player1FirstName}/{verifyTeam.player2FirstName}) has no match in Round {verificationRound}
                </div>
              );
            }

            // Find the completed game
            const verifyGame = games.find(g => 
              g.matchId === verifyMatch.id && g.confirmed
            );

            if (!verifyGame) {
              return (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-700">
                  No score recorded for Team {verificationTeamNumber} in Round {verificationRound}
                </div>
              );
            }

            const isTeamA = verifyMatch.teamA === verifyTeam.id;
            const opponent = teams.find(t => t.id === (isTeamA ? verifyMatch.teamB : verifyMatch.teamA));
            const teamScore = isTeamA ? verifyGame.scoreA : verifyGame.scoreB;
            const teamBostons = isTeamA ? verifyGame.boston_a : verifyGame.boston_b;
            const opponentScore = isTeamA ? verifyGame.scoreB : verifyGame.scoreA;
            const opponentBostons = isTeamA ? verifyGame.boston_b : verifyGame.boston_a;

            return (
              <div className="mt-4 p-4 bg-white border border-green-300 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-semibold text-sm text-gray-700 mb-2">
                      Team {verificationTeamNumber} ({verifyTeam.player1FirstName}/{verifyTeam.player2FirstName})
                    </div>
                    <div className="space-y-1">
                      <div className="text-lg">
                        <span className="font-bold text-green-700">{teamScore}</span> points
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-semibold">{teamBostons}</span> bostons
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-gray-700 mb-2">
                      Opponent: Team {opponent?.id} ({opponent?.player1FirstName}/{opponent?.player2FirstName})
                    </div>
                    <div className="space-y-1">
                      <div className="text-lg">
                        <span className="font-bold text-red-700">{opponentScore}</span> points
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-semibold">{opponentBostons}</span> bostons
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
};

export default QuickScoreEntry;
