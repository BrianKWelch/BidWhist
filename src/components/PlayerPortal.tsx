import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/AppContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar, Trophy, Users, Phone, Target } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const PlayerPortal = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [team, setTeam] = useState(null);
  const [error, setError] = useState('');
  const { teams, schedules, games, tournaments, tournamentResults, updateGameScore, getActiveTournament } = useAppContext();

  const handleLogin = () => {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const foundTeam = teams.find(t => {
      const teamPhone = t.phoneNumber.replace(/\D/g, '');
      return teamPhone === cleanPhone;
    });
    
    if (foundTeam) {
      setTeam(foundTeam);
      setError('');
    } else {
      setError(`No team found with phone number ${phoneNumber}. Please check the number.`);
    }
  };

  // Only show schedule for the active tournament
  const getCurrentRoundSchedule = () => {
    if (!team) return [];
    const activeTournament = getActiveTournament();
    if (!activeTournament) return [];
    const schedule = schedules.find(s => s.tournamentId === activeTournament.id);
    if (!schedule) return [];
    // Option B: Only show the current or next matchup
    if (schedule.rounds === 1 || schedule.matches.some(m => m.opponentPlaceholder)) {
      // Find the lowest round number for this team that is not confirmed as completed
      const teamMatches = schedule.matches.filter(match =>
        match.teamA === team.name || match.teamB === team.name || match.teamA === team.id || match.teamB === team.id
      );
      if (teamMatches.length === 0) return [];
      // Find the lowest round not confirmed as completed
      let currentMatch = null;
      for (let r = 1; r <= schedule.rounds; r++) {
        const match = teamMatches.find(m => m.round === r);
        if (match) {
          // Check if this match is confirmed in games
          const g = games.find(gm => gm.matchId === match.id && gm.confirmed);
          if (!g) {
            currentMatch = match;
            break;
          }
        }
      }
      // If all matches are confirmed, show the last one
      if (!currentMatch) currentMatch = teamMatches[teamMatches.length - 1];
      if (!currentMatch) return [];
      let opponent = null;
      if (currentMatch.teamA === team.name || currentMatch.teamA === team.id) opponent = currentMatch.teamB;
      else if (currentMatch.teamB === team.name || currentMatch.teamB === team.id) opponent = currentMatch.teamA;
      if ((!opponent || opponent === null) && currentMatch.opponentPlaceholder && currentMatch.opponentPlaceholder.type === 'winner') {
        opponent = `Winner of Table ${currentMatch.opponentPlaceholder.table}`;
      } else if (!opponent || opponent === null) {
        opponent = 'TBD';
      }
      return [{ ...currentMatch, tournamentName: activeTournament.name, opponent }];
    }
    // Option A or fallback: show all matches as before
    const teamMatches = schedule.matches.filter(match =>
      match.teamA === team.name || match.teamB === team.name || match.teamA === team.id || match.teamB === team.id
    );
    if (teamMatches.length === 0) return [];
    const currentRound = Math.min(...teamMatches.map(m => m.round));
    const currentRoundMatches = teamMatches.filter(m => m.round === currentRound);
    return currentRoundMatches.map(match => {
      let opponent = null;
      if (match.teamA === team.name || match.teamA === team.id) opponent = match.teamB;
      else if (match.teamB === team.name || match.teamB === team.id) opponent = match.teamA;
      if ((!opponent || opponent === null) && match.opponentPlaceholder && match.opponentPlaceholder.type === 'winner') {
        opponent = `Winner of Table ${match.opponentPlaceholder.table}`;
      } else if (!opponent || opponent === null) {
        opponent = 'TBD';
      }
      return {
        ...match,
        tournamentName: activeTournament.name,
        opponent
      };
    });
  };

  const getCurrentRoundScoreSheet = () => {
    if (!team) return [];
    const currentMatches = getCurrentRoundSchedule();
    return currentMatches.map(match => ({
      ...match,
      isMyTeam: true,
      myTeam: team.name,
      opponent: match.opponent
    }));
  };

  const getCompletedGames = () => {
    if (!team) return [];
    const activeTournament = getActiveTournament();
    if (!activeTournament) return [];
    // Find all games for this team that are confirmed and belong to the active tournament
    const schedule = schedules.find(s => s.tournamentId === activeTournament.id);
    if (!schedule) return [];
    const matchIds = new Set(schedule.matches.map(m => m.id));
    // Debug log
    console.log('team.id:', team.id, typeof team.id);
    console.log('games:', games.map(g => ({ teamA: g.teamA, typeA: typeof g.teamA, teamB: g.teamB, typeB: typeof g.teamB, matchId: g.matchId, confirmed: g.confirmed })));
    return games.filter(game =>
      (game.teamA === team.id || game.teamB === team.id) &&
      game.confirmed &&
      game.matchId && matchIds.has(game.matchId)
    );
  };

  const getTeamPerformance = () => {
    if (!team) return { wins: 0, totalGames: 0, totalPoints: 0, avgPoints: 0 };
    const completedGames = getCompletedGames();
    let wins = 0;
    let totalPoints = 0;
    completedGames.forEach(game => {
      const isTeamA = game.teamA.name === team.name;
      const myScore = isTeamA ? game.scoreA : game.scoreB;
      const opponentScore = isTeamA ? game.scoreB : game.scoreA;
      totalPoints += myScore;
      if (myScore > opponentScore) wins++;
    });
    return {
      wins,
      totalGames: completedGames.length,
      totalPoints,
      avgPoints: completedGames.length > 0 ? (totalPoints / completedGames.length).toFixed(1) : 0
    };
  };

  if (!team) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative">
        <div className="w-full flex justify-center REMOVE_ME_FILENAME" style={{ position: 'sticky', top: 0, zIndex: 999 }}>
          <span className="text-xs text-gray-400 py-2 bg-white/80 px-2 rounded shadow" style={{ zIndex: 999 }}>
            PlayerPortal.tsx
          </span>
        </div>
        {/* REMOVE_ME_FILENAME: PlayerPortal.tsx */}
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-blue-600">Team Portal</CardTitle>
            <p className="text-gray-600">Enter your team's phone number</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="555-123-4567"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="text-center"
            />
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button onClick={handleLogin} className="w-full">
              Access Team Dashboard
            </Button>
            <div className="text-xs text-gray-500">
              <p>Test numbers: 5551234567, 5551234568, 5551234569</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentSchedule = getCurrentRoundSchedule();
  const scoreSheet = getCurrentRoundScoreSheet();
  const performance = getTeamPerformance();

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="w-full flex justify-center REMOVE_ME_FILENAME" style={{ position: 'sticky', top: 0, zIndex: 999 }}>
        <span className="text-xs text-gray-400 py-2 bg-white/80 px-2 rounded shadow" style={{ zIndex: 999 }}>
          PlayerPortal.tsx
        </span>
      </div>
      {/* REMOVE_ME_FILENAME: PlayerPortal.tsx */}
      <div className="max-w-4xl mx-auto">
        <Card className="mb-6">
          <div className="w-full flex justify-center REMOVE_ME_FILENAME" style={{ position: 'sticky', top: 0, zIndex: 999 }}>
            <span className="text-xs text-gray-400 py-2 bg-white/80 px-2 rounded shadow" style={{ zIndex: 999 }}>
              TeamHeaderCard.tsx
            </span>
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team {team.teamNumber}: {team.name}
            </CardTitle>
            <p className="text-sm text-gray-600">
              {team.player1FirstName} {team.player1LastName} & {team.player2FirstName} {team.player2LastName}
            </p>
          </CardHeader>
        </Card>

        <Tabs defaultValue="schedule" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="scores">Scores</TabsTrigger>
            <TabsTrigger value="results">Results & Record</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule">
            <Card>
              <div className="w-full flex justify-center REMOVE_ME_FILENAME" style={{ position: 'sticky', top: 0, zIndex: 999 }}>
                <span className="text-xs text-blue-700 font-bold py-2 bg-blue-100 px-2 rounded shadow border border-blue-400" style={{ zIndex: 999 }}>
                  PlayerPortal.tsx
                </span>
              </div>
              {/* REMOVE_ME_FILENAME: PlayerPortal.tsx */}
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Complete Tournament Schedule
                </CardTitle>
              </CardHeader>
              <CardContent>
                {currentSchedule.length > 0 ? (
                  <div className="space-y-4">
                    {currentSchedule.map((match, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">{match.tournamentName}</p>
                            <p className="text-sm text-gray-600">Round {match.round}</p>
                          </div>
                          <div className="text-right">
                            {match.isBye ? (
                              <Badge variant="secondary">BYE</Badge>
                            ) : (
                              <p className="text-sm">vs {match.opponent}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No current games scheduled</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scores">
            <Card>
              <div className="w-full flex justify-center REMOVE_ME_FILENAME" style={{ position: 'sticky', top: 0, zIndex: 999 }}>
                <span className="text-xs text-green-700 font-bold py-2 bg-green-100 px-2 rounded shadow border border-green-400" style={{ zIndex: 999 }}>
                  ScoreEntryCard.tsx
                </span>
              </div>
              {/* REMOVE_ME_FILENAME: ScoreEntryCard.tsx */}
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Round 1 Score Sheet
                </CardTitle>
              </CardHeader>
              <CardContent>
                {scoreSheet.length > 0 ? (
                  <div className="space-y-4">
                    {scoreSheet.map((match, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <h3 className="font-medium">{match.tournamentName} - Round {match.round}</h3>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-3 bg-blue-50 rounded">
                              <p className="font-medium">{team.name}</p>
                              <p className="text-sm text-gray-600">Your Team</p>
                            </div>
                            <div className="text-center p-3 bg-gray-50 rounded">
                              <p className="font-medium">{match.opponent}</p>
                              <p className="text-sm text-gray-600">Opponent</p>
                            </div>
                          </div>
                          <p className="text-sm text-center text-gray-600">
                            Enter scores in the main tournament management system
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No current round games to score</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results">
            <Card>
              <div className="w-full flex justify-center REMOVE_ME_FILENAME" style={{ position: 'sticky', top: 0, zIndex: 999 }}>
                <span className="text-xs text-purple-700 font-bold py-2 bg-purple-100 px-2 rounded shadow border border-purple-400" style={{ zIndex: 999 }}>
                  PlayerPortal.tsx
                </span>
              </div>
              {/* REMOVE_ME_FILENAME: PlayerPortal.tsx */}
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Results & Record
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Results Section */}
                {getCompletedGames().length > 0 ? (
                  <div className="space-y-4">
                    {getCompletedGames().map((game, index) => {
                      const isTeamA = game.teamA.name === team.name;
                      const myScore = isTeamA ? game.scoreA : game.scoreB;
                      const opponentScore = isTeamA ? game.scoreB : game.scoreA;
                      const opponent = isTeamA ? game.teamB.name : game.teamA.name;
                      const won = myScore > opponentScore;
                      return (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium">vs {opponent}</p>
                              <p className="text-sm text-gray-600">
                                {myScore} - {opponentScore}
                              </p>
                            </div>
                            <Badge variant={won ? "default" : "secondary"}>
                              {won ? "WIN" : "LOSS"}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500">No completed games yet</p>
                )}
                {/* Record Section */}
                <div className="mt-8">
                  <h3 className="text-lg font-semibold mb-2">My Team Record</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{performance.wins}</p>
                      <p className="text-sm text-gray-600">Wins</p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{performance.totalGames}</p>
                      <p className="text-sm text-gray-600">Games Played</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <p className="text-2xl font-bold text-purple-600">{performance.avgPoints}</p>
                      <p className="text-sm text-gray-600">Avg Points/Game</p>
                    </div>
                    <div className="text-center p-4 bg-orange-50 rounded-lg">
                      <p className="text-2xl font-bold text-orange-600">{performance.totalPoints}</p>
                      <p className="text-sm text-gray-600">Total Points</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="record">
            {/* Record tab intentionally left empty; Results & Record are combined above */}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default PlayerPortal;