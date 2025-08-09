import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppContext } from '@/contexts/AppContext';
import { Badge } from '@/components/ui/badge';
import { Calendar, Trophy, Users, Target, AlertCircle, TestTube, Crown, Clock, Check } from 'lucide-react';
import ScoreEntryCard from './ScoreEntryCard';
import type { Team } from '@/contexts/AppContext';
import { toast } from '@/hooks/use-toast';
import MessageBanner from './MessageBanner';


// Direct score entry component without the wrapper UI
const DirectScoreEntry = ({ team, match, onComplete }: { team: Team; match: any; onComplete: () => void }) => {
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [handsA, setHandsA] = useState('');
  const [handsB, setHandsB] = useState('');
  const [bostonA, setBostonA] = useState('0');
  const [bostonB, setBostonB] = useState('0');
  const [currentStep, setCurrentStep] = useState(0);
  const [tieWinner, setTieWinner] = useState<'teamA' | 'teamB' | null>(null);
  const { teams, submitGame, getActiveTournament } = useAppContext();

  const activeTournament = getActiveTournament();
  const tracksHands = activeTournament?.tracksHands !== false;

  const getNextStep = (currentStep: number) => {
    if (!tracksHands) {
      switch (currentStep) {
        case 0: return 2;
        case 2: return 3;
        case 3: return 5;
        case 5: return 6;
        default: return currentStep + 1;
      }
    }
    return currentStep + 1;
  };

  const getPrevStep = (currentStep: number) => {
    if (!tracksHands) {
      switch (currentStep) {
        case 2: return 0;
        case 3: return 2;
        case 5: return 3;
        case 6: return 5;
        default: return currentStep - 1;
      }
    }
    return currentStep - 1;
  };

  const handleSubmitScore = async () => {
    if (!match || !scoreA || !scoreB) return;
    
    if (tracksHands && (!handsA || !handsB)) return;
    
    const teamAScore = String(match.teamA) === String(team.id) ? parseInt(scoreA) : parseInt(scoreB);
    const teamBScore = String(match.teamA) === String(team.id) ? parseInt(scoreB) : parseInt(scoreA);
    
    if (teamAScore === teamBScore && !tieWinner) return;
    
    const bostonAValue = parseInt(bostonA) || 0;
    const bostonBValue = parseInt(bostonB) || 0;
    
    const toNum = (v: string) => v.trim() === '' ? 0 : Number(v);
    const teamAHands = String(match.teamA) === String(team.id) ? toNum(handsA) : toNum(handsB);
    const teamBHands = String(match.teamA) === String(team.id) ? toNum(handsB) : toNum(handsA);

    const teamA = teams.find(t => String(t.id) === String(match.teamA));
    const teamB = teams.find(t => String(t.id) === String(match.teamB));
    if (!teamA || !teamB) return;

    const gameData = {
      teamA: teamA.id,
      teamB: teamB.id,
      scoreA: teamAScore,
      scoreB: teamBScore,
      handsA: teamAHands,
      handsB: teamBHands,
      boston_a: bostonAValue,
      boston_b: bostonBValue,
      winner: (teamAScore > teamBScore ? 'teamA' : teamAScore < teamBScore ? 'teamB' : tieWinner!) as 'teamA' | 'teamB',
      matchId: match.id,
      round: match.round,
      submittedBy: team.id,
      status: 'pending_confirmation',
      entered_by_team_id: team.id
    };

    await submitGame(gameData);
    onComplete();
  };

  return (
    <div className="space-y-4">
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
                  onClick={() => setTieWinner(String(match.teamA) === String(team.id) ? 'teamA' : 'teamB')} 
                  variant={tieWinner === (String(match.teamA) === String(team.id) ? 'teamA' : 'teamB') ? 'default' : 'outline'}
                  className="flex-1"
                >
                  You Won
                </Button>
                <Button 
                  onClick={() => setTieWinner(String(match.teamA) === String(team.id) ? 'teamB' : 'teamA')} 
                  variant={tieWinner === (String(match.teamA) === String(team.id) ? 'teamB' : 'teamA') ? 'default' : 'outline'}
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
 };

// Score confirmation component for reviewing and confirming/disputing scores
const ScoreConfirmation = ({ team, match, onComplete }: { team: Team; match: any; onComplete: () => void }) => {
  const { games, confirmScore, refreshGamesFromSupabase } = useAppContext();
  
  // Find the pending game for this match
  const pendingGame = games.find(g => String(g.matchId) === String(match.id) && g.status === 'pending_confirmation');
  
  if (!pendingGame) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-500">No pending score found for this match.</p>
      </div>
    );
  }

  const myIsTeamA = String(pendingGame.teamA) === String(team.id);
  const myScore = myIsTeamA ? pendingGame.scoreA : pendingGame.scoreB;
  const oppScore = myIsTeamA ? pendingGame.scoreB : pendingGame.scoreA;
  const myBostons = myIsTeamA ? (pendingGame.boston_a ?? 0) : (pendingGame.boston_b ?? 0);
  const oppBostons = myIsTeamA ? (pendingGame.boston_b ?? 0) : (pendingGame.boston_a ?? 0);
  const myHands = myIsTeamA ? (pendingGame.handsA ?? 0) : (pendingGame.handsB ?? 0);
  const oppHands = myIsTeamA ? (pendingGame.handsB ?? 0) : (pendingGame.handsA ?? 0);
  
  // Check if scores are tied and get tiebreaker winner information
  const isTied = myScore === oppScore;
  const tiebreakerWinner = pendingGame.winner;
  const tiebreakerWinnerName = tiebreakerWinner === 'teamA' ? 
    (myIsTeamA ? 'You' : 'Opponent') : 
    (myIsTeamA ? 'Opponent' : 'You');

  const handleConfirm = async (confirm: boolean) => {
    try {
      await confirmScore(pendingGame.id, confirm);
      toast({ 
        title: confirm ? 'Score confirmed' : 'Score disputed', 
        variant: confirm ? 'default' : 'destructive' 
      });
      await refreshGamesFromSupabase();
      onComplete();
    } catch (e) {
      toast({ 
        title: 'Action failed', 
        description: 'Please try again.', 
        variant: 'destructive' 
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-medium mb-2">Review the score entered by your opponent:</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-center">
        <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
          <div className="text-sm text-gray-600 mb-1">Your Score</div>
          <div className="text-3xl font-bold text-blue-700">{myScore}</div>
          <div className="text-xs text-gray-600 mt-1">
            Bostons: {myBostons}
            {pendingGame.handsA !== undefined && ` • Hands: ${myHands}`}
          </div>
        </div>
        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Opponent Score</div>
          <div className="text-3xl font-bold">{oppScore}</div>
          <div className="text-xs text-gray-600 mt-1">
            Bostons: {oppBostons}
            {pendingGame.handsB !== undefined && ` • Hands: ${oppHands}`}
          </div>
        </div>
      </div>
      
      {/* Show tiebreaker winner information if scores are tied */}
      {isTied && (
        <div className="p-4 rounded-lg bg-orange-50 border border-orange-200 text-center">
          <div className="text-sm text-orange-700 font-medium mb-1">Tiebreaker Winner</div>
          <div className="text-lg font-bold text-orange-800">
            {tiebreakerWinnerName} won the tiebreaker
          </div>
          <div className="text-xs text-orange-600 mt-1">
            Please verify this tiebreaker winner is correct
          </div>
        </div>
      )}
      
      <div className="text-center">
        <p className="text-sm text-gray-600 mb-4">
          Please review these scores. If they match what you recorded, click "Confirm". 
          If there's a discrepancy, click "Dispute".
        </p>
      </div>
      
      <div className="flex gap-3">
        <Button 
          variant="destructive" 
          className="flex-1" 
          onClick={() => handleConfirm(false)}
        >
          Dispute
        </Button>
        <Button 
          className="flex-1" 
          onClick={() => handleConfirm(true)}
        >
          <Check className="h-4 w-4 mr-2" />
          Confirm
        </Button>
      </div>
    </div>
  );
};
 
 const PlayerPortalFixed = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [teamNumber, setTeamNumber] = useState('');
  const [team, setTeam] = useState<Team | null>(null);
  const [loginError, setLoginError] = useState('');
  const [testMode, setTestMode] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [enteringTeamId, setEnteringTeamId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { teams, schedules, games, tournaments, getActiveTournament, submitGame, confirmScore, beginScoreEntry, releaseScoreEntryLock, refreshGamesFromSupabase, getActiveMessages } = useAppContext();

  const cleanPhoneNumber = (phone: string) => {
    return phone.replace(/\D/g, '');
  };

  const handleLogin = () => {
    setLoginError('');
    const cleanPhone = cleanPhoneNumber(phoneNumber);
    
    if (cleanPhone.length !== 10) {
      setLoginError('Please enter a valid 10-digit phone number');
      return;
    }
    
    const foundTeam = teams.find(t => {
      const teamPhone = cleanPhoneNumber(t.phoneNumber);
      return teamPhone === cleanPhone;
    });
    
    if (foundTeam) {
      setTeam(foundTeam);
    } else {
      setLoginError('Team not found. Please check your phone number.');
    }
  };

  const handleTestLogin = (testTeam: Team) => {
    setTeam(testTeam);
    setTestMode(true);
  };

  const handleAdminTeamSelect = (teamId: string) => {
    const selectedTeam = teams.find(t => t.id === teamId);
    if (selectedTeam) {
      setTeam(selectedTeam);
      setAdminMode(true);
    }
  };

  const handleAdminTeamNumberLogin = () => {
    if (!teamNumber.trim()) return;
    
    const teamNumberInt = parseInt(teamNumber.trim());
    const selectedTeam = teams.find(t => 
      t.teamNumber === teamNumberInt || 
      t.id === teamNumber.trim()
    );
    if (selectedTeam) {
      setTeam(selectedTeam);
      setAdminMode(true);
      setTeamNumber('');
      setLoginError('');
    } else {
      setLoginError(`No team found with number ${teamNumber.trim()}`);
    }
  };

  // Force re-render when games change
  useEffect(() => {
    // This effect will run whenever games change, ensuring the component updates
    setRefreshKey(prev => prev + 1);
  }, [games]);

  // Scroll to top when team logs in
  useEffect(() => {
    if (team) {
      window.scrollTo(0, 0);
    }
  }, [team]);

  // Force re-render when messages change
  useEffect(() => {
    const interval = setInterval(() => {
      // This will trigger a re-render when messages change
      setRefreshKey(prev => prev + 1);
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, []);

  // Periodic refresh as backup to real-time updates
  useEffect(() => {
    if (!team) return;
    
    const interval = setInterval(() => {
      refreshGamesFromSupabase();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [team, refreshGamesFromSupabase]);

  // Only show schedule for the active tournament
  const getTeamSchedule = () => {
    if (!team) return [];
    const activeTournament = getActiveTournament();
    if (!activeTournament) return [];
    const schedule = schedules.find(s => s.tournamentId === activeTournament.id);
    if (!schedule) return [];
    const teamMatches = schedule.matches.filter(match =>
      match.teamA === team.id || match.teamB === team.id
    );
    
    // Find the current round (first uncompleted round)
    const completedRounds = new Set();
    games.forEach(game => {
      if ((game.teamA === team.id || game.teamB === team.id) && 
          (game.confirmed || game.status === 'confirmed') &&
          game.matchId) {
        const match = schedule.matches.find(m => m.id === game.matchId);
        if (match) completedRounds.add(match.round);
      }
    });
    
    // Also mark BYE rounds as completed
    teamMatches.forEach(match => {
      if (match.isBye) {
        completedRounds.add(match.round);
      }
    });
    
    const currentRound = Math.min(...Array.from({ length: schedule.rounds }, (_, i) => i + 1)
      .filter(round => !completedRounds.has(round)));
    
    return teamMatches.map(match => {
      const opponentId = match.teamA === team.id ? match.teamB : match.teamA;
      const opponentTeam = teams.find(t => t.id === opponentId);
      
      // Find any game for this match
      const existingGame = games.find(game => game.matchId === match.id);
      
      // Determine card type
      let cardType = 'future'; // Default for future rounds
      let status = '';
      let statusMessage = '';
      
      if (match.isBye) {
        cardType = 'completed';
        status = 'BYE Round';
        statusMessage = 'No game this round';
      } else if (existingGame) {
        if (existingGame.status === 'confirmed' || existingGame.confirmed) {
          cardType = 'completed';
                 } else if (existingGame.status === 'pending_confirmation') {
           if (existingGame.entered_by_team_id === team.id) {
             status = 'Opponent confirming score';
             statusMessage = 'Your score has been entered. Opponent is confirming.';
           } else {
             status = 'Pending confirmation';
             statusMessage = 'Review and confirm the score entered by your opponent.';
           }
           cardType = 'current';
                 } else if (existingGame.status === 'entering') {
           if (existingGame.entered_by_team_id === team.id) {
             status = 'Entering score';
             statusMessage = 'You are currently entering the score.';
           } else {
             status = 'Opponent entering score';
             statusMessage = 'Opponent is entering the score. Please wait.';
           }
           cardType = 'current';
         } else if (existingGame.status === 'disputed') {
           if (existingGame.entered_by_team_id === team.id) {
             status = 'Score disputed - re-enter';
             statusMessage = 'Your score was disputed. Please re-enter the correct score.';
           } else {
             status = 'Score disputed';
             statusMessage = 'The score was disputed. Waiting for opponent to re-enter.';
           }
           cardType = 'current';
        }
      } else if (match.round === currentRound) {
        cardType = 'current';
        status = 'Ready to Score';
        statusMessage = 'Click to enter your score';
      }
      
      // For completed games, calculate result
      let gameResult = null;
      if (cardType === 'completed' && existingGame) {
        const isTeamA = match.teamA === team.id;
        const myScore = isTeamA ? existingGame.scoreA : existingGame.scoreB;
        const opponentScore = isTeamA ? existingGame.scoreB : existingGame.scoreA;
        // Use the winner field from the game data, which handles tied scores correctly
        const isWin = (isTeamA && existingGame.winner === 'teamA') || (!isTeamA && existingGame.winner === 'teamB');
        
        gameResult = {
          myScore,
          opponentScore,
          isWin,
          boston: existingGame.boston
        };
      }
      
      return {
        ...match,
        tournamentName: activeTournament.name,
        opponentTeam,
        gameResult,
        cardType,
        status,
        statusMessage,
        existingGame
      };
    }).sort((a, b) => a.round - b.round);
  };

  // Only show results for the active tournament
  const getTeamRecord = useMemo(() => {
    const activeTournament = getActiveTournament();
    if (!team || !activeTournament) return { wins: 0, totalGames: 0, totalPoints: 0, avgPoints: '0.0', results: [] };
    const schedule = schedules.find(s => s.tournamentId === activeTournament.id);
    if (!schedule) return { wins: 0, totalGames: 0, totalPoints: 0, avgPoints: '0.0', results: [] };
    const matchIds = new Set(schedule.matches.map(m => m.id));
    const results = games.filter(game =>
      (game.teamA === team.id || game.teamB === team.id) &&
      (game.confirmed || game.status === 'confirmed') &&
      game.matchId && matchIds.has(game.matchId)
    ).map(game => {
      const isTeamA = game.teamA === team.id;
      const opponentId = isTeamA ? game.teamB : game.teamA;
      const opponent = teams.find(t => t.id === opponentId) || null;
      return {
        ...game,
        isWin: (isTeamA && game.winner === 'teamA') || (!isTeamA && game.winner === 'teamB'),
        teamScore: isTeamA ? game.scoreA : game.scoreB,
        opponentScore: isTeamA ? game.scoreB : game.scoreA,
        opponent
      };
    });
    const wins = results.filter(r => r.isWin).length;
    const totalGames = results.length;
    const totalPoints = results.reduce((sum, r) => sum + r.teamScore, 0);
    const avgPoints = totalGames > 0 ? (totalPoints / totalGames).toFixed(1) : '0.0';
    return { wins, totalGames, totalPoints, avgPoints, results };
  }, [games, team, schedules, getActiveTournament, teams]);

  // Login screen
  if (!team) {
    const activeMessage = getActiveMessages()[0];
    console.log('Login screen - active message:', activeMessage);
    return (
              <div className="min-h-screen flex flex-col justify-start items-center bg-gray-50 p-4 pt-8">
                <MessageBanner 
                  key={`login-${activeMessage?.id || 'none'}`}
                  message={activeMessage?.text || ''} 
                  type={activeMessage?.type} 
                />
        <Card className="w-full max-w-md shadow-lg border-2 border-red-500 mt-16">
          <CardHeader className="text-center pb-2 space-y-4">
                                       <div className="mx-auto w-61 h-61 flex items-center justify-center bg-red-600 rounded-lg shadow-sm relative mb-0">
                <img src={import.meta.env.BASE_URL + 'SetPlay_Logo.png'} alt="SetPlay Logo" className="w-61 h-61" />
              </div>
              <div className="flex flex-col items-center -mt-28">
                <img src={import.meta.env.BASE_URL + 'tp.png'} alt="Teams Portal" className="w-75 h-25 object-contain" />
              </div>
          </CardHeader>
                     <CardContent className="space-y-6">
             <div className="space-y-3 mt-8">
                              <div className="space-y-2">
                  <Input
                    placeholder="Enter 10-digit phone number"
                    value={phoneNumber}
                    onChange={(e) => {
                      setPhoneNumber(e.target.value);
                      setLoginError('');
                    }}
                    className="text-center text-lg border-2 border-black focus:border-red-500 focus:ring-red-500"
                    maxLength={14}
                    autoFocus
                  />
                  <Button onClick={handleLogin} className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md">
                    Enter Tournament Portal
                  </Button>
                </div>
              {loginError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-800">{loginError}</p>
                </div>
              )}
            </div>
                         {typeof window !== 'undefined' && window.location.hash.includes('admin=1') && (
               <div className="border-t pt-4">
                 <div className="flex items-center gap-2 mb-3">
                   <Crown className="h-4 w-4 text-red-600" />
                   <span className="text-sm font-medium text-gray-700">Admin Access</span>
                 </div>
                 <div className="space-y-2">
                   <Select onValueChange={handleAdminTeamSelect}>
                     <SelectTrigger className="border-2 border-black">
                       <SelectValue placeholder="Select any team to view their portal" />
                     </SelectTrigger>
                     <SelectContent>
                       {teams.map((team) => (
                         <SelectItem key={team.id} value={team.id}>
                           Team {team.id}: {team.name} ({team.city})
                         </SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                   <p className="text-xs text-gray-500 text-center">
                     Select any team to view their portal as admin
                   </p>
                   
                   <div className="relative">
                     <div className="absolute inset-0 flex items-center">
                       <span className="w-full border-t border-gray-300" />
                     </div>
                     <div className="relative flex justify-center text-xs uppercase">
                       <span className="bg-white px-2 text-gray-500">OR</span>
                     </div>
                   </div>
                   
                   <div className="space-y-2">
                     <Input
                       placeholder="Enter team number"
                       value={teamNumber}
                       onChange={(e) => setTeamNumber(e.target.value)}
                       className="text-center text-lg border-2 border-black"
                       type="number"
                       onKeyPress={(e) => {
                         if (e.key === 'Enter') {
                           handleAdminTeamNumberLogin();
                         }
                       }}
                     />
                     <Button 
                       onClick={handleAdminTeamNumberLogin}
                       disabled={!teamNumber.trim()}
                       className="w-full bg-red-600 hover:bg-red-700 text-white"
                     >
                       Login as Team {teamNumber || '#'}
                     </Button>
                   </div>
                 </div>
               </div>
             )}
                         {/* Credit */}
             <div className="mt-6 text-xs text-center text-gray-500">
               Built and Managed by Brian Welch
             </div>
           </CardContent>
         </Card>
       </div>
    );
  }

  const teamSchedule = getTeamSchedule();

  const activeMessage = getActiveMessages()[0];
  console.log('Main portal - active message:', activeMessage);
  return (
    <div className="min-h-screen bg-gray-50">
      <MessageBanner 
        key={`portal-${activeMessage?.id || 'none'}`}
        message={activeMessage?.text || ''} 
        type={activeMessage?.type} 
      />
      {/* Clean Portal Header */}
      <div className="relative w-full bg-white shadow-sm border-b-2 border-red-500 py-4 px-4 flex flex-col items-center justify-center mt-8">
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4">
            <span className="text-lg md:text-xl font-bold text-gray-700">Team {team.id}: {team.name}</span>
            <span className="text-sm text-gray-600">{team.player1FirstName} {team.player1LastName} & {team.player2FirstName} {team.player2LastName}</span>
            <span className="text-xs text-gray-500">Phone: {team.phoneNumber}</span>
            {testMode && <Badge variant="secondary" className="mt-1 text-xs bg-yellow-100 text-yellow-800">Test Mode</Badge>}
            {adminMode && <Badge variant="default" className="mt-1 text-xs bg-red-100 text-red-800">Admin Mode</Badge>}
          </div>
        </div>
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              setTeam(null);
              setTestMode(false);
              setAdminMode(false);
              setSelectedTeamId('');
            }}
            className="text-red-600 border-red-600 hover:bg-red-600 hover:text-white"
          >
            Logout
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {/* Tournament Name and Record Boxes */}
        <div className="mb-6">
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold text-gray-900 mb-1">{getActiveTournament()?.name}</h2>
            <p className="text-sm text-gray-600">Schedule</p>
          </div>
          
          {/* Horizontal Scrollable Record Boxes */}
          <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-hide">
            <div className="flex-shrink-0 text-center p-4 bg-blue-50 rounded-lg min-w-[120px]">
              <p className="text-2xl font-bold text-blue-600">{getTeamRecord.wins}</p>
              <p className="text-sm text-gray-600">Wins</p>
            </div>
            <div className="flex-shrink-0 text-center p-4 bg-gray-50 rounded-lg min-w-[120px]">
              <p className="text-2xl font-bold">{getTeamRecord.totalGames}</p>
              <p className="text-sm text-gray-600">Games Played</p>
            </div>
            <div className="flex-shrink-0 text-center p-4 bg-green-50 rounded-lg min-w-[120px]">
              <p className="text-2xl font-bold text-green-600">{getTeamRecord.avgPoints}</p>
              <p className="text-sm text-gray-600">Avg Points/Game</p>
            </div>
            <div className="flex-shrink-0 text-center p-4 bg-purple-50 rounded-lg min-w-[120px]">
              <p className="text-2xl font-bold text-purple-600">{getTeamRecord.totalPoints}</p>
              <p className="text-sm text-gray-600">Total Points</p>
            </div>
          </div>
        </div>

                 {/* Schedule Content */}
         <Card>
           <CardHeader><CardTitle></CardTitle></CardHeader>
          <CardContent>
            {teamSchedule.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <p>No scheduled matches found</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Show all rounds */}
                {(() => {
                  const maxRound = Math.max(...teamSchedule.map(m => m.round));
                  return Array.from({ length: maxRound }, (_, i) => i + 1).map(round => {
                    const roundMatches = teamSchedule.filter(match => match.round === round);
                    return (
                      <div key={round} className="space-y-3">
                        <div className="space-y-3">
                          {roundMatches.map((match: any, index: number) => {
                            // Determine card styling based on card type
                            let cardClassName = 'border rounded-lg p-4 ';
                            if (match.isBye) {
                              cardClassName += 'bg-yellow-50 border-yellow-200';
                            } else if (match.cardType === 'completed') {
                              cardClassName += match.gameResult?.isWin ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
                            } else if (match.cardType === 'current') {
                              cardClassName += 'bg-blue-50 border-blue-200';
                            } else {
                              cardClassName += 'bg-white';
                            }

                            return (
                              <div key={index} className={cardClassName}>
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                                  <div className="flex-1">
                                    
                                    {match.isBye ? (
                                      <div className="text-center">
                                        <Badge variant="secondary" className="text-sm">BYE ROUND</Badge>
                                        <p className="text-xs text-gray-600 mt-1">No game this round</p>
                                      </div>
                                    ) : (
                                      <div>
                                        {/* Card Type 1: Future rounds - show opponent info */}
                                        {match.cardType === 'future' && (
                                          <>
                                            <div className="flex items-center justify-between h-16">
                                              {/* Left side: Round pill */}
                                              <div className="flex items-center justify-center">
                                                <Badge variant="outline" className="text-xs">
                                                  Round {match.round}
                                                </Badge>
                                              </div>
                                              
                                              {/* Middle: Team, team number, and team name all centered */}
                                              <div className="flex flex-col items-center justify-center">
                                                <span className="text-xs text-gray-600">Team</span>
                                                <span className="font-bold text-lg">{match.opponentTeam?.id || match.opponentId}</span>
                                                <span className="text-xs text-gray-600">
                                                  {match.opponentTeam?.player1FirstName || ''}/{match.opponentTeam?.player2FirstName || ''}
                                                </span>
                                              </div>
                                             
                                              {/* Right side: Table pill */}
                                              <div className="flex items-center justify-center">
                                                <Badge variant="secondary" className="text-xs">
                                                  Table {match.table}
                                                </Badge>
                                              </div>
                                            </div>
                                          </>
                                        )}

                                        {/* Card Type 2: Current round - Ready to Score or status */}
                                        {match.cardType === 'current' && (
                                          <>
                                            <div className="flex items-center justify-between h-16">
                                              {/* Left side: Round pill */}
                                              <div className="flex items-center justify-center">
                                                <Badge variant="outline" className="text-xs">
                                                  Round {match.round}
                                                </Badge>
                                              </div>
                                              
                                              {/* Middle: Team, team number, and team name all centered */}
                                              <div className="flex flex-col items-center justify-center">
                                                <span className="text-xs text-gray-600">Team</span>
                                                <span className="font-bold text-lg">{match.opponentTeam?.id || match.opponentId}</span>
                                                <span className="text-xs text-gray-600">
                                                  {match.opponentTeam?.player1FirstName || ''}/{match.opponentTeam?.player2FirstName || ''}
                                                </span>
                                              </div>
                                            
                                              {/* Right side: Status pill or Enter Score button */}
                                              <div className="flex items-center justify-center">
                                                {match.status === 'Ready to Score' ? (
                                                  <Button 
                                                    size="sm" 
                                                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-2 py-1 text-xs rounded-md shadow-sm animate-pulse"
                                                    onClick={() => {
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
                                                          // setCurrentStep(0); // Removed as per edit hint
                                                        } else {
                                                          toast({ title: 'Opponent entering score', description: 'Please wait and try again in a moment.', variant: 'destructive' });
                                                          await refreshGamesFromSupabase();
                                                        }
                                                      })();
                                                    }}
                                                  >
                                                    Score
                                                  </Button>
                                                                                                 ) : match.status === 'Opponent entering score' ? (
                                                   <Badge 
                                                     variant="secondary"
                                                     className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300"
                                                   >
                                                     <div className="flex items-center">
                                                       <div className="flex space-x-1 mr-1">
                                                         <div className="w-1 h-1 bg-yellow-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                                         <div className="w-1 h-1 bg-yellow-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                                         <div className="w-1 h-1 bg-yellow-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                                       </div>
                                                       <span className="text-xs">Entering</span>
                                                     </div>
                                                   </Badge>
                                                 ) : match.status === 'Opponent confirming score' ? (
                                                   <Badge 
                                                     variant="secondary"
                                                     className="text-xs bg-green-100 text-green-800 border-green-300"
                                                   >
                                                     <div className="flex items-center">
                                                       <div className="flex space-x-1 mr-1">
                                                         <div className="w-1 h-1 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                                         <div className="w-1 h-1 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                                         <div className="w-1 h-1 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                                       </div>
                                                       <span className="text-xs">Confirming</span>
                                                     </div>
                                                   </Badge>
                                                 ) : match.status === 'Score disputed - re-enter' ? (
                                                   <Button 
                                                     size="sm" 
                                                     className="bg-red-600 hover:bg-red-700 text-white font-medium px-2 py-1 text-xs rounded-md shadow-sm"
                                                     onClick={() => {
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
                                                         } else {
                                                           toast({ title: 'Opponent entering score', description: 'Please wait and try again in a moment.', variant: 'destructive' });
                                                           await refreshGamesFromSupabase();
                                                         }
                                                       })();
                                                     }}
                                                   >
                                                     Re-enter
                                                   </Button>
                                                 ) : match.status === 'Score disputed' ? (
                                                   <Badge 
                                                     variant="secondary"
                                                     className="text-xs bg-red-100 text-red-800 border-red-300"
                                                   >
                                                     <span className="text-xs">Disputed</span>
                                                   </Badge>
                                                ) : (
                                                   <Badge 
                                                     variant={match.status === 'Waiting for opponent confirmation' ? 'secondary' : 'default'}
                                                     className="text-xs"
                                                     onClick={() => {
                                                       if (match.status === 'Pending confirmation') {
                                                         setSelectedMatch(match);
                                                       }
                                                     }}
                                                   >
                                                     {match.status === 'Waiting for opponent' && <Clock className="h-3 w-3 mr-1" />}
                                                     {match.status === 'Pending confirmation' ? 'Confirm Score' : match.status}
                                                   </Badge>
                                                 )}
                                              </div>
                                            </div>
                                            
                                            {/* Upper left: Small italic "in progress" */}
                                            <div className="flex justify-start -mt-3">
                                              <span className="text-xs italic text-blue-800">
                                                in progress
                                              </span>
                                            </div>
                                          </>
                                        )}

                                        {/* Card Type 3: Completed rounds - show results ONLY (no "My team plays" text) */}
                                        {match.cardType === 'completed' && match.gameResult && (
                                          <>
                                            <div className="flex items-center justify-between h-16">
                                              {/* Left side: Round pill */}
                                              <div className="flex items-center justify-center">
                                                <Badge variant="outline" className="text-xs">
                                                  Round {match.round}
                                                </Badge>
                                              </div>
                                              
                                              {/* Middle: Team, team number, and team name all centered */}
                                              <div className="flex flex-col items-center justify-center">
                                                <span className="text-xs text-gray-600">Team</span>
                                                <span className="font-bold text-lg">{match.opponentTeam?.id || match.opponentId}</span>
                                                <span className="text-xs text-gray-600">
                                                  {match.opponentTeam?.player1FirstName || ''}/{match.opponentTeam?.player2FirstName || ''}
                                                </span>
                                              </div>
                                             
                                              {/* Right side: Result pill */}
                                              <div className="flex items-center justify-center">
                                                <Badge 
                                                  variant={match.gameResult.isWin ? 'default' : 'destructive'} 
                                                  className="text-xs"
                                                  style={{ 
                                                    backgroundColor: match.gameResult.isWin ? '#10b981' : '#ef4444',
                                                    color: 'white'
                                                  }}
                                                >
                                                  {match.gameResult.isWin ? 'WIN' : 'LOSS'}
                                                </Badge>
                                              </div>
                                            </div>
                                            
                                            {/* Bottom right: Small italic result */}
                                            <div className="flex justify-end -mt-3">
                                              <span className="text-xs italic text-red-600">
                                                {match.gameResult.isWin ? 'won' : 'loss'} {match.gameResult.myScore}-{match.gameResult.opponentScore}
                                              </span>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  {match.isSameCity && (
                                    <Badge variant="destructive" className="text-xs">
                                      Same City
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}

            {/* Score Entry Modal */}
            {selectedMatch && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">
                      {selectedMatch.status === 'Pending confirmation' ? 'Confirm Score' : 'Enter Score'} - Round {selectedMatch.round}
                    </h3>
                                         <Button 
                       variant="ghost" 
                       size="sm" 
                       onClick={async () => {
                         // Release the score entry lock if we're canceling
                         if (enteringTeamId && selectedMatch) {
                           await releaseScoreEntryLock({
                             matchId: selectedMatch.id,
                             teamId: enteringTeamId
                           });
                         }
                         
                         setSelectedMatch(null);
                         setEnteringTeamId(null);
                       }}
                     >
                       ✕
                     </Button>
                  </div>
                  
                                     {/* Show confirmation page for pending confirmation, score entry for ready to score */}
                                       {selectedMatch.status === 'Pending confirmation' ? (
                      <ScoreConfirmation 
                        team={team}
                        match={selectedMatch}
                        onComplete={() => {
                          setSelectedMatch(null);
                          setEnteringTeamId(null);
                        }}
                      />
                    ) : (
                    <DirectScoreEntry 
                      team={team}
                      match={selectedMatch}
                      onComplete={() => {
                        setSelectedMatch(null);
                        setEnteringTeamId(null);
                      }}
                    />
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PlayerPortalFixed;