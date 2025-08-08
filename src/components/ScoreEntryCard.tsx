import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAppContext } from '@/contexts/AppContext';
import { toast } from '@/hooks/use-toast';
import { Trophy, Check, Clock, AlertTriangle } from 'lucide-react';
import type { Team } from '@/contexts/AppContext';

interface ScoreEntryCardProps {
  team: Team;
}

const ScoreEntryCard = ({ team }: ScoreEntryCardProps) => {
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [handsA, setHandsA] = useState('');
  const [handsB, setHandsB] = useState('');
  const [bostonA, setBostonA] = useState('0');
  const [bostonB, setBostonB] = useState('0');
  const [currentStep, setCurrentStep] = useState(0);
  const [tieWinner, setTieWinner] = useState<'teamA' | 'teamB' | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [enteringTeamId, setEnteringTeamId] = useState<string | null>(null);
  const { schedules, games, tournaments, teams, submitGame, confirmScore, beginScoreEntry, scoreSubmissions, getActiveTournament, refreshGamesFromSupabase } = useAppContext();

  const getActiveMatches = React.useMemo(() => {
    const activeTournament = getActiveTournament && getActiveTournament();
    if (!activeTournament) return [];
    const schedule = schedules.find(s => s.tournamentId === activeTournament.id);
    if (!schedule) return [];
    const activeMatches: any[] = [];
    const teamMatches = schedule.matches.filter(match => {
      return (String(match.teamA) === String(team.id) || String(match.teamB) === String(team.id)) && !match.isBye;
    });
    teamMatches.sort((a, b) => a.round - b.round);
    for (const match of teamMatches) {
      const existingGame = games.find(g => String(g.matchId) === String(match.id) && g.confirmed);
      if (existingGame) continue;
      if (match.teamA !== 'TBD' && match.teamB !== 'TBD') {
        const tournament = activeTournament;
        const opponentId = String(match.teamA) === String(team.id) ? match.teamB : match.teamA;
        const opponentTeam = teams.find(t => String(t.id) === String(opponentId));
        const existingGame = games.find(g => String(g.matchId) === String(match.id));
        let status = 'Ready to Score';
        let statusMessage = '';
        
        if (existingGame) {
          if (existingGame.status === 'pending_confirmation') {
            if (String(existingGame.entered_by_team_id) === String(team.id)) {
              status = 'Waiting for opponent confirmation';
              statusMessage = 'Your score has been entered. Waiting for opponent to confirm.';
            } else {
              status = 'Pending confirmation';
              statusMessage = 'Review and confirm the score entered by your opponent.';
            }
          } else if (existingGame.status === 'confirmed') {
            status = 'Game completed';
            statusMessage = 'This game has been completed and confirmed.';
          }
        } else if (enteringTeamId && String(enteringTeamId) === String(team.id)) {
          // This team is currently entering a score
          status = 'Entering score';
          statusMessage = 'You are currently entering the score.';
        } else if (enteringTeamId && (String(match.teamA) === String(enteringTeamId) || String(match.teamB) === String(enteringTeamId))) {
          // The other team is entering a score for this match
          status = 'Opponent entering score';
          statusMessage = `Team ${enteringTeamId} is entering the score. Please wait.`;
        }
        activeMatches.push({ 
          ...match, 
          tournamentName: tournament?.name || 'Unknown Tournament',
          opponentId,
          opponentTeam,
          gameId: existingGame?.id,
          status,
          statusMessage
        });
        break;
      }
      if (match.teamA === 'TBD' || match.teamB === 'TBD') {
        const tournament = activeTournament;
        activeMatches.push({ 
          ...match, 
          tournamentName: tournament?.name || 'Unknown Tournament',
          opponentId: 'TBD',
          opponentTeam: null,
          mySubmission: null,
          opponentSubmission: null,
          status: 'Waiting for opponent',
          statusMessage: `Waiting for Round ${match.round - 1} to complete`
        });
        break;
      }
    }
    return activeMatches;
  }, [schedules, games, scoreSubmissions, tournaments, teams, team.id, refreshKey, getActiveTournament, enteringTeamId]);

  const handleSubmitScore = () => {
    if (!selectedMatch || !scoreA || !scoreB) return;
    
    // Check if tournament tracks hands
    const activeTournament = getActiveTournament && getActiveTournament();
    const tracksHands = activeTournament?.tracksHands !== false; // Default to true if not specified
    
    if (tracksHands && (!handsA || !handsB)) return;
    
    // Check for tie and require winner designation
    const teamAScore = String(selectedMatch.teamA) === String(team.id) ? parseInt(scoreA) : parseInt(scoreB);
    const teamBScore = String(selectedMatch.teamA) === String(team.id) ? parseInt(scoreB) : parseInt(scoreA);
    
    if (teamAScore === teamBScore && !tieWinner) return;
    
    // Ensure Boston values are valid numbers
    const bostonAValue = parseInt(bostonA) || 0;
    const bostonBValue = parseInt(bostonB) || 0;
    
    const toNum = (v: string) => v.trim() === '' ? 0 : Number(v);
    const teamAHands = String(selectedMatch.teamA) === String(team.id) ? toNum(handsA) : toNum(handsB);
    const teamBHands = String(selectedMatch.teamA) === String(team.id) ? toNum(handsB) : toNum(handsA);

    const teamA = teams.find(t => String(t.id) === String(selectedMatch.teamA));
    const teamB = teams.find(t => String(t.id) === String(selectedMatch.teamB));
    if (!teamA || !teamB) return;

    const gameData = {
      teamA: teamA.id, // Use the team ID
      teamB: teamB.id, // Use the team ID
      scoreA: teamAScore,
      scoreB: teamBScore,
      handsA: teamAHands,
      handsB: teamBHands,
             boston_a: bostonAValue,
       boston_b: bostonBValue,
      winner: (teamAScore > teamBScore ? 'teamA' : teamAScore < teamBScore ? 'teamB' : tieWinner!) as 'teamA' | 'teamB',
      matchId: selectedMatch.id,
      round: selectedMatch.round,
      submittedBy: team.id,
      status: 'pending_confirmation',
      entered_by_team_id: team.id
    };

    console.log('Calling submitGame with data:', gameData);
    submitGame(gameData);
    setSelectedMatch(null);
    setScoreA('');
    setScoreB('');
    setHandsA('');
    setHandsB('');
    setBostonA('0');
    setBostonB('0');
    setTieWinner(null);
    setEnteringTeamId(null);
    setRefreshKey(prev => prev + 1);
  };



  // Reset form when match selection changes or when score submissions change
  React.useEffect(() => {
    if (!selectedMatch) {
      setScoreA('');
      setScoreB('');
      setHandsA('');
      setHandsB('');
      setBostonA('0');
      setBostonB('0');
      setTieWinner(null);
      setEnteringTeamId(null);
    }
  }, [selectedMatch, scoreSubmissions]);

  // Real-time updates - poll for changes every 3 seconds
  React.useEffect(() => {
    const interval = setInterval(() => {
      refreshGamesFromSupabase();
    }, 3000);

    return () => clearInterval(interval);
  }, [refreshGamesFromSupabase]);


  const activeMatches = getActiveMatches;
  const currentRound = activeMatches.length > 0 ? activeMatches[0].round : 1;

  const activeTournament = getActiveTournament && getActiveTournament();
  const tracksHands = activeTournament?.tracksHands !== false; // Default to true if not specified

  // Function to get next step considering hands tracking
  const getNextStep = (currentStep: number) => {
    if (!tracksHands) {
      // Skip hands steps (1 and 4) when not tracking hands
      switch (currentStep) {
        case 0: return 2; // Your points -> Your Bostons
        case 2: return 3; // Your Bostons -> Opponent points
        case 3: return 5; // Opponent points -> Opponent Bostons
        case 5: return 6; // Opponent Bostons -> Check for tie
        default: return currentStep + 1;
      }
    }
    return currentStep + 1;
  };

  // Function to get previous step considering hands tracking
  const getPrevStep = (currentStep: number) => {
    if (!tracksHands) {
      // Skip hands steps when going back
      switch (currentStep) {
        case 2: return 0; // Your Bostons -> Your points
        case 3: return 2; // Opponent points -> Your Bostons
        case 5: return 3; // Opponent Bostons -> Opponent points
        case 6: return 5; // Tie check -> Opponent Bostons
        default: return currentStep - 1;
      }
    }
    return currentStep - 1;
  };

  if (!activeTournament) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Active Tournament</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 text-center">There is currently no active tournament. Please check back later.</p>
        </CardContent>
      </Card>
    );
  }

  // REMOVE_ME: File name display for testing
  return (
    <Card>
      <div className="w-full flex justify-center REMOVE_ME_FILENAME" style={{ position: 'sticky', top: 0, zIndex: 999 }}>
        <span className="text-xs text-gray-400 py-2 bg-white/80 px-2 rounded shadow" style={{ zIndex: 999 }}>
          ScoreEntryCard.tsx
        </span>
      </div>
      {/* REMOVE_ME_FILENAME: ScoreEntryCard.tsx */}
      <CardHeader>
        <p 
          className="mb-1"
          style={{ fontWeight: 'bold', color: 'red', fontSize: 28 }}
        >
          {activeTournament?.name}
        </p>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Score Entry
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {schedules.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-2">No tournament schedule found</p>
            <p className="text-sm text-gray-400">Please wait for the tournament to be scheduled</p>
          </div>
        ) : activeMatches.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-2">No active matches found</p>
            <p className="text-sm text-gray-400">All rounds completed or waiting for next round</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="space-y-2">
                {activeMatches.map((match: any, index: number) => (
                  <div 
                     key={index}
                     className={`border rounded-lg p-3 transition-colors ${
                       selectedMatch?.id === match.id ? 'border-blue-500 bg-blue-50' : 
                       match.status === 'Opponent entering score' ? 'bg-gray-100 cursor-not-allowed' :
                       'hover:bg-gray-50 cursor-pointer'
                     }`}
                      onClick={() => {
                        if (match.status === 'Ready to Score') {
                          // Attempt to acquire server-backed lock
                          (async () => {
                            const result = await beginScoreEntry({
                              matchId: match.id,
                              teamId: String(team.id),
                              teamA: String(match.teamA),
                              teamB: String(match.teamB),
                              round: match.round,
                            });
                            if (result.ok) {
                              setEnteringTeamId(team.id);
                              setSelectedMatch(match);
                              setCurrentStep(0);
                            } else {
                              toast({ title: 'Opponent entering score', description: 'Please wait and try again in a moment.', variant: 'destructive' });
                              await refreshGamesFromSupabase();
                            }
                          })();
                        } else if (match.status === 'Pending confirmation') {
                          setEnteringTeamId(null);
                          setSelectedMatch(match);
                          setCurrentStep(0);
                        }
                      }}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        {/* <p className="font-medium text-sm">{match.tournamentName}</p> */}
                        <p className="text-xs text-gray-600 font-bold" style={{fontWeight: 'bold'}}>
                          Round {match.round}
                        </p>
                        {match.teamB === 'TBD' || match.teamA === 'TBD' ? (
                          <p className="text-sm text-orange-600">Waiting for opponent from previous round</p>
                        ) : (
                          <>
                            <p className="text-sm">
                              Your Team is Playing Team {match.opponentTeam?.id || match.opponentId}
                              {match.opponentTeam && (
                                <span className="text-xs text-gray-500 ml-1">
                                  ( {match.opponentTeam.name} — {match.opponentTeam.player1FirstName} {match.opponentTeam.player1LastName} & {match.opponentTeam.player2FirstName} {match.opponentTeam.player2LastName} )
                                </span>
                              )}
                            </p>
                          </>
                        )}
                      </div>
                      <div>
                        <Badge 
                          variant={match.status === 'Ready to Score' ? 'outline' : 
                                  match.status === 'Waiting for opponent confirmation' ? 'secondary' : 
                                  match.status === 'Opponent entering score' ? 'destructive' : 'default'}
                          className="text-xs"
                        >
                          {match.status === 'Waiting for opponent' && <Clock className="h-3 w-3 mr-1" />}
                          {match.status}
                        </Badge>
                        {match.statusMessage && (
                          <p className="text-xs text-gray-500 mt-1">{match.statusMessage}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedMatch && (() => {
              // If there's a pending confirmation for this match and this team didn't submit,
              // show a confirmation UI instead of the step-by-step entry.
              const pendingGame = games.find(g => String(g.matchId) === String(selectedMatch.id) && g.status === 'pending_confirmation');
              const isOpponentToConfirm = pendingGame && String(pendingGame.entered_by_team_id) !== String(team.id);
              if (pendingGame && isOpponentToConfirm) {
                const myIsTeamA = String(pendingGame.teamA) === String(team.id);
                const myScore = myIsTeamA ? pendingGame.scoreA : pendingGame.scoreB;
                const oppScore = myIsTeamA ? pendingGame.scoreB : pendingGame.scoreA;
                const myBostons = myIsTeamA ? (pendingGame.boston_a ?? 0) : (pendingGame.boston_b ?? 0);
                const oppBostons = myIsTeamA ? (pendingGame.boston_b ?? 0) : (pendingGame.boston_a ?? 0);
                const myHands = myIsTeamA ? (pendingGame.handsA ?? 0) : (pendingGame.handsB ?? 0);
                const oppHands = myIsTeamA ? (pendingGame.handsB ?? 0) : (pendingGame.handsA ?? 0);
                const handleConfirm = async (confirm: boolean) => {
                  try {
                    await confirmScore(pendingGame.id, confirm);
                    toast({ title: confirm ? 'Score confirmed' : 'Score disputed', variant: confirm ? 'default' : 'destructive' });
                    setSelectedMatch(null);
                    await refreshGamesFromSupabase();
                    setRefreshKey(prev => prev + 1);
                  } catch (e) {
                    toast({ title: 'Action failed', description: 'Please try again.', variant: 'destructive' });
                  }
                };
                return (
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="font-medium">Review and Confirm - Round {pendingGame.round || selectedMatch.round}</h3>
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="p-3 rounded bg-green-50">
                        <div className="text-xs text-gray-600 mb-1">Your Score</div>
                        <div className="text-2xl font-bold text-green-700">{myScore}</div>
                        <div className="text-xs text-gray-600 mt-1">Bostons: {myBostons}{tracksHands ? ` • Hands: ${myHands}` : ''}</div>
                      </div>
                      <div className="p-3 rounded bg-gray-50">
                        <div className="text-xs text-gray-600 mb-1">Opponent</div>
                        <div className="text-2xl font-bold">{oppScore}</div>
                        <div className="text-xs text-gray-600 mt-1">Bostons: {oppBostons}{tracksHands ? ` • Hands: ${oppHands}` : ''}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="destructive" className="flex-1" onClick={() => handleConfirm(false)}>Dispute</Button>
                      <Button className="flex-1" onClick={() => handleConfirm(true)}>
                        <Check className="h-4 w-4 mr-2" />Confirm
                      </Button>
                    </div>
                  </div>
                );
              }
              return (
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-medium">
                  {selectedMatch.status === 'Score Conflict' ? 'Fix Score Conflict for Round' : 'Enter Score for Round'} {selectedMatch.round}
                </h3>
                
                {/* Step-by-step score entry */}
                {currentStep === 0 && (
                  <div className="text-center space-y-4">
                    <h2 className="text-2xl font-bold text-blue-600">How many points did you have?</h2>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={scoreA}
                      onChange={(e) => setScoreA(e.target.value)}
                      placeholder="Enter your points"
                      className="text-center text-xl h-12"
                      autoFocus
                    />
                                         <Button 
                       onClick={() => setCurrentStep(getNextStep(0))} 
                       className="w-full"
                       disabled={!scoreA}
                     >
                       Next
                     </Button>
                  </div>
                )}

                                 {tracksHands && currentStep === 1 && (
                   <div className="text-center space-y-4">
                     <h2 className="text-2xl font-bold text-blue-600">How many hands did you win?</h2>
                     <Input
                       type="tel"
                       inputMode="numeric"
                       pattern="[0-9]*"
                       value={handsA}
                       onChange={(e) => setHandsA(e.target.value)}
                       placeholder="Enter hands won"
                       className="text-center text-xl h-12"
                       autoFocus
                     />
                     <div className="flex gap-2">
                       <Button 
                         onClick={() => setCurrentStep(getPrevStep(1))} 
                         variant="outline"
                         className="flex-1"
                       >
                         Back
                       </Button>
                       <Button 
                         onClick={() => setCurrentStep(getNextStep(1))} 
                         className="flex-1"
                         disabled={!handsA}
                       >
                         Next
                       </Button>
                     </div>
                   </div>
                 )}

                {currentStep === 2 && (
                  <div className="text-center space-y-4">
                    <h2 className="text-2xl font-bold text-blue-600">How many Bostons did you make?</h2>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={bostonA}
                      onChange={(e) => setBostonA(e.target.value)}
                      placeholder="Enter your Bostons"
                      className="text-center text-xl h-12"
                      autoFocus
                    />
                    <div className="flex gap-2">
                                             <Button 
                         onClick={() => setCurrentStep(getPrevStep(2))} 
                         variant="outline"
                         className="flex-1"
                       >
                         Back
                       </Button>
                       <Button 
                         onClick={() => setCurrentStep(getNextStep(2))} 
                         className="flex-1"
                         disabled={!bostonA}
                       >
                         Next
                       </Button>
                    </div>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="text-center space-y-4">
                    <h2 className="text-2xl font-bold text-blue-600">How many points did your opponent have?</h2>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={scoreB}
                      onChange={(e) => setScoreB(e.target.value)}
                      placeholder="Enter opponent points"
                      className="text-center text-xl h-12"
                      autoFocus
                    />
                    <div className="flex gap-2">
                                             <Button 
                         onClick={() => setCurrentStep(getPrevStep(3))} 
                         variant="outline"
                         className="flex-1"
                       >
                         Back
                       </Button>
                       <Button 
                         onClick={() => setCurrentStep(getNextStep(3))} 
                         className="flex-1"
                         disabled={!scoreB}
                       >
                         Next
                       </Button>
                    </div>
                  </div>
                )}

                                 {tracksHands && currentStep === 4 && (
                   <div className="text-center space-y-4">
                     <h2 className="text-2xl font-bold text-blue-600">How many hands did your opponent win?</h2>
                     <Input
                       type="tel"
                       inputMode="numeric"
                       pattern="[0-9]*"
                       value={handsB}
                       onChange={(e) => setHandsB(e.target.value)}
                       placeholder="Enter opponent hands"
                       className="text-center text-xl h-12"
                       autoFocus
                     />
                     <div className="flex gap-2">
                       <Button 
                         onClick={() => setCurrentStep(getPrevStep(4))} 
                         variant="outline"
                         className="flex-1"
                       >
                         Back
                       </Button>
                       <Button 
                         onClick={() => setCurrentStep(getNextStep(4))} 
                         className="flex-1"
                         disabled={!handsB}
                       >
                         Next
                       </Button>
                     </div>
                   </div>
                 )}

                {currentStep === 5 && (
                  <div className="text-center space-y-4">
                    <h2 className="text-2xl font-bold text-blue-600">How many Bostons did your opponent make?</h2>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={bostonB}
                      onChange={(e) => setBostonB(e.target.value)}
                      placeholder="Enter opponent Bostons"
                      className="text-center text-xl h-12"
                      autoFocus
                    />
                    <div className="flex gap-2">
                                             <Button 
                         onClick={() => setCurrentStep(getPrevStep(5))} 
                         variant="outline"
                         className="flex-1"
                       >
                         Back
                       </Button>
                       <Button 
                         onClick={() => setCurrentStep(6)} 
                         className="flex-1"
                         disabled={!bostonB}
                       >
                         Next
                       </Button>
                    </div>
                  </div>
                                 )}

                 {currentStep === 6 && (
                   <div className="text-center space-y-4">
                     <h2 className="text-2xl font-bold text-blue-600">Check for Tie</h2>
                     <div className="text-lg">
                       Your Score: {scoreA} | Opponent Score: {scoreB}
                     </div>
                     {parseInt(scoreA) === parseInt(scoreB) ? (
                       <div className="space-y-4">
                         <p className="text-lg text-orange-600">Scores are tied! Who won the tiebreaker?</p>
                         <div className="flex gap-2">
                           <Button 
                             onClick={() => setTieWinner('teamA')} 
                             variant={tieWinner === 'teamA' ? 'default' : 'outline'}
                             className="flex-1"
                           >
                             You Won
                           </Button>
                           <Button 
                             onClick={() => setTieWinner('teamB')} 
                             variant={tieWinner === 'teamB' ? 'default' : 'outline'}
                             className="flex-1"
                           >
                             Opponent Won
                           </Button>
                         </div>
                       </div>
                     ) : (
                       <p className="text-lg text-green-600">No tie - winner is clear!</p>
                     )}
                     <div className="flex gap-2">
                       <Button 
                         onClick={() => setCurrentStep(getPrevStep(6))} 
                         variant="outline"
                         className="flex-1"
                       >
                         Back
                       </Button>
                       <Button 
                         onClick={handleSubmitScore} 
                         className="flex-1"
                         disabled={parseInt(scoreA) === parseInt(scoreB) && !tieWinner}
                       >
                         <Check className="h-4 w-4 mr-2" />
                         Submit Score
                       </Button>
                     </div>
                   </div>
                )}
               </div>
              );
            })()}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ScoreEntryCard;