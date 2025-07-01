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
        <Tabs defaultValue="schedule" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="schedule" className="text-xs sm:text-sm">
              <Calendar className="h-4 w-4 mr-1" />
              Schedule
            </TabsTrigger>
            <TabsTrigger value="score" className="text-xs sm:text-sm">
              <Target className="h-4 w-4 mr-1" />
              Score
            </TabsTrigger>
            <TabsTrigger value="results" className="text-xs sm:text-sm">
              <Trophy className="h-4 w-4 mr-1" />
              Results
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedule">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Your Schedule
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {getTeamSchedule().length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500 mb-2">No scheduled matches found</p>
                      <p className="text-sm text-gray-400">Matches will appear here once tournaments are scheduled</p>
                      {testMode && (
                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-xs text-blue-800">Debug: {schedules.length} schedules found, {teams.length} teams total</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    getTeamSchedule().map((match: any, index: number) => (
                      <div key={index} className={`border rounded-lg p-4 ${
                        match.isBye ? 'bg-yellow-50 border-yellow-200' : 'bg-white'
                      }`}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{match.tournamentName}</p>
                            <p className="text-xs text-gray-600 mb-2">Round {match.round}</p>
                            {match.isBye ? (
                              <Badge variant="secondary" className="text-xs">BYE ROUND</Badge>
                            ) : (
                              <div>
                                <p className="text-sm font-medium">
                                  vs Team {match.opponentTeam?.teamNumber || 'TBD'}
                                </p>
                                {match.opponentTeam && (
                                  <p className="text-xs text-gray-600">
                                    {match.opponentTeam.player1FirstName} {match.opponentTeam.player1LastName} & {match.opponentTeam.player2FirstName} {match.opponentTeam.player2LastName}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                          {match.table && (
                            <Badge variant="outline" className="text-xs">
                              Table {match.table}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="score">
            <ScoreEntryCard team={team} />
          </TabsContent>

          <TabsContent value="results">
            <Card>
              <CardHeader>
                <CardTitle>Game Results</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-gray-500 py-8">No games played yet</p>
              </CardContent>
            </Card>
          </TabsContent>


        </Tabs>
      </div>
    </div>
  );
};

export default PlayerPortalFixed;