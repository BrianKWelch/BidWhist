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

const PlayerPortalFixed = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [team, setTeam] = useState<Team | null>(null);
  const [loginError, setLoginError] = useState('');
  const [testMode, setTestMode] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
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
  const { teams, schedules, games, tournaments, getActiveTournament, submitGame, confirmScore, beginScoreEntry, refreshGamesFromSupabase } = useAppContext();

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

  // Score entry functions
  const handleSubmitScore = () => {
    if (!selectedMatch || !team) return;
    
    const toNum = (v: string) => v.trim() === '' ? 0 : Number(v);
    const myScore = toNum(scoreA);
    const oppScore = toNum(scoreB);
    const myHands = toNum(handsA);
    const oppHands = toNum(handsB);
    const myBostons = toNum(bostonA);
    const oppBostons = toNum(bostonB);
    
    if (myScore === oppScore && !tieWinner) {
      toast({ title: 'Tie detected', description: 'Please select who won the tiebreaker.', variant: 'destructive' });
      return;
    }
    
    const winner = myScore > oppScore ? 'teamA' : oppScore > myScore ? 'teamB' : tieWinner;
    
    const gameData = {
      matchId: selectedMatch.id,
      teamA: selectedMatch.teamA,
      teamB: selectedMatch.teamB,
      scoreA: myScore,
      scoreB: oppScore,
      handsA: myHands,
      handsB: oppHands,
      boston_a: myBostons,
      boston_b: oppBostons,
      winner,
      submittedBy: team.id,
      round: selectedMatch.round,
      status: 'pending_confirmation',
      entered_by_team_id: team.id
    };
    
    submitGame(gameData);
    setSelectedMatch(null);
    setCurrentStep(0);
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

  const getNextStep = (currentStep: number) => {
    const activeTournament = getActiveTournament();
    const tracksHands = activeTournament?.tracksHands;
    
    if (currentStep === 0) return 1; // My score -> My hands (if tracksHands) or Opponent score
    if (currentStep === 1 && tracksHands) return 2; // My hands -> My bostons
    if (currentStep === 1 && !tracksHands) return 3; // My score -> Opponent score
    if (currentStep === 2) return 3; // My bostons -> Opponent score
    if (currentStep === 3) return 4; // Opponent score -> Opponent hands (if tracksHands) or Opponent bostons
    if (currentStep === 4 && tracksHands) return 5; // Opponent hands -> Opponent bostons
    if (currentStep === 4 && !tracksHands) return 6; // Opponent score -> Opponent bostons
    if (currentStep === 5) return 6; // Opponent hands -> Opponent bostons
    return 7; // Final step
  };

  const getPrevStep = (currentStep: number) => {
    const activeTournament = getActiveTournament();
    const tracksHands = activeTournament?.tracksHands;
    
    if (currentStep === 1) return 0;
    if (currentStep === 2) return 1;
    if (currentStep === 3) return tracksHands ? 2 : 1;
    if (currentStep === 4) return 3;
    if (currentStep === 5) return 4;
    if (currentStep === 6) return tracksHands ? 5 : 4;
    return 6;
  };

  // Force re-render when games change
  useEffect(() => {
    // This effect will run whenever games change, ensuring the component updates
  }, [games]);

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
      
      if (existingGame) {
        if (existingGame.status === 'confirmed' || existingGame.confirmed) {
          cardType = 'completed';
        } else if (existingGame.status === 'pending_confirmation') {
          if (existingGame.entered_by_team_id === team.id) {
            status = 'Waiting for opponent confirmation';
            statusMessage = 'Your score has been entered. Waiting for opponent to confirm.';
          } else {
            status = 'Pending confirmation';
            statusMessage = 'Review and confirm the score entered by your opponent.';
          }
          cardType = 'current';
        } else if (existingGame.status === 'disputed') {
          if (existingGame.entered_by_team_id === team.id) {
            status = 'Entering score';
            statusMessage = 'You are currently entering the score.';
          } else {
            status = 'Opponent entering score';
            statusMessage = 'Opponent is entering the score. Please wait.';
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
        const isWin = myScore > opponentScore;
        
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

  // REMOVE_ME: File name display for testing
  if (!team) {
    return (
      <div className="min-h-screen flex flex-col justify-between items-center bg-gradient-to-br from-black via-red-900 to-black p-4 relative">
        {/* Removed file name tag from top of page */}
        {/* Card suit background pattern */}
        <div className="absolute inset-0 opacity-10 pointer-events-none select-none bg-[url('https://upload.wikimedia.org/wikipedia/commons/5/5a/Spades.svg')] bg-center bg-repeat" style={{zIndex:0}} />
        <Card className="w-full max-w-md shadow-2xl border-4 border-black rounded-2xl bg-gradient-to-br from-black via-gray-900 to-red-900/80 backdrop-blur relative z-10">
          <CardHeader className="text-center pb-2 space-y-4">
            <div className="mx-auto w-20 h-28 flex items-center justify-center bg-gradient-to-br from-black to-red-800 rounded-xl shadow-lg border-2 border-white relative mb-2">
              <img src="/logo.png" alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%' }} />
            </div>
            <CardTitle className="text-4xl font-extrabold bg-gradient-to-r from-red-600 to-black bg-clip-text text-transparent drop-shadow-lg tracking-wide">
              Smokin' Aces
            </CardTitle>
            <div className="mb-2">
              <span className="block font-serif text-2xl text-yellow-300 font-bold drop-shadow-lg">Welcome to the 2025 Columbus Tourney!</span>
            </div>
            <p className="text-red-200 text-lg font-semibold drop-shadow">View your schedule, scores, and standings. GOOD LUCK</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="space-y-2">
                <Input
                  placeholder="Enter 10-digit phone number"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    setLoginError('');
                  }}
                  className="text-center text-lg bg-black/80 text-white border-red-500 focus:border-red-700 focus:ring-red-700"
                  maxLength={14}
                  autoFocus
                />
                <Button onClick={handleLogin} className="w-full bg-gradient-to-r from-black via-red-700 to-black hover:from-red-800 hover:to-black text-white font-bold py-3 px-4 rounded-xl shadow-xl transform transition hover:scale-105">
                  Enter My Tournaments Portal
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
                  <Crown className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium text-gray-700">Admin Access</span>
                </div>
                <div className="space-y-2">
                  <Select onValueChange={handleAdminTeamSelect}>
                    <SelectTrigger>
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
                </div>
              </div>
            )}
            {/* Credit */}
            <div className="mt-6 text-xs text-center text-red-200 font-mono tracking-wide">
              Built and Managed by Brian Welch
            </div>
          </CardContent>
        </Card>
        {/* Footer credit for extra visibility on mobile */}
        <div className="w-full text-center text-xs text-red-300 mt-4 z-10">
          Built and Managed by Brian Welch
        </div>
      </div>
    );
  }

  const teamSchedule = getTeamSchedule();
  const teamRecord = getTeamRecord;

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-red-900 to-black">
      {/* Themed Portal Header */}
      <div className="relative w-full bg-gradient-to-r from-black via-red-800 to-black shadow-lg border-b-4 border-red-700 py-4 px-2 flex flex-col items-center justify-center">
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
          {/* Ace of Spades SVG */}
          <div className="w-14 h-20 flex items-center justify-center bg-gradient-to-br from-black to-red-800 rounded-xl shadow-lg border-2 border-white relative">
            <svg width="48" height="64" viewBox="0 0 48 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="48" height="64" rx="8" fill="#fff" stroke="#000" strokeWidth="2"/>
              <text x="24" y="40" textAnchor="middle" fontSize="36" fontWeight="bold" fill="#000">🂡</text>
            </svg>
            <span className="absolute top-1 left-2 text-black text-lg font-bold">A</span>
            <span className="absolute bottom-1 right-2 text-black text-lg font-bold rotate-180">A</span>
            <span className="absolute top-5 left-3 text-black text-2xl">♠</span>
            <span className="absolute bottom-5 right-3 text-black text-2xl rotate-180">♠</span>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-red-600 to-black bg-clip-text text-transparent drop-shadow-lg tracking-wide mb-1">
            Smokin' Aces
          </h1>
          <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4">
            <span className="text-lg md:text-xl font-bold text-red-100 drop-shadow">Team {team.id}: {team.name}</span>
            <span className="text-sm text-red-200">{team.player1FirstName} {team.player1LastName} & {team.player2FirstName} {team.player2LastName}</span>
            <span className="text-xs text-red-300">Phone: {team.phoneNumber}</span>
            {testMode && <Badge variant="secondary" className="mt-1 text-xs bg-yellow-700">Test Mode</Badge>}
            {adminMode && <Badge variant="default" className="mt-1 text-xs bg-purple-700">Admin Mode</Badge>}
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
            className="text-red-600 border-white hover:bg-white hover:text-black font-bold"
          >
            Logout
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
                 {/* Tournament Name and Record Boxes */}
         <div className="mb-6">
           <div className="text-center mb-4">
             <h2 className="text-xl font-bold text-white mb-1">{getActiveTournament()?.name}</h2>
             <p className="text-sm text-gray-300">Schedule</p>
           </div>
          
          {/* Horizontal Scrollable Record Boxes */}
          <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-hide">
            <div className="flex-shrink-0 text-center p-4 bg-blue-50 rounded-lg min-w-[120px]">
              <p className="text-2xl font-bold text-blue-600">{teamRecord.wins}</p>
              <p className="text-sm text-gray-600">Wins</p>
            </div>
            <div className="flex-shrink-0 text-center p-4 bg-gray-50 rounded-lg min-w-[120px]">
              <p className="text-2xl font-bold">{teamRecord.totalGames}</p>
              <p className="text-sm text-gray-600">Games Played</p>
            </div>
            <div className="flex-shrink-0 text-center p-4 bg-green-50 rounded-lg min-w-[120px]">
              <p className="text-2xl font-bold text-green-600">{teamRecord.avgPoints}</p>
              <p className="text-sm text-gray-600">Avg Points/Game</p>
            </div>
            <div className="flex-shrink-0 text-center p-4 bg-purple-50 rounded-lg min-w-[120px]">
              <p className="text-2xl font-bold text-purple-600">{teamRecord.totalPoints}</p>
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
                                                          setCurrentStep(0);
                                                        } else {
                                                          toast({ title: 'Opponent entering score', description: 'Please wait and try again in a moment.', variant: 'destructive' });
                                                          await refreshGamesFromSupabase();
                                                        }
                                                      })();
                                                    }}
                                                  >
                                                    Score
                                                  </Button>
                                                ) : (
                                                  <Badge 
                                                    variant={match.status === 'Waiting for opponent confirmation' ? 'secondary' : 
                                                            match.status === 'Opponent entering score' ? 'destructive' : 'default'}
                                                    className="text-xs"
                                                    onClick={() => {
                                                      if (match.status === 'Pending confirmation') {
                                                        setSelectedMatch(match);
                                                        setCurrentStep(0);
                                                      }
                                                    }}
                                                  >
                                                    {match.status === 'Waiting for opponent' && <Clock className="h-3 w-3 mr-1" />}
                                                    {match.status}
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
                    <h3 className="text-lg font-semibold">Enter Score - Round {selectedMatch.round}</h3>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setSelectedMatch(null);
                        setCurrentStep(0);
                        setScoreA('');
                        setScoreB('');
                        setHandsA('');
                        setHandsB('');
                        setBostonA('0');
                        setBostonB('0');
                        setTieWinner(null);
                        setEnteringTeamId(null);
                      }}
                    >
                      ✕
                    </Button>
                  </div>

                  {/* If there's a pending confirmation for this match and this team didn't submit, show confirmation UI */}
                  {(() => {
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
                        <div className="space-y-4">
                          <div className="text-center">
                            <h4 className="font-semibold mb-2">Review Opponent's Score</h4>
                            <div className="bg-gray-50 p-4 rounded-lg">
                              <p className="text-sm mb-2">Your score: <span className="font-bold">{myScore}</span></p>
                              <p className="text-sm mb-2">Opponent score: <span className="font-bold">{oppScore}</span></p>
                              {myHands > 0 && <p className="text-sm mb-2">Your hands: <span className="font-bold">{myHands}</span></p>}
                              {oppHands > 0 && <p className="text-sm mb-2">Opponent hands: <span className="font-bold">{oppHands}</span></p>}
                              {myBostons > 0 && <p className="text-sm mb-2">Your Bostons: <span className="font-bold">{myBostons}</span></p>}
                              {oppBostons > 0 && <p className="text-sm mb-2">Opponent Bostons: <span className="font-bold">{oppBostons}</span></p>}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              onClick={() => handleConfirm(true)} 
                              className="flex-1 bg-green-600 hover:bg-green-700"
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Confirm
                            </Button>
                            <Button 
                              onClick={() => handleConfirm(false)} 
                              variant="destructive" 
                              className="flex-1"
                            >
                              Dispute
                            </Button>
                          </div>
                        </div>
                      );
                    }

                    // Step-by-step score entry
                    const activeTournament = getActiveTournament();
                    const tracksHands = activeTournament?.tracksHands;

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
                                onClick={() => setCurrentStep(getNextStep(5))} 
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
                            <h2 className="text-2xl font-bold text-blue-600">Review Your Score</h2>
                            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                              <p className="text-sm">Your score: <span className="font-bold">{scoreA}</span></p>
                              <p className="text-sm">Opponent score: <span className="font-bold">{scoreB}</span></p>
                              {tracksHands && <p className="text-sm">Your hands: <span className="font-bold">{handsA}</span></p>}
                              {tracksHands && <p className="text-sm">Opponent hands: <span className="font-bold">{handsB}</span></p>}
                              <p className="text-sm">Your Bostons: <span className="font-bold">{bostonA}</span></p>
                              <p className="text-sm">Opponent Bostons: <span className="font-bold">{bostonB}</span></p>
                            </div>
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
                                className="flex-1 bg-green-600 hover:bg-green-700"
                              >
                                Submit Score
                              </Button>
                            </div>
                          </div>
                        )}

                        {currentStep === 7 && (
                          <div className="text-center space-y-4">
                            <h2 className="text-2xl font-bold text-red-600">Tie Detected!</h2>
                            <p className="text-sm text-gray-600">The scores are equal. Who won the tiebreaker?</p>
                            <div className="flex gap-2">
                              <Button 
                                onClick={() => {
                                  setTieWinner('teamA');
                                  setCurrentStep(6);
                                }} 
                                variant={tieWinner === 'teamA' ? 'default' : 'outline'}
                                className="flex-1"
                              >
                                We Won
                              </Button>
                              <Button 
                                onClick={() => {
                                  setTieWinner('teamB');
                                  setCurrentStep(6);
                                }} 
                                variant={tieWinner === 'teamB' ? 'default' : 'outline'}
                                className="flex-1"
                              >
                                They Won
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
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