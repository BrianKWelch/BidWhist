import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/AppContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Calendar, Trophy, Users, Target, AlertCircle, TestTube } from 'lucide-react';
import ScoreEntryCard from './ScoreEntryCard';
import type { Team } from '@/contexts/AppContext';

const PlayerPortalFixed = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [team, setTeam] = useState<Team | null>(null);
  const [loginError, setLoginError] = useState('');
  const [testMode, setTestMode] = useState(false);
  const { teams, schedules, games, tournaments } = useAppContext();

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

  const getTeamSchedule = () => {
    if (!team) return [];
    const teamSchedules: any[] = [];
    
    schedules.forEach(schedule => {
      const teamMatches = schedule.matches.filter(match => {
        return match.teamA === team.id || match.teamB === team.id;
      });
      
      teamMatches.forEach(match => {
        const tournament = tournaments.find(t => t.id === schedule.tournamentId);
        const opponentId = match.teamA === team.id ? match.teamB : match.teamA;
        const opponentTeam = teams.find(t => t.id === opponentId);
        
        teamSchedules.push({ 
          ...match, 
          tournamentName: tournament?.name || 'Unknown Tournament',
          opponentTeam
        });
      });
    });
    
    return teamSchedules.sort((a, b) => a.round - b.round);
  };

  const getTeamRecord = () => {
    const results = games.filter(game => 
      (game.teamA.id === team?.id || game.teamB.id === team?.id) && game.confirmed
    ).map(game => ({
      ...game,
      isWin: (game.teamA.id === team?.id && game.winner === 'teamA') || 
             (game.teamB.id === team?.id && game.winner === 'teamB'),
      teamScore: game.teamA.id === team?.id ? game.scoreA : game.scoreB,
      opponentScore: game.teamA.id === team?.id ? game.scoreB : game.scoreA,
      opponent: game.teamA.id === team?.id ? game.teamB : game.teamA
    }));
    
    const wins = results.filter(r => r.isWin).length;
    const totalGames = results.length;
    const totalPoints = results.reduce((sum, r) => sum + r.teamScore, 0);
    const avgPoints = totalGames > 0 ? (totalPoints / totalGames).toFixed(1) : '0.0';
    
    return { wins, totalGames, totalPoints, avgPoints, results };
  };

  if (!team) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-800">Team Portal</CardTitle>
            <p className="text-gray-600 text-sm">Access your schedule, scores, and standings</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-2">
                <Input
                  placeholder="Enter 10-digit phone number"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    setLoginError('');
                  }}
                  className="text-center text-lg"
                  maxLength={14}
                />
                <Button onClick={handleLogin} className="w-full bg-blue-600 hover:bg-blue-700">
                  Access Dashboard
                </Button>
              </div>
              {loginError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-800">{loginError}</p>
                </div>
              )}
            </div>
            
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-3">
                <TestTube className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Test Mode</span>
              </div>
              <div className="space-y-2">
                {teams.slice(0, 4).map(testTeam => (
                  <Button
                    key={testTeam.id}
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestLogin(testTeam)}
                    className="w-full justify-start text-xs"
                  >
                    Team {testTeam.teamNumber}: {testTeam.name}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const teamSchedule = getTeamSchedule();
  const teamRecord = getTeamRecord();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-600 text-white p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Team {team.teamNumber}: {team.name}</h1>
              <p className="text-blue-100 text-sm">
                {team.player1FirstName} {team.player1LastName} & {team.player2FirstName} {team.player2LastName}
              </p>
              <p className="text-blue-200 text-xs">Phone: {team.phoneNumber}</p>
              {testMode && <Badge variant="secondary" className="mt-1 text-xs">Test Mode</Badge>}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setTeam(null);
                setTestMode(false);
              }}
              className="text-blue-600 border-white hover:bg-white"
            >
              Logout
            </Button>
          </div>
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
              <CardHeader><CardTitle>Your Schedule</CardTitle></CardHeader>
              <CardContent>
                {teamSchedule.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No scheduled matches found</p>
                ) : (
                  <div className="space-y-3">
                    {teamSchedule.map((match: any, index: number) => (
                      <div key={index} className="border rounded-lg p-4 bg-white">
                        <p className="font-medium text-sm">{match.tournamentName}</p>
                        <p className="text-xs text-gray-600 mb-2">Round {match.round}</p>
                        {match.isBye ? (
                          <Badge variant="secondary">BYE ROUND</Badge>
                        ) : (
                          <p className="text-sm">vs Team {match.opponentTeam?.teamNumber || 'TBD'}</p>
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
                <CardHeader><CardTitle>Team Record</CardTitle></CardHeader>
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
                    Your Game Results
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
                      {teamRecord.results.map((game) => (
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
                                vs Team {game.opponent.teamNumber}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
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