import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppContext } from '@/contexts/AppContext';
import { Trophy, Users, Target } from 'lucide-react';

const AdminScoreEntry: React.FC = () => {
  const { schedules, games, teams, tournaments, submitGame, getActiveTournament } = useAppContext();
  const [matchScores, setMatchScores] = useState<{[key: string]: {
    scoreA: string;
    scoreB: string;
    handsA: string;
    handsB: string;
    bostonA: string;
    bostonB: string;
  }}>({});
  const [submittedMatches, setSubmittedMatches] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Quick entry state
  const [teamNumber, setTeamNumber] = useState('');
  const [teamScore, setTeamScore] = useState('');
  const [teamBoston, setTeamBoston] = useState('0');
  const [opponentScore, setOpponentScore] = useState('');
  const [opponentBoston, setOpponentBoston] = useState('0');
  
  const teamNumberRef = useRef<HTMLInputElement>(null);
  const teamScoreRef = useRef<HTMLInputElement>(null);
  const teamBostonRef = useRef<HTMLInputElement>(null);
  const opponentScoreRef = useRef<HTMLInputElement>(null);
  const opponentBostonRef = useRef<HTMLInputElement>(null);

  // Handle quick entry submission
  const handleQuickEntrySubmit = async () => {
    if (!teamNumber || !teamScore || !opponentScore) {
      return;
    }

    // Find match for this team number
    const match = tournamentMatches.find(m => {
      const teamA = teams.find(t => String(t.id) === String(m.teamA));
      const teamB = teams.find(t => String(t.id) === String(m.teamB));
      
      // Check if entered team number matches teamA or teamB
      const teamAMatches = teamA && (
        String(teamA.id) === String(teamNumber) || 
        String(teamA.teamNumber) === String(teamNumber)
      );
      const teamBMatches = teamB && (
        String(teamB.id) === String(teamNumber) || 
        String(teamB.teamNumber) === String(teamNumber)
      );
      
      return teamAMatches || teamBMatches;
    });

    if (!match) {
      // Reset form and focus on team number
      setTeamNumber('');
      setTeamScore('');
      setTeamBoston('0');
      setOpponentScore('');
      setOpponentBoston('0');
      teamNumberRef.current?.focus();
      return;
    }

    const teamA = teams.find(t => String(t.id) === String(match.teamA));
    const teamB = teams.find(t => String(t.id) === String(match.teamB));
    
    // Determine which team is the entered team and which is the opponent
    const isTeamA = teamA && (
      String(teamA.id) === String(teamNumber) || 
      String(teamA.teamNumber) === String(teamNumber)
    );
    
    const matchId = match.id;
    const scoreData = {
      scoreA: isTeamA ? teamScore : opponentScore,
      scoreB: isTeamA ? opponentScore : teamScore,
      bostonA: isTeamA ? teamBoston : opponentBoston,
      bostonB: isTeamA ? opponentBoston : teamBoston,
      handsA: '',
      handsB: ''
    };

    // Update match scores
    updateMatchScore(matchId, 'scoreA', scoreData.scoreA);
    updateMatchScore(matchId, 'scoreB', scoreData.scoreB);
    updateMatchScore(matchId, 'bostonA', scoreData.bostonA);
    updateMatchScore(matchId, 'bostonB', scoreData.bostonB);

    // Submit the score
    await handleSubmitScore(matchId);

    // Reset form and focus on team number for next entry
    setTeamNumber('');
    setTeamScore('');
    setTeamBoston('0');
    setOpponentScore('');
    setOpponentBoston('0');
    teamNumberRef.current?.focus();
  };

  // Handle tab navigation and enter key
  const handleTeamNumberKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (teamNumber) {
        teamScoreRef.current?.focus();
      }
    }
  };

  const handleTeamScoreKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      teamBostonRef.current?.focus();
    }
  };

  const handleTeamBostonKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      opponentScoreRef.current?.focus();
    }
  };

  const handleOpponentScoreKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      opponentBostonRef.current?.focus();
    }
  };

  const handleOpponentBostonKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await handleQuickEntrySubmit();
    }
  };

  const activeTournament = getActiveTournament();
  const tracksHands = activeTournament?.tracksHands !== false;

  // Get all matches for the active tournament
  const tournamentMatches = schedules
    .filter(s => s.tournamentId === activeTournament?.id)
    .flatMap(s => s.matches)
    .filter(match => match.teamA !== 'TBD' && match.teamB !== 'TBD');

  const handleSubmitScore = async (matchId: string) => {
    const scores = matchScores[matchId];
    if (!scores || !scores.scoreA || !scores.scoreB) return;
    
    if (tracksHands && (!scores.handsA || !scores.handsB)) return;
    
    const match = tournamentMatches.find(m => m.id === matchId);
    if (!match) return;
    
    const teamA = teams.find(t => t.id === match.teamA);
    const teamB = teams.find(t => t.id === match.teamB);
    
    if (!teamA || !teamB) return;

    setIsSubmitting(true);
    try {
      // Import supabase client
      const { supabase } = await import('../supabaseClient');
      
      // Create game record directly for admin scoring
      const gameRecord = {
        id: Date.now().toString(),
        matchId: matchId,
        teamA: teamA.id,
        teamB: teamB.id,
        scoreA: parseInt(scores.scoreA),
        scoreB: parseInt(scores.scoreB),
        handsA: parseInt(scores.handsA) || 0,
        handsB: parseInt(scores.handsB) || 0,
        boston_a: parseInt(scores.bostonA) || 0,
        boston_b: parseInt(scores.bostonB) || 0,
        winner: parseInt(scores.scoreA) > parseInt(scores.scoreB) ? 'teamA' : 'teamB',
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
        console.error('Error inserting admin score:', error);
        throw error;
      }
      
      // Mark as submitted and clear the form
      const newSubmittedMatches = new Set([...submittedMatches, matchId]);
      setSubmittedMatches(newSubmittedMatches);
      
      // Save to localStorage with tournament-specific key
      if (activeTournament) {
        const storageKey = `adminSubmittedMatches_${activeTournament.id}`;
        const dataToStore = [...newSubmittedMatches];
        console.log('Saving submitted matches for tournament:', activeTournament.id, 'matches:', dataToStore);
        localStorage.setItem(storageKey, JSON.stringify(dataToStore));
      }
      
      setMatchScores(prev => {
        const updated = { ...prev };
        delete updated[matchId];
        return updated;
      });
    } catch (error) {
      console.error('Error submitting score:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUndo = async (matchId: string) => {
    try {
      // Delete the score from the database
      const { supabase } = await import('../supabaseClient');
      const { error } = await supabase
        .from('games')
        .delete()
        .eq('matchId', matchId)
        .eq('submittedBy', 'admin');

      if (error) {
        console.error('Error deleting score from database:', error);
        return;
      }

      // Remove from submitted matches
      const updated = new Set(submittedMatches);
      updated.delete(matchId);
      setSubmittedMatches(updated);
      
      // Save to localStorage with tournament-specific key
      if (activeTournament) {
        const storageKey = `adminSubmittedMatches_${activeTournament.id}`;
        localStorage.setItem(storageKey, JSON.stringify([...updated]));
      }
    } catch (error) {
      console.error('Error undoing score:', error);
    }
  };

  const updateMatchScore = (matchId: string, field: string, value: string) => {
    setMatchScores(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [field]: value
      }
    }));
  };

  // Load submitted matches when tournament changes
  React.useEffect(() => {
    if (activeTournament) {
      try {
        const storageKey = `adminSubmittedMatches_${activeTournament.id}`;
        const stored = localStorage.getItem(storageKey);
        console.log('Loading submitted matches for tournament:', activeTournament.id, 'stored:', stored);
        if (stored) {
          const parsed = JSON.parse(stored);
          console.log('Parsed submitted matches:', parsed);
          setSubmittedMatches(new Set(parsed));
        } else {
          console.log('No stored submitted matches found');
          setSubmittedMatches(new Set());
        }
      } catch (error) {
        console.error('Error loading submitted matches:', error);
        setSubmittedMatches(new Set());
      }
    }
  }, [activeTournament?.id]);

  if (!activeTournament) {
    return (
      <div className="text-center p-8">
        <Trophy className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-600 mb-2">No Active Tournament</h3>
        <p className="text-gray-500">Please select an active tournament to enter scores.</p>
      </div>
    );
  }

  // Group matches by round
  const matchesByRound = tournamentMatches.reduce((acc, match) => {
    const round = match.round;
    if (!acc[round]) {
      acc[round] = [];
    }
    acc[round].push(match);
    return acc;
  }, {} as {[key: number]: any[]});

  // Sort rounds
  const sortedRounds = Object.keys(matchesByRound).map(Number).sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Trophy className="h-8 w-8 mx-auto text-blue-600 mb-2" />
        <h2 className="text-xl font-bold text-gray-800 mb-1">Admin Score Entry</h2>
        <p className="text-sm text-gray-600">{activeTournament.name}</p>
      </div>

      {/* Quick Entry Form */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg">Quick Entry</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4">
            <div>
              <Label htmlFor="quick-team-number">Team #</Label>
              <Input
                ref={teamNumberRef}
                id="quick-team-number"
                type="text"
                value={teamNumber}
                onChange={(e) => setTeamNumber(e.target.value)}
                onKeyDown={handleTeamNumberKeyDown}
                placeholder="101"
                className="text-center font-semibold"
              />
            </div>
            <div>
              <Label htmlFor="quick-team-score">Team Points</Label>
              <Input
                ref={teamScoreRef}
                id="quick-team-score"
                type="number"
                value={teamScore}
                onChange={(e) => setTeamScore(e.target.value)}
                onKeyDown={handleTeamScoreKeyDown}
                placeholder="20"
                className="text-center"
                min="0"
              />
            </div>
            <div>
              <Label htmlFor="quick-team-boston">Team Bostons</Label>
              <Input
                ref={teamBostonRef}
                id="quick-team-boston"
                type="number"
                value={teamBoston}
                onChange={(e) => setTeamBoston(e.target.value)}
                onKeyDown={handleTeamBostonKeyDown}
                placeholder="0"
                className="text-center"
                min="0"
              />
            </div>
            <div>
              <Label htmlFor="quick-opponent-score">Opponent Points</Label>
              <Input
                ref={opponentScoreRef}
                id="quick-opponent-score"
                type="number"
                value={opponentScore}
                onChange={(e) => setOpponentScore(e.target.value)}
                onKeyDown={handleOpponentScoreKeyDown}
                placeholder="10"
                className="text-center"
                min="0"
              />
            </div>
            <div>
              <Label htmlFor="quick-opponent-boston">Opponent Bostons</Label>
              <Input
                ref={opponentBostonRef}
                id="quick-opponent-boston"
                type="number"
                value={opponentBoston}
                onChange={(e) => setOpponentBoston(e.target.value)}
                onKeyDown={handleOpponentBostonKeyDown}
                placeholder="0"
                className="text-center"
                min="0"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-center">
            <Button
              onClick={handleQuickEntrySubmit}
              disabled={!teamNumber || !teamScore || !opponentScore || isSubmitting}
              className="w-full max-w-md"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Score'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {sortedRounds.map((round) => (
          <div key={round} className="space-y-3">
            <div className="bg-blue-100 text-blue-800 px-3 py-2 rounded-md font-semibold text-sm">
              Round {round}
            </div>
            
            <div className="grid gap-3">
              {matchesByRound[round].map((match) => {
                const teamA = teams.find(t => t.id === match.teamA);
                const teamB = teams.find(t => t.id === match.teamB);
                const isSubmitted = submittedMatches.has(match.id);
                const scores = matchScores[match.id] || {
                  scoreA: '',
                  scoreB: '',
                  handsA: '',
                  handsB: '',
                  bostonA: '0',
                  bostonB: '0'
                };

                if (isSubmitted) {
                  return (
                    <div key={match.id} className="bg-green-50 border border-green-200 rounded-md p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Trophy className="h-4 w-4 text-green-600" />
                          <div className="text-sm">
                            <span className="font-medium text-green-800 text-sm">
                              Team {teamA?.id} <span className="text-xs">{teamA?.player1FirstName}/{teamA?.player2FirstName}</span> vs Team {teamB?.id} <span className="text-xs">{teamB?.player1FirstName}/{teamB?.player2FirstName}</span>
                            </span>
                            <span className="text-green-600 ml-2">✓ Submitted</span>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleUndo(match.id)}
                          className="text-red-600 border-red-300 hover:bg-red-50 text-xs px-2 py-1"
                        >
                          Undo
                        </Button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={match.id} className="border border-gray-200 rounded-md p-3 bg-white">
                    <div className="flex items-center gap-4">
                      {/* Team A */}
                      <div className="flex items-center gap-2 flex-1">
                        <div className="text-sm font-medium min-w-0">
                          Team {teamA?.id} <span className="text-xs">{teamA?.player1FirstName}/{teamA?.player2FirstName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500">Score</span>
                          <Input
                            type="number"
                            value={scores.scoreA}
                            onChange={(e) => updateMatchScore(match.id, 'scoreA', e.target.value)}
                            placeholder="0"
                            className="h-8 w-20 text-sm"
                            min="0"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500">Boston</span>
                          <Input
                            type="number"
                            value={scores.bostonA}
                            onChange={(e) => updateMatchScore(match.id, 'bostonA', e.target.value)}
                            placeholder="0"
                            className="h-8 w-20 text-sm"
                            min="0"
                          />
                        </div>
                      </div>

                      {/* VS */}
                      <div className="text-gray-500 font-medium">vs</div>

                      {/* Team B */}
                      <div className="flex items-center gap-2 flex-1">
                        <div className="text-sm font-medium min-w-0">
                          Team {teamB?.id} <span className="text-xs">{teamB?.player1FirstName}/{teamB?.player2FirstName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500">Score</span>
                          <Input
                            type="number"
                            value={scores.scoreB}
                            onChange={(e) => updateMatchScore(match.id, 'scoreB', e.target.value)}
                            placeholder="0"
                            className="h-8 w-20 text-sm"
                            min="0"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500">Boston</span>
                          <Input
                            type="number"
                            value={scores.bostonB}
                            onChange={(e) => updateMatchScore(match.id, 'bostonB', e.target.value)}
                            placeholder="0"
                            className="h-8 w-20 text-sm"
                            min="0"
                          />
                        </div>
                      </div>

                      {/* Submit button */}
                      <Button 
                        onClick={() => handleSubmitScore(match.id)}
                        disabled={isSubmitting || !scores.scoreA || !scores.scoreB}
                        size="sm"
                        className="h-8 px-4 text-xs"
                      >
                        {isSubmitting ? '...' : 'Submit'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminScoreEntry;
