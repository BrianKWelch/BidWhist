import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppContext } from '@/contexts/AppContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Calendar, Trophy, Users, Target, AlertCircle, TestTube, Crown } from 'lucide-react';
import ScoreEntryCard from './ScoreEntryCard';
import type { Team } from '@/contexts/AppContext';

const PlayerPortalFixed = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [team, setTeam] = useState<Team | null>(null);
  const [loginError, setLoginError] = useState('');
  const [testMode, setTestMode] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const { teams, schedules, games, tournaments, getActiveTournament } = useAppContext();

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
      String(match.teamA) === String(team.id) || String(match.teamB) === String(team.id)
    );
    return teamMatches.map(match => {
      const opponentId = String(match.teamA) === String(team.id) ? match.teamB : match.teamA;
      const opponentTeam = teams.find(t => String(t.id) === String(opponentId));
      return {
        ...match,
        tournamentName: activeTournament.name,
        opponentTeam
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
  const activeTournament = getActiveTournament();

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
                {/* Removed file name tag from top of My Tournament Schedule card */}
              <CardHeader><CardTitle>My Tournament Schedule</CardTitle></CardHeader>
              <CardContent>
                {teamSchedule.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <p>No scheduled matches found</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Group matches by tournament */}
                    {Array.from(new Set(teamSchedule.map(match => match.tournamentName))).map(tournamentName => {
                      const tournamentMatches = teamSchedule.filter(match => match.tournamentName === tournamentName);
                      const maxRound = Math.max(...tournamentMatches.map(m => m.round));
                      
                      return (
                        <div key={tournamentName} className="space-y-4">
                          <div className="border-b pb-2">
                            <h3 className="font-semibold text-lg">{tournamentName}</h3>
                            <p className="text-sm text-gray-600">{tournamentMatches.length} matches • {maxRound} rounds</p>
                          </div>
                          
                          {/* Show all rounds for this tournament */}
                          {Array.from({ length: maxRound }, (_, i) => i + 1).map(round => {
                            const roundMatches = tournamentMatches.filter(match => match.round === round);
                            return (
                              <div key={round} className="space-y-3">
                                {/* Removed the outer round header, move round badge inside each match card */}
                                <div className="space-y-3">
                                  {roundMatches.map((match: any, index: number) => (
                                    <div key={index} className={`border rounded-lg p-4 ${
                                      match.isBye ? 'bg-yellow-50 border-yellow-200' : 'bg-white'
                                    }`}>
                                      <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-2">
                                            {/* Round badge now inside the card */}
                                            <Badge variant="outline" className="font-medium">
                                              Round {round}
                                            </Badge>
                                            {match.table && match.table > 0 && (
                                              <Badge variant="secondary" className="text-xs">
                                                Table {match.table}
                                              </Badge>
                                            )}
                                          </div>
                                          {match.isBye ? (
                                            <div className="text-center">
                                              <Badge variant="secondary" className="text-sm">BYE ROUND</Badge>
                                              <p className="text-xs text-gray-600 mt-1">No game this round</p>
                                            </div>
                                          ) : (
                                            <div>
                                              <p className="text-sm font-medium">
                                                My team plays{' '}
                                                {match.opponentTeam ? (
                                                  (() => {
                                                    let teamNum = 'TBD';
                                                    if (match.opponentTeam.teamNumber) {
                                                      teamNum = `Team # ${match.opponentTeam.teamNumber}`;
                                                    } else if (match.opponentTeam.id) {
                                                      teamNum = `Team # ${match.opponentTeam.id}`;
                                                    }
                                                    const p1 = (match.opponentTeam.player1_first_name || '').trim();
                                                    const p2 = (match.opponentTeam.player2_first_name || '').trim();
                                                    const city = match.opponentTeam.city;
                                                    let nameStr = '';
                                                    if (p1 && p2) {
                                                      nameStr = `${p1} & ${p2}`;
                                                    } else if (p1) {
                                                      nameStr = p1;
                                                    } else if (p2) {
                                                      nameStr = p2;
                                                    }
                                                    if (nameStr) {
                                                      return (
                                                        <>
                                                          <span className="font-bold text-red-600">{teamNum}</span>
                                                          <span className="text-xs text-gray-700 font-semibold ml-1">
                                                            {nameStr}{city ? ` - ${city}` : ''}
                                                          </span>
                                                        </>
                                                      );
                                                    } else {
                                                      return (
                                                        <span className="font-bold text-red-600">{teamNum}</span>
                                                      );
                                                    }
                                                  })()
                                                ) : (
                                                  <span className="font-bold text-red-600">TBD</span>
                                                )}
                                              </p>
                                              {/* No extra opponent name row */}
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
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{teamRecord.wins}</p>
                      <p className="text-sm text-gray-600">Wins</p>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold">{teamRecord.totalGames}</p>
                      <p className="text-sm text-gray-600">Games Played</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{teamRecord.avgPoints}</p>
                      <p className="text-sm text-gray-600">Avg Points/Game</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <p className="text-2xl font-bold text-purple-600">{teamRecord.totalPoints}</p>
                      <p className="text-sm text-gray-600">Total Points</p>
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
                        if (game.opponent && typeof game.opponent === 'object') {
                          if (game.opponent.teamNumber) {
                            teamNum = `Team ${game.opponent.teamNumber}`;
                          } else if (game.opponent.id) {
                            teamNum = `Team ${game.opponent.id}`;
                          }
                          if ((!game.opponent.teamNumber || game.opponent.teamNumber === 'undefined') && game.opponent.id) {
                            teamNum = `Team ${game.opponent.id}`;
                          }
                          const p1 = (game.opponent.player1_first_name || '').trim();
                          const p2 = (game.opponent.player2_first_name || '').trim();
                          city = game.opponent.city || '';
                          if (p1 && p2) {
                            nameStr = `${p1} & ${p2}`;
                          } else if (p1) {
                            nameStr = p1;
                          } else if (p2) {
                            nameStr = p2;
                          }
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