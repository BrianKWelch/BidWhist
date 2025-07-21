import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppContext } from '@/contexts/AppContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Calendar, Trophy, Users, Target, TestTube } from 'lucide-react';
import ScoreEntryCard from './ScoreEntryCard';
import type { Team } from '@/contexts/AppContext';

const PlayerPortalEnhanced = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [team, setTeam] = useState<Team | null>(null);
  const [isTestMode, setIsTestMode] = useState(false);
  const { teams, schedules, games, tournaments, tournamentResults, getActiveTournament, setActiveTournament } = useAppContext();
  const [localActiveTournamentId, setLocalActiveTournamentId] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setIsTestMode(urlParams.get('test') === 'true');
    // Sync activeTournamentId from URL or localStorage
    const urlTid = urlParams.get('tournament') || null;
    const storedTid = localStorage.getItem('activeTournamentId');
    if (urlTid) {
      setActiveTournament(urlTid);
      setLocalActiveTournamentId(urlTid);
    } else if (storedTid) {
      setActiveTournament(storedTid);
      setLocalActiveTournamentId(storedTid);
    }
  }, [setActiveTournament]);

  // Keep localActiveTournamentId in sync with context
  useEffect(() => {
    const active = getActiveTournament();
    if (active && active.id !== localActiveTournamentId) {
      setLocalActiveTournamentId(active.id);
      localStorage.setItem('activeTournamentId', active.id);
    }
  }, [getActiveTournament, localActiveTournamentId]);

  const handleLogin = () => {
    // Clean phone number input and find team
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const foundTeam = teams.find(t => {
      const teamPhone = t.phoneNumber.replace(/\D/g, '');
      return teamPhone === cleanPhone;
    });
    if (foundTeam) {
      setTeam(foundTeam);
    }
  };

  const handleTestTeamSelect = (teamId: string) => {
    const foundTeam = teams.find(t => t.id === teamId);
    if (foundTeam) {
      setTeam(foundTeam);
    }
  };

  const getTeamSchedule = () => {
    if (!team) return [];
    const activeTournament = getActiveTournament();
    if (!activeTournament) return [];
    const schedule = schedules.find(s => s.tournamentId === activeTournament.id);
    if (!schedule) return [];
    const teamMatches = schedule.matches.filter(match => {
      const teamAMatch = match.teamA === team.name || match.teamA === team.id || match.teamA === `Team ${team.teamNumber}`;
      const teamBMatch = match.teamB === team.name || match.teamB === team.id || match.teamB === `Team ${team.teamNumber}`;
      return teamAMatch || teamBMatch;
    });
    return teamMatches.map(match => {
      const opponentName = (match.teamA === team.name || match.teamA === team.id || match.teamA === `Team ${team.teamNumber}`) ? match.teamB : match.teamA;
      const opponentTeam = teams.find(t => t.name === opponentName || t.id === opponentName || `Team ${t.teamNumber}` === opponentName);
      return {
        ...match,
        tournamentName: activeTournament.name,
        opponentTeam
      };
    }).sort((a, b) => a.round - b.round);
  };

  if (!team) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 relative">
        <div className="w-full flex justify-center REMOVE_ME_FILENAME" style={{ position: 'sticky', top: 0, zIndex: 999 }}>
          <span className="text-xs text-gray-400 py-2 bg-white/80 px-2 rounded shadow" style={{ zIndex: 999 }}>
            PlayerPortalEnhanced.tsx
          </span>
        </div>
        {/* REMOVE_ME_FILENAME: PlayerPortalEnhanced.tsx */}
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-800">
              Team Portal
              {isTestMode && <Badge variant="secondary" className="ml-2"><TestTube className="h-3 w-3 mr-1" />Test</Badge>}
            </CardTitle>
            <p className="text-gray-600 text-sm">Access your schedule, scores, and standings</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {isTestMode ? (
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800 font-medium">Test Mode Active</p>
                  <p className="text-xs text-yellow-700">Select any team to test the portal</p>
                </div>
                {teams.length > 0 ? (
                  <Select onValueChange={handleTestTeamSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a team to test" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          Team {team.teamNumber}: {team.name} ({team.phoneNumber})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800">No teams found. Please add teams first.</p>
                    <p className="text-xs text-red-700 mt-1">Go to the main page and use Team Setup to add teams.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  placeholder="Enter your team's phone number (10 digits)"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="text-center text-lg"
                  maxLength={14}
                />
                <Button onClick={handleLogin} className="w-full bg-blue-600 hover:bg-blue-700">
                  Access Dashboard
                </Button>
                {phoneNumber && !team && phoneNumber.replace(/\D/g, '').length >= 10 && (
                  <p className="text-sm text-red-600 text-center">Team not found. Please check your phone number.</p>
                )}
                {phoneNumber && phoneNumber.replace(/\D/g, '').length < 10 && phoneNumber.replace(/\D/g, '').length > 0 && (
                  <p className="text-sm text-gray-500 text-center">Please enter a 10-digit phone number.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeTournament = getActiveTournament();
  // Tournament selector UI if multiple tournaments
  const handleTournamentChange = (tid: string) => {
    setActiveTournament(tid);
    setLocalActiveTournamentId(tid);
    localStorage.setItem('activeTournamentId', tid);
  };
  if (!activeTournament) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full shadow-lg">
          <CardHeader>
            <CardTitle>No Active Tournament</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 text-center">There is currently no active tournament. Please check back later.</p>
            {tournaments.length > 1 && (
              <div className="mt-4">
                <Select value={localActiveTournamentId || undefined} onValueChange={handleTournamentChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Tournament" />
                  </SelectTrigger>
                  <SelectContent>
                    {tournaments.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full flex justify-center REMOVE_ME_FILENAME" style={{ position: 'sticky', top: 0, zIndex: 999 }}>
        <span className="text-xs text-gray-400 py-2 bg-white/80 px-2 rounded shadow" style={{ zIndex: 999 }}>
          PlayerPortalEnhanced.tsx
        </span>
      </div>
      {/* REMOVE_ME_FILENAME: PlayerPortalEnhanced.tsx */}
      <div className="bg-blue-600 text-white p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">
                Team {team.teamNumber}: {team.name}
                {isTestMode && <Badge variant="secondary" className="ml-2 bg-yellow-500"><TestTube className="h-3 w-3 mr-1" />Test</Badge>}
              </h1>
              <p className="text-blue-100 text-sm">
                {(team.player1_first_name || team.player1FirstName)} {(team.player1_last_name || team.player1LastName)} & {(team.player2_first_name || team.player2FirstName)} {(team.player2_last_name || team.player2LastName)}
              </p>
              <p className="text-blue-200 text-xs">Phone: {(team.phone_Number || team.phoneNumber)}</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setTeam(null)}
              className="text-blue-600 border-white hover:bg-white"
            >
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        <Tabs defaultValue="schedule" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
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
            <TabsTrigger value="standings" className="text-xs sm:text-sm">
              <Users className="h-4 w-4 mr-1" />
              Standings
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
                      {isTestMode && (
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
                                {(match.opponentTeam.player1_first_name || match.opponentTeam.player1FirstName)} {(match.opponentTeam.player1_last_name || match.opponentTeam.player1LastName)} & {(match.opponentTeam.player2_first_name || match.opponentTeam.player2FirstName)} {(match.opponentTeam.player2_last_name || match.opponentTeam.player2LastName)}
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

          <TabsContent value="standings">
            <Card>
              <CardHeader>
                <CardTitle>Tournament Standings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-gray-500 py-8">No tournament results yet</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default PlayerPortalEnhanced;