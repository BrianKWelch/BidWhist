import React, { useState, useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trophy } from 'lucide-react';

export const TournamentResults: React.FC = () => {
  const { tournaments, teams, schedules, games } = useAppContext();
  const [selectedTournament, setSelectedTournament] = useState('1');

  const tournament = tournaments.find(t => t.id === selectedTournament);
  const schedule = schedules.find(s => s.tournamentId === selectedTournament);
  const registeredTeams = useMemo(() => {
    if (!schedule) return [];
    // Get unique team IDs from the schedule
    const teamIds = Array.from(new Set(
      schedule.matches.flatMap(m => [m.teamA, m.teamB])
        .filter(id => typeof id === 'string' && id !== 'BYE' && id !== 'TBD')
    ));
    return teamIds
      .filter((id): id is string => typeof id === 'string')
      .map(id => teams.find(t => t.id === id))
      .filter((t): t is typeof teams[number] => Boolean(t));
  }, [schedule, teams]);
  const numRounds = schedule ? schedule.rounds : 5;

  // Build a matrix of results: { [teamId]: { [round]: { wl, points, boston } } }
  const resultsMatrix: Record<string, Record<number, { wl: string; points: number; boston: number }>> = {};
  registeredTeams.forEach(team => {
    if (!team) return;
    resultsMatrix[team.id] = {};
    for (let round = 1; round <= numRounds; round++) {
      // Find the match for this team in this round
      const match = schedule?.matches.find(m => m.round === round && (m.teamA === team.id || m.teamB === team.id));
      if (match) {
        const game = games.find(g => g.matchId === match.id && g.confirmed);
        if (game) {
          const isTeamA = (typeof game.teamA === 'object' ? game.teamA.id : game.teamA) === team.id;
          const myScore = isTeamA ? game.scoreA : game.scoreB;
          const oppScore = isTeamA ? game.scoreB : game.scoreA;
          const wl = myScore > oppScore ? 'W' : 'L';
          const boston = (game.boston === 'teamA' && isTeamA) || (game.boston === 'teamB' && !isTeamA) ? 1 : 0;
          resultsMatrix[team.id][round] = { wl, points: myScore, boston };
        } else {
          resultsMatrix[team.id][round] = { wl: '', points: 0, boston: 0 };
        }
      } else {
        resultsMatrix[team.id][round] = { wl: '', points: 0, boston: 0 };
      }
    }
  });

  if (!tournament || !schedule) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Tournament Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Tournament:</label>
              <select 
                className="w-full mt-1 p-2 border rounded"
                value={selectedTournament}
                onChange={(e) => setSelectedTournament(e.target.value)}
              >
                <option value="">Choose a tournament...</option>
                {tournaments.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          {tournament.name} - Results
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead rowSpan={2} className="bg-yellow-200 border border-gray-400 text-center align-middle">TEAM<br />#</TableHead>
                {Array.from({ length: numRounds }, (_, i) => (
                  <TableHead key={i} colSpan={3} className={`text-center border border-gray-400 ${i % 2 === 0 ? 'bg-pink-200' : 'bg-green-200'}`}>Round {i + 1}</TableHead>
                ))}
              </TableRow>
              <TableRow>
                {Array.from({ length: numRounds }, (_, i) => (
                  <React.Fragment key={i}>
                    <TableHead className={`text-center text-xs border border-gray-400 ${i % 2 === 0 ? 'bg-pink-200' : 'bg-green-200'}`}>Game<br />Win=W<br />Loss=L</TableHead>
                    <TableHead className={`text-center text-xs border border-gray-400 ${i % 2 === 0 ? 'bg-pink-200' : 'bg-green-200'}`}>Points</TableHead>
                    <TableHead className={`text-center text-xs border border-gray-400 ${i % 2 === 0 ? 'bg-pink-200' : 'bg-green-200'}`}>Boston</TableHead>
                  </React.Fragment>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {registeredTeams
                .sort((a, b) => a.teamNumber - b.teamNumber)
                .map(team => (
                  <TableRow key={team.id}>
                    <TableCell className="font-medium border border-gray-400 bg-yellow-100">
                      <div className="flex flex-col items-center">
                        <Badge variant="outline" className="mb-1">#{team.teamNumber}</Badge>
                        <span className="text-sm">{team.name}</span>
                      </div>
                    </TableCell>
                    {Array.from({ length: numRounds }, (_, roundIndex) => {
                      const round = roundIndex + 1;
                      const roundData = resultsMatrix[team.id][round] || { wl: '', points: 0, boston: 0 };
                      return (
                        <React.Fragment key={round}>
                          <TableCell className="text-center border border-gray-400">{roundData.wl}</TableCell>
                          <TableCell className="text-center border border-gray-400">{roundData.points}</TableCell>
                          <TableCell className="text-center border border-gray-400">{roundData.boston}</TableCell>
                        </React.Fragment>
                      );
                    })}
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};