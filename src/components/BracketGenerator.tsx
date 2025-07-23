import React, { useState, useEffect } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { BracketDisplay } from './BracketDisplay';
import { Trophy, Target, RotateCcw } from 'lucide-react';
import type { BracketTeam, BracketMatch, Bracket } from '@/contexts/AppContext';
import { getSortedTournamentResults } from '@/lib/utils';

export const BracketGenerator: React.FC = () => {
  const { tournaments, getTournamentResults, saveBracket, getBracket, updateBracket, deleteBracket, teams, schedules, games } = useAppContext();
  const [selectedTournament, setSelectedTournament] = useState('1');
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showRestartDialog, setShowRestartDialog] = useState(false);
  const [showSeedsDialog, setShowSeedsDialog] = useState(false);
  const [topSeeds, setTopSeeds] = useState<BracketTeam[]>([]);
  const [showNoTeamsDialog, setShowNoTeamsDialog] = useState(false);
  // L oad resultsOverrides from localStorage (same as TournamentResults)
  const [overrides, setOverrides] = useState<{ [key: string]: string }>({});
  const [debugSortedTeams, setDebugSortedTeams] = useState<any[]>([]);
  const [debugSeededTeams, setDebugSeededTeams] = useState<any[]>([]);
  useEffect(() => {
    const saved = localStorage.getItem('resultsOverrides');
    if (saved) setOverrides(JSON.parse(saved));
  }, []);

  // Load existing bracket when tournament changes
  useEffect(() => {
    const existingBracket = getBracket(selectedTournament);
    setBracket(existingBracket);
  }, [selectedTournament, getBracket]);


  const generateBracket = (size: number) => {
    const schedule = schedules.find(s => s.tournamentId === selectedTournament);
    console.log('DEBUG: teams', teams);
    console.log('DEBUG: selectedTournament', selectedTournament);
    console.log('DEBUG: schedule', schedule);
    if (schedule) {
      console.log('DEBUG: schedule.matches', schedule.matches);
    }
    let numRounds = 5;
    if (!schedule) {
      setShowNoTeamsDialog(true);
      return;
    }
    numRounds = schedule.rounds;

    // Use shared logic for results and sorting to match TournamentResults
    const { sortedTeams, resultsMatrix } = getSortedTournamentResults(teams, games, schedule, overrides, numRounds);
    // Only use the top N teams for the bracket size
    const sortedBracketTeams = sortedTeams.slice(0, size);

    // Assign seed = results page line number (1-based)
    const seededTeams = sortedBracketTeams.map((team, index) => ({
      seed: index + 1,
      teamId: team.id,
      teamName: team.name,
      teamNumber: team.teamNumber
    }));

    setDebugSortedTeams(sortedBracketTeams.map(team => ({
      teamNumber: team.teamNumber,
      teamName: team.name,
      // Use the same calculations as TournamentResults for debug
      totalWins: Array.from({ length: numRounds }, (_, roundIndex) => {
        const round = roundIndex + 1;
        const wl = overrides[`${team.id}_${round}_wl`] ?? resultsMatrix[team.id][round]?.wl;
        return wl === 'W' ? 1 : 0;
      }).reduce((a, b) => a + b, 0),
      totalPoints: Array.from({ length: numRounds }, (_, roundIndex) => {
        const round = roundIndex + 1;
        const points = overrides[`${team.id}_${round}_points`];
        return points !== undefined ? Number(points) : resultsMatrix[team.id][round]?.points || 0;
      }).reduce((a, b) => a + b, 0),
      round1Points: overrides[`${team.id}_1_points`] !== undefined ? Number(overrides[`${team.id}_1_points`]) : resultsMatrix[team.id]?.[1]?.points || 0,
      id: team.id
    })));
    setDebugSeededTeams(seededTeams);

    const matches = createMatches(size, seededTeams);
    const newBracket: Bracket = {
      id: `bracket-${Date.now()}`,
      tournamentId: selectedTournament,
      size,
      teams: seededTeams,
      matches,
      createdAt: new Date()
    };

    setBracket(newBracket);
    saveBracket(newBracket);
    setTopSeeds(seededTeams.slice(0, 5));
    setShowDialog(false);
    setShowSeedsDialog(true);
  };

  const createMatches = (size: number, teams: BracketTeam[]): BracketMatch[] => {
    const matches: BracketMatch[] = [];
    let matchId = 1;

    const firstRoundPairs = getFirstRoundPairs(size);
    
    firstRoundPairs.forEach((pair) => {
      const team1 = teams.find(t => t.seed === pair[0]);
      const team2 = teams.find(t => t.seed === pair[1]);
      
      const tableNumber = Math.min(pair[0], pair[1]);
      
      matches.push({
        id: `match-${matchId++}`,
        round: 1,
        table: tableNumber,
        team1,
        team2
      });
    });

    const rounds = Math.log2(size);
    for (let round = 2; round <= rounds; round++) {
      const tablesInRound = size / Math.pow(2, round);
      
      for (let i = 0; i < tablesInRound; i++) {
        matches.push({
          id: `match-${matchId++}`,
          round,
          table: i + 1
        });
      }
    }

    return matches;
  };

  const getFirstRoundPairs = (size: number): number[][] => {
    switch (size) {
      case 4: return [[1, 4], [2, 3]];
      case 8: return [[1, 8], [4, 5], [2, 7], [3, 6]];
      case 16: return [[1, 16], [8, 9], [4, 13], [5, 12], [2, 15], [7, 10], [3, 14], [6, 11]];
      case 32: return [[1, 32], [16, 17], [8, 25], [9, 24], [4, 29], [13, 20], [5, 28], [12, 21], [2, 31], [15, 18], [7, 26], [10, 23], [3, 30], [14, 19], [6, 27], [11, 22]];
      default: return [];
    }
  };

  const handleScoreUpdate = (matchId: string, team1Score: number, team2Score: number) => {
    if (!bracket) return;
    
    const updatedMatches = bracket.matches.map(match => {
      if (match.id === matchId) {
        return { ...match, team1Score, team2Score };
      }
      return match;
    });
    
    const updatedBracket = { ...bracket, matches: updatedMatches };
    setBracket(updatedBracket);
    updateBracket(selectedTournament, { matches: updatedMatches });
  };

  const handleAdvanceWinner = (matchId: string) => {
    if (!bracket) return;
    
    const match = bracket.matches.find(m => m.id === matchId);
    if (!match || !match.team1 || !match.team2) return;
    
    const winner = (match.team1Score || 0) > (match.team2Score || 0) ? match.team1 : match.team2;
    
    const updatedMatches = bracket.matches.map(m => {
      if (m.id === matchId) {
        return { ...m, winner };
      }
      return m;
    });
    
    const nextRoundTable = getNextRoundTable(match.table, match.round, bracket.size);
    
    const nextRoundMatches = bracket.matches.filter(m => m.round === match.round + 1);
    const nextMatch = nextRoundMatches.find(m => m.table === nextRoundTable);
    
    if (nextMatch) {
      const finalMatches = updatedMatches.map(m => {
        if (m.id === nextMatch.id) {
          if (!m.team1) {
            return { ...m, team1: { ...winner, seed: winner.seed } };
          } else if (!m.team2) {
            return { ...m, team2: { ...winner, seed: winner.seed } };
          }
        }
        return m;
      });
      
      const updatedBracket = { ...bracket, matches: finalMatches };
      setBracket(updatedBracket);
      updateBracket(selectedTournament, { matches: finalMatches });
    } else {
      const updatedBracket = { ...bracket, matches: updatedMatches };
      setBracket(updatedBracket);
      updateBracket(selectedTournament, { matches: updatedMatches });
    }
  };

  const getNextRoundTable = (currentTable: number, currentRound: number, bracketSize: number): number => {
    const tablesInNextRound = bracketSize / Math.pow(2, currentRound + 1);
    
    if (currentTable <= tablesInNextRound) {
      return currentTable;
    } else {
      return (tablesInNextRound + 1) - (currentTable - tablesInNextRound);
    }
  };

  const handleRestartBracket = () => {
    deleteBracket(selectedTournament);
    setBracket(null);
    setShowRestartDialog(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Tournament Bracket Generator
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Debug tables for seeding order and seeds */}
        {debugSortedTeams.length > 0 && (
          <div className="mb-4">
            <h4 className="font-semibold text-blue-700 mb-1">Sorted Team Order (for Seeding)</h4>
            <table className="min-w-full text-xs border mb-2">
              <thead>
                <tr>
                  <th className="border px-2">#</th>
                  <th className="border px-2">Team Number</th>
                  <th className="border px-2">Team Name</th>
                  <th className="border px-2">Wins</th>
                  <th className="border px-2">Total Points</th>
                  <th className="border px-2">Round 1 Points</th>
                  <th className="border px-2">ID</th>
                </tr>
              </thead>
              <tbody>
                {debugSortedTeams.map((t, i) => (
                  <tr key={t.id} className="border">
                    <td className="border px-2">{i + 1}</td>
                    <td className="border px-2">{t.teamNumber}</td>
                    <td className="border px-2">{t.teamName}</td>
                    <td className="border px-2">{t.totalWins}</td>
                    <td className="border px-2">{t.totalPoints}</td>
                    <td className="border px-2">{t.round1Points}</td>
                    <td className="border px-2">{t.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h4 className="font-semibold text-green-700 mb-1">Seeded Teams</h4>
            <table className="min-w-full text-xs border">
              <thead>
                <tr>
                  <th className="border px-2">Seed</th>
                  <th className="border px-2">Team Number</th>
                  <th className="border px-2">Team Name</th>
                  <th className="border px-2">ID</th>
                </tr>
              </thead>
              <tbody>
                {debugSeededTeams.map((t) => (
                  <tr key={t.teamId} className="border">
                    <td className="border px-2">{t.seed}</td>
                    <td className="border px-2">{t.teamNumber}</td>
                    <td className="border px-2">{t.teamName}</td>
                    <td className="border px-2">{t.teamId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">Universal Bracket Rule:</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Lowest table number always plays highest table number at lowest table</li>
              <li>• 16 tables: 1v16@1, 2v15@2, 3v14@3, 4v13@4...</li>
              <li>• 8 tables: 1v8@1, 2v7@2, 3v6@3, 4v5@4</li>
              <li>• 4 tables: 1v4@1, 2v3@2</li>
              <li>• Finals: Winner 1 vs Winner 2</li>
            </ul>
          </div>
          
          <div>
            <label className="text-sm font-medium">Select Tournament:</label>
            <select 
              className="w-full mt-1 p-2 border rounded"
              value={selectedTournament}
              onChange={(e) => setSelectedTournament(e.target.value)}
            >
              {tournaments.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            {!bracket && (
              <>
                <Dialog open={showDialog} onOpenChange={setShowDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setShowDialog(true)}>Create Bracket</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Select Bracket Size</DialogTitle>
                    </DialogHeader>
                    <DialogDescription>
                      Choose the number of teams for your bracket. You must have enough teams added to match the bracket size.
                    </DialogDescription>
                    <div className="grid grid-cols-2 gap-4 p-4">
                      <Button onClick={() => generateBracket(32)} variant="outline">32 Team Bracket</Button>
                      <Button onClick={() => generateBracket(16)} variant="outline">16 Team Bracket</Button>
                      <Button onClick={() => generateBracket(8)} variant="outline">8 Team Bracket</Button>
                      <Button onClick={() => generateBracket(4)} variant="outline">4 Team Bracket</Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog open={showNoTeamsDialog} onOpenChange={setShowNoTeamsDialog}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>No Teams Available</DialogTitle>
                    </DialogHeader>
                    <DialogDescription>
                      You must add teams to the tournament before you can create a bracket. Go to the Teams tab and add teams, then try again.
                    </DialogDescription>
                    <div className="flex justify-end pt-4">
                      <Button onClick={() => setShowNoTeamsDialog(false)}>OK</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}
            
            {bracket && (
              <Dialog open={showRestartDialog} onOpenChange={setShowRestartDialog}>
                <DialogTrigger asChild>
                  <Button variant="destructive" className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Restart Bracket
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Restart Bracket?</DialogTitle>
                  </DialogHeader>
                  <div className="p-4">
                    <p className="mb-4">Are you sure you want to restart the bracket? This will delete all current progress and cannot be undone.</p>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setShowRestartDialog(false)}>Cancel</Button>
                      <Button variant="destructive" onClick={handleRestartBracket}>Yes, Restart</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {bracket && (
            <>
              <BracketDisplay
                size={bracket.size}
                matches={bracket.matches}
                onScoreUpdate={handleScoreUpdate}
                onAdvanceWinner={handleAdvanceWinner}
              />
              {/* Popup dialog for top 5 seeds */}
              <Dialog open={showSeedsDialog} onOpenChange={setShowSeedsDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Top 5 Seeds</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2">
                    {topSeeds.length === 0 && <div>No teams seeded.</div>}
                    {topSeeds.map((team, idx) => (
                      <div key={team.teamId} className="flex items-center gap-2">
                        <Badge variant="outline">#{team.seed}</Badge>
                        <span className="font-medium">{team.teamName}</span>
                        <span className="text-xs text-gray-500">(Team #{team.teamNumber})</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button onClick={() => setShowSeedsDialog(false)}>OK</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};