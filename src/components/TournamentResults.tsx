import React, { useState, useMemo, useEffect } from 'react';
// Helper to get override key
const getOverrideKey = (teamId: string, round: number | 'total', field: string) => `${teamId}_${round}_${field}`;
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trophy } from 'lucide-react';
import { getSortedTournamentResults } from '@/lib/utils';

interface TournamentResultsProps {
  tournamentId?: string;
}


export const TournamentResults: React.FC<TournamentResultsProps> = ({ tournamentId }) => {
  const { tournaments, teams, schedules, games, clearTournamentResults, submitGame, scoreSubmissions, resetAllTournamentData, setGames, setScoreSubmissions, tournamentResults, setTournamentResults } = useAppContext();
  const [selectedTournament, setSelectedTournament] = useState(tournamentId || '1');
  const effectiveTournamentId = tournamentId || selectedTournament;
  const [sortByWins, setSortByWins] = useState(true);

  // Editable overrides: { [key]: value }
  const [overrides, setOverrides] = useState<{ [key: string]: string }>({});
  // Force refresh after simulating confirmation
  const [refreshKey, setRefreshKey] = useState(0);

  // Load overrides from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('resultsOverrides');
    if (saved) setOverrides(JSON.parse(saved));
  }, []);

  // Save overrides to localStorage on change
  useEffect(() => {
    localStorage.setItem('resultsOverrides', JSON.stringify(overrides));
  }, [overrides]);

  // Refresh on games or scoreSubmissions change
  useEffect(() => {
    setRefreshKey(k => k + 1);
  }, [games, scoreSubmissions]);

  const tournament = tournaments.find(t => t.id === effectiveTournamentId);
  const schedule = schedules.find(s => s.tournamentId === effectiveTournamentId);
  const registeredTeams = useMemo(() => {
    if (!schedule) return [];
    // Get unique team IDs from the schedule, normalize to string
    const teamIds = Array.from(new Set(
      schedule.matches.flatMap(m => [m.teamA, m.teamB])
        .filter(id => id !== 'BYE' && id !== 'TBD')
        .map(id => (typeof id === 'object' && id && 'id' in id ? String(id.id) : String(id)))
    ));
    return teamIds
      .map(id => teams.find(t => String(t.id) === id))
      .filter((t): t is typeof teams[number] => Boolean(t));
  }, [schedule, teams]);
  const numRounds = schedule ? schedule.rounds : 5;

  // Auto-clear overrides for a team/round if a confirmed game exists for that team/round
  useEffect(() => {
    if (!schedule) return;
    setOverrides(prev => {
      let changed = false;
      const newOverrides = { ...prev };
      registeredTeams.forEach(team => {
        for (let round = 1; round <= numRounds; round++) {
        const match = schedule.matches.find(m => {
          const teamAId = typeof m.teamA === 'object' && m.teamA && 'id' in m.teamA ? String(m.teamA.id) : String(m.teamA);
          const teamBId = typeof m.teamB === 'object' && m.teamB && 'id' in m.teamB ? String(m.teamB.id) : String(m.teamB);
          return m.round === round && (teamAId === String(team.id) || teamBId === String(team.id));
        });
          if (!match) continue;
          const matchTeamIds = [match.teamA, match.teamB]
            .map(id => {
              if (id === null || id === undefined) return '';
              if (typeof id === 'object' && id && 'id' in id && (id as any).id != null) {
                return String((id as any).id);
              }
              return String(id);
            })
            .filter(Boolean)
            .sort();
          const game = games.find(g => {
            if (!g.confirmed || g.round !== match.round) return false;
            const gameTeamAId = typeof g.teamA === 'object' ? g.teamA.id : g.teamA;
            const gameTeamBId = typeof g.teamB === 'object' ? g.teamB.id : g.teamB;
            const gameTeamIds = [String(gameTeamAId), String(gameTeamBId)].sort();
            return (
              matchTeamIds[0] === gameTeamIds[0] &&
              matchTeamIds[1] === gameTeamIds[1]
            );
          });
          if (game) {
            // If a confirmed game exists, clear overrides for this team/round
            const keys = [
              getOverrideKey(team.id, round, 'wl'),
              getOverrideKey(team.id, round, 'points'),
              getOverrideKey(team.id, round, 'boston')
            ];
            keys.forEach(key => {
              if (key in newOverrides) {
                delete newOverrides[key];
                changed = true;
              }
            });
          }
        }
      });
      return changed ? newOverrides : prev;
    });
  }, [games, schedule, registeredTeams, numRounds]);

  // Build a matrix of results: { [teamId]: { [round]: { wl, points, boston } } }
  const { sortedTeams, resultsMatrix } = getSortedTournamentResults(teams, games, schedule, overrides, numRounds);

  // Helper to reset all overrides to 0s/blanks for the current tournament
  const handleResetTableDisplay = () => {
    if (!registeredTeams.length) return;
    // Reset overrides for display
    const newOverrides: { [key: string]: string } = {};
    registeredTeams.forEach(team => {
      for (let round = 1; round <= numRounds; round++) {
        newOverrides[getOverrideKey(team.id, round, 'wl')] = '';
        newOverrides[getOverrideKey(team.id, round, 'points')] = '0';
        newOverrides[getOverrideKey(team.id, round, 'boston')] = '0';
      }
      newOverrides[getOverrideKey(team.id, 'total', 'wins')] = '0';
      newOverrides[getOverrideKey(team.id, 'total', 'points')] = '0';
      newOverrides[getOverrideKey(team.id, 'total', 'bostons')] = '0';
    });
    setOverrides(newOverrides);
    try {
      // Use schedule to get matchIds for this tournament
      const matchIds = schedule ? schedule.matches.map(m => m.id) : [];

      // Remove games for this tournament (by matchId)
      let games = JSON.parse(localStorage.getItem('games') || '[]');
      games = games.filter((g: any) => !g.matchId || !matchIds.includes(g.matchId) ? false : true);
      localStorage.setItem('games', JSON.stringify(games));
      if (typeof setGames === 'function') setGames(games);

      // Remove scoreSubmissions for this tournament (by matchId)
      let scoreSubmissions = JSON.parse(localStorage.getItem('scoreSubmissions') || '[]');
      scoreSubmissions = scoreSubmissions.filter((s: any) => !s.matchId || !matchIds.includes(s.matchId) ? false : true);
      localStorage.setItem('scoreSubmissions', JSON.stringify(scoreSubmissions));
      if (typeof setScoreSubmissions === 'function') setScoreSubmissions(scoreSubmissions);

      // Reset overrides
      localStorage.setItem('resultsOverrides', JSON.stringify(newOverrides));

      // Remove tournamentResults for this tournament if present in localStorage
      const trRaw = localStorage.getItem('tournamentResults');
      let tr = trRaw ? JSON.parse(trRaw) : {};
      if (typeof tr === 'object' && tr !== null) {
        delete tr[effectiveTournamentId];
        localStorage.setItem('tournamentResults', JSON.stringify(tr));
        if (typeof setTournamentResults === 'function') setTournamentResults(tr);
      } else {
        console.warn('tournamentResults was not an object:', tr);
      }
    } catch (e) {
      console.error('Error resetting localStorage:', e);
      window.alert('Error during reset: ' + e.message);
      return;
    }
    // Also clear in context if function is available
    if (typeof clearTournamentResults === 'function') {
      clearTournamentResults(effectiveTournamentId);
    }
    window.alert('Table display and results for this tournament have been reset. Teams remain.');
  };

  // Always render the card, controls, and table, even if no tournament/schedule/teams

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4 justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            {(tournament?.name || 'Tournament') + ' - Results'}
          </CardTitle>
          <div className="flex gap-2">
            <button
              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs font-bold"
              onClick={() => {
                if (window.confirm('Are you sure you want to reset ALL tournament data? This will clear all games, schedules, results, brackets, and start fresh with preloaded teams.')) {
                  if (typeof resetAllTournamentData === 'function') {
                    resetAllTournamentData(effectiveTournamentId);
                  }
                  window.alert('All tournament data except teams has been reset.');
                }
              }}
            >
              Reset ALL Tournament Data
            </button>
            <button
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-bold"
              onClick={handleResetTableDisplay}
            >
              Reset Table Display Only
            </button>
            <button
              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-bold"
              onClick={() => {
                setSortByWins(s => !s);
              }}
            >
              Sort
            </button>
            <button
              className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-xs font-bold"
              onClick={() => {
                if (!schedule || registeredTeams.length < 2) return;
                const match = schedule.matches.find(m => m.round === 1 && m.teamA !== 'BYE' && m.teamB !== 'BYE');
                if (!match) return;
                const teamA = teams.find(t => t.id === match.teamA);
                const teamB = teams.find(t => t.id === match.teamB);
                if (!teamA || !teamB) return;
                setOverrides(prev => {
                  const keysToRemove = [
                    getOverrideKey(teamA.id, 1, 'wl'),
                    getOverrideKey(teamA.id, 1, 'points'),
                    getOverrideKey(teamA.id, 1, 'boston'),
                    getOverrideKey(teamB.id, 1, 'wl'),
                    getOverrideKey(teamB.id, 1, 'points'),
                    getOverrideKey(teamB.id, 1, 'boston')
                  ];
                  const newOverrides = { ...prev };
                  keysToRemove.forEach(key => { delete newOverrides[key]; });
                  return newOverrides;
                });
                submitGame({
                  matchId: match.id,
                  teamA: teamA,
                  teamB: teamB,
                  scoreA: 50,
                  scoreB: 40,
                  boston: '',
                  submittedBy: teamA.id,
                  round: 1
                });
                submitGame({
                  matchId: match.id,
                  teamA: teamA,
                  teamB: teamB,
                  scoreA: 50,
                  scoreB: 40,
                  boston: '',
                  submittedBy: teamB.id,
                  round: 1
                });
                window.alert(`Simulated: ${teamA.name} (Team #${teamA.teamNumber}) vs ${teamB.name} (Team #${teamB.teamNumber}) in Round 1. Score: 50-40`);
              }}
            >
              Simulate Confirm Round 1 (2 Teams)
            </button>
          </div>
        </div>
        {/* Tournament selector if no tournament selected or available */}
        {!tournament && (
          <div className="mt-4">
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
        )}
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
                <TableHead colSpan={3} className="bg-blue-200 border border-gray-400 text-center align-middle">TOTALS</TableHead>
              </TableRow>
              <TableRow>
                {Array.from({ length: numRounds }, (_, i) => (
                  <React.Fragment key={i}>
                    <TableHead className={`text-center text-xs border border-gray-400 ${i % 2 === 0 ? 'bg-pink-200' : 'bg-green-200'}`}>Game<br />Win=W<br />Loss=L</TableHead>
                    <TableHead className={`text-center text-xs border border-gray-400 ${i % 2 === 0 ? 'bg-pink-200' : 'bg-green-200'}`}>Points</TableHead>
                    <TableHead className={`text-center text-xs border border-gray-400 ${i % 2 === 0 ? 'bg-pink-200' : 'bg-green-200'}`}>Boston</TableHead>
                  </React.Fragment>
                ))}
                <TableHead className="text-center text-xs border border-gray-400 bg-blue-200">Wins</TableHead>
                <TableHead className="text-center text-xs border border-gray-400 bg-blue-200">Points</TableHead>
                <TableHead className="text-center text-xs border border-gray-400 bg-blue-200">Bostons</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registeredTeams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={1 + numRounds * 3 + 3} className="text-center text-gray-500 py-8">
                    No results yet. {(!tournament || !schedule) ? 'Set up a tournament and schedule to begin.' : ''}
                  </TableCell>
                </TableRow>
              ) : (
                sortedTeams.map(team => {
                  // Defensive display: always use full team object, never show 'Team Unknown' or 'TBD'
                  const teamNumber = team.teamNumber ? `Team # ${team.teamNumber}` : `Team # ${team.id}`;
                  const teamName = team.name || '';
                  return (
                    <TableRow key={team.id}>
                      <TableCell className="font-medium border border-gray-400 bg-yellow-100">
                        <div className="flex flex-col items-center">
                          <Badge variant="outline" className="mb-1">{teamNumber}</Badge>
                          <span className="text-sm">{teamName}</span>
                        </div>
                      </TableCell>
                      {Array.from({ length: numRounds }, (_, roundIndex) => {
                        const round = roundIndex + 1;
                        const roundData = resultsMatrix[team.id][round] || { wl: '', points: 0, boston: 0 };
                        return (
                          <React.Fragment key={round}>
                            <TableCell className="text-center border border-gray-400 p-0">
                              <input
                                className="w-10 text-center bg-transparent outline-none"
                                value={overrides[getOverrideKey(team.id, round, 'wl')] ?? roundData.wl}
                                onChange={e => {
                                  const v = e.target.value;
                                  setOverrides(prev => {
                                    const key = getOverrideKey(team.id, round, 'wl');
                                    if (v === '') {
                                      const { [key]: _, ...rest } = prev;
                                      return rest;
                                    }
                                    return { ...prev, [key]: v };
                                  });
                                }}
                              />
                            </TableCell>
                            <TableCell className="text-center border border-gray-400 p-0">
                              <input
                                type="number"
                                className="w-14 text-center bg-transparent outline-none"
                                value={overrides[getOverrideKey(team.id, round, 'points')] ?? roundData.points}
                                onChange={e => {
                                  const v = e.target.value;
                                  setOverrides(prev => {
                                    const key = getOverrideKey(team.id, round, 'points');
                                    if (v === '') {
                                      const { [key]: _, ...rest } = prev;
                                      return rest;
                                    }
                                    return { ...prev, [key]: v };
                                  });
                                }}
                              />
                            </TableCell>
                            <TableCell className="text-center border border-gray-400 p-0">
                              <input
                                type="number"
                                className="w-10 text-center bg-transparent outline-none"
                                value={overrides[getOverrideKey(team.id, round, 'boston')] ?? roundData.boston}
                                onChange={e => {
                                  const v = e.target.value;
                                  setOverrides(prev => {
                                    const key = getOverrideKey(team.id, round, 'boston');
                                    if (v === '') {
                                      const { [key]: _, ...rest } = prev;
                                      return rest;
                                    }
                                    return { ...prev, [key]: v };
                                  });
                                }}
                              />
                            </TableCell>
                          </React.Fragment>
                        );
                      })}
                      {/* Totals columns */}
                      <TableCell className="text-center border border-gray-400 bg-blue-100 font-medium p-0">
                        <input
                          type="number"
                          className="w-12 text-center bg-transparent outline-none font-bold"
                          value={
                            Array.from({ length: numRounds }, (_, roundIndex) => {
                              const round = roundIndex + 1;
                              const wl = overrides[getOverrideKey(team.id, round, 'wl')] ?? resultsMatrix[team.id][round]?.wl;
                              return wl === 'W' ? 1 : 0;
                            }).reduce((a, b) => a + b, 0)
                          }
                          readOnly
                        />
                      </TableCell>
                      <TableCell className="text-center border border-gray-400 bg-blue-100 font-medium p-0">
                        <input
                          type="number"
                          className="w-16 text-center bg-transparent outline-none font-bold"
                          value={
                            Array.from({ length: numRounds }, (_, roundIndex) => {
                              const round = roundIndex + 1;
                              const points = overrides[getOverrideKey(team.id, round, 'points')];
                              return points !== undefined ? Number(points) : resultsMatrix[team.id][round]?.points || 0;
                            }).reduce((a, b) => a + b, 0)
                          }
                          readOnly
                        />
                      </TableCell>
                      <TableCell className="text-center border border-gray-400 bg-blue-100 font-medium p-0">
                        <input
                          type="number"
                          className="w-12 text-center bg-transparent outline-none font-bold"
                          value={
                            Array.from({ length: numRounds }, (_, roundIndex) => {
                              const round = roundIndex + 1;
                              const boston = overrides[getOverrideKey(team.id, round, 'boston')];
                              return boston !== undefined ? Number(boston) : resultsMatrix[team.id][round]?.boston || 0;
                            }).reduce((a, b) => a + b, 0)
                          }
                          readOnly
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};