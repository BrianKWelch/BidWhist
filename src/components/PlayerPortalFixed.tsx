import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppContext } from '@/contexts/AppContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Calendar, Trophy, Users, Target, AlertCircle, TestTube, Crown } from 'lucide-react';
import ScoreEntryCard from './ScoreEntryCard';
import type { Team } from '@/contexts/AppContext';

const PlayerPortalFixed = () => {
  const [adminTeamNumber, setAdminTeamNumber] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('portalPhone') || '';
    }
    return '';
  });
  const [team, setTeam] = useState<Team | null>(null);
  const [loginError, setLoginError] = useState('');
  const [testMode, setTestMode] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const { teams, schedules, games, tournaments, getActiveTournament, scoreSubmissions, refreshGamesFromSupabase, refreshSchedules } = useAppContext();

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
      if (typeof window !== 'undefined') {
        localStorage.setItem('portalPhone', cleanPhone);
      }
    } else {
      setLoginError('Team not found. Please check your phone number.');
    }
  };

  const handleTestLogin = (testTeam: Team) => {
    setTeam(testTeam);
    setTestMode(true);
  };

  const handleAdminNumberLogin = () => {
    setLoginError('');
    const num = parseInt(adminTeamNumber.trim(), 10);
    if (isNaN(num)) {
      setLoginError('Enter a valid team number');
      return;
    }
    const selectedTeam = teams.find(t => Number(t.teamNumber) === num || Number(t.id) === num);
    if (selectedTeam) {
      setTeam(selectedTeam);
      setAdminMode(true);
    } else {
      setLoginError('Team not found');
    }
  };

  const handleAdminTeamSelect = (teamId: string) => {
    setAdminTeamNumber('');
    const selectedTeam = teams.find(t => String(t.id) === String(teamId));
    if (selectedTeam) {
      setTeam(selectedTeam);
      setAdminMode(true);
    }
  };

  const [refreshing, setRefreshing] = useState(false);
  const handlePortalRefresh = async () => {
    try {
      setRefreshing(true);
      await refreshGamesFromSupabase();
      await refreshSchedules();
    } finally {
      setRefreshing(false);
    }
  };

  // Auto-login if phone stored and matches a team
  React.useEffect(() => {
    if (!team && phoneNumber.length === 10) {
      handleLogin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Force re-render when games change
  useEffect(() => {
    // This effect will run whenever games change, ensuring the component updates
  }, [games]);

  const activeTournament = getActiveTournament();

  // Only show schedule for the active tournament
  const getTeamSchedule = () => {
    if (!team) return [];
    if (!activeTournament) return [];
    const schedule = schedules.find(s => s.tournamentId === activeTournament.id);
    if (!schedule) return [];

    const isOptionB = schedule.matches.some(m => m.opponentPlaceholder) || schedule.rounds < 2;

    const teamMatches = schedule.matches.filter(match =>
      String(match.teamA) === String(team.id) || String(match.teamB) === String(team.id)
    ).sort((a, b) => a.round - b.round);

    if (!isOptionB) {
      // Option A: Show all
      return teamMatches.map(processMatch);
    }

    // Option B: Show completed + next pending
    const processed = [];
    let nextPending = null;
    for (const match of teamMatches) {
      const completedGame = games.find(g => g.matchId === match.id && g.confirmed);
      if (completedGame) {
        processed.push(processMatch(match, true));
      } else if (!nextPending) {
        nextPending = processMatch(match, false);
      }
    }
    if (nextPending) processed.push(nextPending);
    return processed;
  };

  function processMatch(match, isCompleted) {
    const opponentId = String(match.teamA) === String(team.id) ? match.teamB : match.teamA;
    let opponentTeam = teams.find(t => String(t.id) === String(opponentId));
    let opponentDisplay = opponentTeam ? `Team ${opponentTeam.teamNumber || opponentTeam.id}` : 'TBD';

    // If this match is a bye for the team, show 'BYE' instead of 'TBD'
    if (match.isBye) {
      opponentDisplay = 'BYE';
    }

    if (match.opponentPlaceholder && !opponentTeam) {
      opponentDisplay = `Winner of Table ${match.opponentPlaceholder.table}`;
    }

    // Check game status
    const completedGame = games.find(g => g.matchId === match.id && g.confirmed);
    const submissions = scoreSubmissions.filter(s => s.matchId === match.id);
    const mySubmission = submissions.find(s => String(s.submittedBy) === String(team.id));
    const opponentSubmission = submissions.find(s => String(s.submittedBy) !== String(team.id));
    
    let gameStatus = 'pending';
    let statusMessage = '';
    let statusColor = 'bg-blue-100 border-blue-300 text-blue-800';
    
    if (completedGame) {
      gameStatus = 'completed';
      const winnerId = completedGame.scoreA > completedGame.scoreB ? match.teamA : match.teamB;
      const winner = teams.find(t => String(t.id) === String(winnerId));
      const winnerScore = Math.max(completedGame.scoreA, completedGame.scoreB);
      const loserScore = Math.min(completedGame.scoreA, completedGame.scoreB);
      statusMessage = `Completed - Team ${winner?.teamNumber || winner?.id || 'Unknown'} won ${winnerScore}-${loserScore}`;
      statusColor = 'bg-green-100 border-green-300 text-green-800';
    } else if (submissions.length === 2) {
      const scoresMatch = submissions[0].scoreA === submissions[1].scoreA && 
                         submissions[0].scoreB === submissions[1].scoreB;
      if (scoresMatch) {
        gameStatus = 'confirming';
        statusMessage = 'Confirming scores';
        statusColor = 'bg-orange-100 border-orange-300 text-orange-800';
      } else {
        gameStatus = 'conflict';
        statusMessage = 'Score conflict - needs resolution';
        statusColor = 'bg-red-100 border-red-300 text-red-800';
      }
    } else if (mySubmission) {
      gameStatus = 'waiting';
      statusMessage = 'Waiting for opponent score';
      statusColor = 'bg-yellow-100 border-yellow-300 text-yellow-800';
    }
    
    return {
      ...match,
      tournamentName: activeTournament.name,
      opponentTeam,
      opponentDisplay,
      gameStatus,
      statusMessage,
      statusColor,
      completedGame
    };
  }

  // Only show results for the active tournament
  const getTeamRecord = useMemo(() => {
    if (!team || !activeTournament) return { wins: 0, totalGames: 0, totalPoints: 0, avgPoints: '0.0', results: [] };
    const schedule = schedules.find(s => s.tournamentId === activeTournament.id);
    if (!schedule) return { wins: 0, totalGames: 0, totalPoints: 0, avgPoints: '0.0', results: [] };
    const matchIds = new Set(schedule.matches.map(m => m.id));
    const results = games.filter(game =>
      (game.teamA === String(team.id) || game.teamB === String(team.id)) &&
      game.confirmed &&
      game.matchId && matchIds.has(game.matchId)
    ).map(game => {
      const isTeamA = game.teamA === String(team.id);
      const opponentId = isTeamA ? game.teamB : game.teamA;
      const opponent = teams.find(t => String(t.id) === opponentId) || null;
      return {
        ...game,
        isWin: (isTeamA && game.winner === 'teamA') || (!isTeamA && game.winner === 'teamB'),
        teamScore: isTeamA ? game.scoreA : game.scoreB,
        opponentScore: isTeamA ? game.scoreB : game.scoreA,
        teamHands: isTeamA ? (game.handsA ?? 0) : (game.handsB ?? 0),
        opponent
      };
    });
    const wins = results.filter(r => r.isWin).length;
    const totalGames = results.length;
    const totalPoints = results.reduce((sum, r) => sum + r.teamScore, 0);
    const totalHands = results.reduce((sum, r) => sum + (r.teamHands ?? 0), 0);
    const avgPoints = totalGames > 0 ? (totalPoints / totalGames).toFixed(1) : '0.0';
    const avgHands = totalGames > 0 ? (totalHands / totalGames).toFixed(1) : '0.0';
    return { wins, totalGames, totalPoints, avgPoints, totalHands, avgHands, results };
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
            <div className="mx-auto w-40 h-56 flex items-center justify-center bg-gradient-to-br from-black to-red-800 rounded-xl shadow-lg relative mb-2">
              <img src={import.meta.env.BASE_URL + 'SetPlay_Logo.png'} alt="SetPlay Logo" style={{ maxWidth: '100%', maxHeight: '100%' }} />
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
                  <div className="space-y-2 mb-4">
                    <Label>Enter Team Number</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={adminTeamNumber}
                        onChange={(e) => setAdminTeamNumber(e.target.value)}
                        placeholder="e.g. 7"
                        className="flex-1"
                      />
                      <Button onClick={handleAdminNumberLogin} disabled={!adminTeamNumber.trim()}>
                        Go
                      </Button>
                    </div>
                  </div>

                  <Label>Select from list</Label>
                  <Select onValueChange={handleAdminTeamSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select any team to view their portal" />
                    </SelectTrigger>
                    <SelectContent>
                      {[...teams]
                        .sort((a, b) => (Number(a.teamNumber ?? a.id) - Number(b.teamNumber ?? b.id)))
                        .map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          Team {team.teamNumber ?? team.id}: {team.name} ({team.city})
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
  // Determine if final round is BYE ROUND
  const scheduleObj = schedules.find(s => String(s.tournamentId) === String(activeTournament?.id));
  const lastRound = scheduleObj ? Math.max(...scheduleObj.matches.map(m => m.round)) : 0;
  const tournamentTeams = teams.filter(t => t.registeredTournaments?.includes(activeTournament?.id));
  const isOddTeams = tournamentTeams.length % 2 === 1;
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
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePortalRefresh}
            disabled={refreshing}
            className="text-green-600 border-white hover:bg-white hover:text-black font-bold"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              setTeam(null);
              setTestMode(false);
              setAdminMode(false);
              setSelectedTeamId('');
              if (typeof window !== 'undefined') {
                localStorage.removeItem('portalPhone');
              }
              setPhoneNumber('');
            }}
            className="text-red-600 border-white hover:bg-white hover:text-black font-bold"
          >
            Logout
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        <Tabs defaultValue="scores" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="scores"><Target className="h-4 w-4 mr-1" />Scores</TabsTrigger>
            <TabsTrigger value="schedule"><Calendar className="h-4 w-4 mr-1" />Schedule</TabsTrigger>
            <TabsTrigger value="results"><Trophy className="h-4 w-4 mr-1" />Results & Record</TabsTrigger>
          </TabsList>

          <TabsContent value="scores">
            <ScoreEntryCard team={team} />
          </TabsContent>

          <TabsContent value="schedule">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  My Tournament Schedule
                </CardTitle>
                {activeTournament?.name && (
                  <div className="text-blue-600 text-xl font-bold mt-1">
                    {activeTournament.name}
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {teamSchedule.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <p>No scheduled matches found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {teamSchedule.map((match: any, index: number) => (
                      <div key={index} className={`p-4 border rounded-lg ${match.statusColor} relative`}>
                        <div className="flex flex-col items-center mb-2">
                          <span className="font-bold text-base text-black">
                            Table {match.table || '?'}
                          </span>
                          <div className="flex w-full justify-between items-center">
                            <div className="text-left flex-1">
                              <div className="font-bold text-base">Team {team.teamNumber || team.id}</div>
                              <div className="text-sm">{team.name}</div>
                              <div className="text-xs text-gray-500">{team.city}</div>
                            </div>
                            <div className="text-center px-4 font-bold text-lg">vs</div>
                            <div className="text-right flex-1">
                              {match.opponentTeam ? (
                                <>
                                  <div className="font-bold text-base">Team {match.opponentTeam.teamNumber || match.opponentTeam.id}</div>
                                  <div className="text-sm">{match.opponentTeam.name}</div>
                                  <div className="text-xs text-gray-500">{match.opponentTeam.city}</div>
                                </>
                              ) : (
                                match.opponentDisplay
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-center items-center gap-2 mt-2">
                          {/* Round badge: show yellow pill with 'Round X - BYE ROUND' if round > activeTournament.rounds */}
                          {(isOddTeams && match.round === lastRound) ? (
                            <Badge variant="outline" className="text-xs px-2 py-1 bg-yellow-100 border-yellow-300 text-yellow-800">
                              {`Round ${match.round} - BYE ROUND`}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs px-2 py-1">
                              {`Round ${match.round}`}
                            </Badge>
                          )}
                          {/* BYE message: bottom right, italic, red, no pill */}
                          {match.isBye && (
                            <div className="text-red-600 italic text-sm absolute right-4 bottom-2">
                              Completed - BYE
                            </div>
                          )}
                          {match.gameStatus === 'confirming' && (
                            <Badge variant="outline" className="text-xs px-2 py-1 bg-orange-100 border-orange-300 text-orange-800">
                              {match.statusMessage}
                            </Badge>
                          )}
                          {match.gameStatus === 'waiting' && (
                            <Badge variant="outline" className="text-xs px-2 py-1 bg-yellow-100 border-yellow-300 text-yellow-800">
                              {match.statusMessage}
                            </Badge>
                          )}
                          {match.gameStatus === 'conflict' && (
                            <Badge variant="outline" className="text-xs px-2 py-1 bg-red-100 border-red-300 text-red-800">
                              {match.statusMessage}
                            </Badge>
                          )}
                        </div>
                        {/* Completed status message: bottom left, italic, red, no pill */}
                        {match.gameStatus === 'completed' && (
                          <div className="text-red-600 italic text-sm absolute right-4 bottom-2">
                            {match.statusMessage}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results">
            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>My Team Record</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="order-1 text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{teamRecord.wins}</p>
                      <p className="text-sm text-gray-600">Wins</p>
                    </div>
                    <div className="order-4 text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold">{teamRecord.totalGames}</p>
                      <p className="text-sm text-gray-600">Games Played</p>
                    </div>
                    <div className="order-6 text-center p-4 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{teamRecord.avgPoints}</p>
                      <p className="text-sm text-gray-600">Avg Points/Game</p>
                    </div>
                    <div className="order-3 text-center p-4 bg-purple-50 rounded-lg">
                      <p className="text-2xl font-bold text-purple-600">{teamRecord.totalPoints}</p>
                      <p className="text-sm text-gray-600">Total Points</p>
                    </div>
                    <div className="order-2 text-center p-4 bg-teal-50 rounded-lg">
                      <p className="text-2xl font-bold text-teal-600">{teamRecord.totalHands}</p>
                      <p className="text-sm text-gray-600">Total Hands Won</p>
                    </div>
                    <div className="order-5 text-center p-4 bg-amber-50 rounded-lg">
                      <p className="text-2xl font-bold text-amber-600">{teamRecord.avgHands}</p>
                      <p className="text-sm text-gray-600">Avg Hands/Game</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    My Game Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {teamRecord.results.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Trophy className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p className="font-medium">No completed games yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {teamRecord.results.map((game) => {
                        let teamNum = 'TBD';
                        let nameStr = '';
                        let city = '';
                        if (game.opponent && typeof game.opponent === 'object' && 'id' in game.opponent) {
                          teamNum = `Team ${game.opponent.teamNumber ?? game.opponent.id}`;
                          nameStr = game.opponent.name ?? '';
                          city = game.opponent.city ?? '';
                        }
                        if (!teamNum || teamNum.toLowerCase().includes('unknown') || teamNum === 'undefined') {
                          teamNum = 'TBD';
                        }
                        return (
                          <div 
                            key={game.id} 
                            className={`p-4 rounded-lg border ${
                              game.isWin 
                                ? 'bg-green-50 border-green-200' 
                                : 'bg-red-50 border-red-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Badge variant="outline">Round {game.round}</Badge>
                                <span className={`font-semibold ${
                                  game.isWin ? 'text-green-700' : 'text-red-700'
                                }`}>
                                  {game.isWin ? 'WIN' : 'LOSS'}
                                </span>
                                <span className="font-bold">
                                  {game.teamScore} - {game.opponentScore}
                                </span>
                                <span className="text-sm text-gray-600">
                                  vs <span className="font-bold text-red-600">{teamNum}</span>
                                  {nameStr && (
                                    <span className="text-xs text-gray-700 font-semibold ml-1">
                                      {nameStr}{city ? ` - ${city}` : ''}
                                    </span>
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default PlayerPortalFixed;