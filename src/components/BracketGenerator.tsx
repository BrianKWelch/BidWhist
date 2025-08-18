import React, { useState, useEffect } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { BracketDisplay } from './BracketDisplay';
import { Trophy, Target, RotateCcw } from 'lucide-react';
import type { BracketTeam, BracketMatch, Bracket } from '@/contexts/AppContext';
import { getSortedTournamentResults } from '@/lib/utils';

export const BracketGenerator: React.FC = () => {
  const { tournaments, getTournamentResults, saveBracket, getBracket, updateBracket, deleteBracket, teams, schedules, games, getActiveTournament } = useAppContext();
  const [selectedTournament, setSelectedTournament] = useState(() => {
    const activeTournament = getActiveTournament();
    return activeTournament?.id || '1';
  });
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showRestartDialog, setShowRestartDialog] = useState(false);
  const [showSeedsDialog, setShowSeedsDialog] = useState(false);
  const [topSeeds, setTopSeeds] = useState<BracketTeam[]>([]);
  // L oad resultsOverrides from localStorage (same as TournamentResults)
  const [overrides, setOverrides] = useState<{ [key: string]: string }>({});
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
    // Use getSortedTournamentResults to get the correct team list as shown in the dialog
    const schedule = schedules.find(s => s.tournamentId === selectedTournament);
    const numRounds = schedule ? schedule.rounds : 5;
    const { sortedTeams } = getSortedTournamentResults(teams, games, schedule, overrides, numRounds);
    // Assign seed strictly by row order from sortedTeams
    const seededTeams = sortedTeams.slice(0, size).map((team, index) => ({
      seed: index + 1,
      teamId: team.id,
      teamName: team.name,
      teamNumber: team.teamNumber
    }));
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
     <Card className="border-2" style={{ borderColor: '#a60002' }}>
             <CardHeader>
         <CardTitle className="flex items-center gap-2">
           <img src={import.meta.env.BASE_URL + 'bracket.png'} alt="Bracket" className="h-5 w-5" style={{ filter: 'brightness(0)' }} />
           Tournament Bracket Generator
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
               style={{ borderColor: '#a60002' }}
             >
              {tournaments.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            {!bracket && (
              <Dialog open={showDialog} onOpenChange={setShowDialog}>
                                 <DialogTrigger asChild>
                   <Button onClick={() => setShowDialog(true)} style={{ backgroundColor: 'black', color: 'white' }}>Create Bracket</Button>
                 </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Select Bracket Size</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col md:flex-row gap-6 p-2">
                    <div className="flex-1 border rounded p-2 bg-gray-50">
                      <h4 className="font-semibold mb-2 text-blue-700">Tournament Results Order</h4>
                      <ol className="list-decimal pl-4">
                        {(() => {
                          const schedule = schedules.find(s => s.tournamentId === selectedTournament);
                          const numRounds = schedule ? schedule.rounds : 5;
                          const { sortedTeams } = getSortedTournamentResults(teams, games, schedule, overrides, numRounds);
                          return sortedTeams.map((team, idx) => (
                            <li key={team.id} className="mb-1">
                              <Badge variant="outline">#{idx + 1}</Badge> <span className="font-medium">{team.name}</span> <span className="text-xs text-gray-500">(Team # {team.teamNumber ?? team.id})</span>
                            </li>
                          ));
                        })()}
                      </ol>
                    </div>
                    <div className="flex-1 border rounded p-2 bg-gray-50">
                      <h4 className="font-semibold mb-2 text-green-700">Bracket Seeding Order (Preview)</h4>
                      <ol className="list-decimal pl-4">
                        {(() => {
                          const schedule = schedules.find(s => s.tournamentId === selectedTournament);
                          const numRounds = schedule ? schedule.rounds : 5;
                          const { sortedTeams } = getSortedTournamentResults(teams, games, schedule, overrides, numRounds);
                          return sortedTeams.map((team, idx) => (
                            <li key={team.id} className="mb-1">
                              <Badge variant="outline">#{idx + 1}</Badge> <span className="font-medium">{team.name}</span> <span className="text-xs text-gray-500">(Team # {team.teamNumber ?? team.id})</span>
                            </li>
                          ));
                        })()}
                      </ol>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 p-4">
                    <Button onClick={() => generateBracket(32)} variant="outline">32 Team Bracket</Button>
                    <Button onClick={() => generateBracket(16)} variant="outline">16 Team Bracket</Button>
                    <Button onClick={() => generateBracket(8)} variant="outline">8 Team Bracket</Button>
                    <Button onClick={() => generateBracket(4)} variant="outline">4 Team Bracket</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            
            {bracket && (
              <Dialog open={showRestartDialog} onOpenChange={setShowRestartDialog}>
                                 <DialogTrigger asChild>
                   <Button variant="destructive" className="flex items-center gap-2" style={{ backgroundColor: 'black', color: 'white' }}>
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
                teams={bracket.teams}
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
                    {topSeeds.length === 0 && (
                      <div className="text-red-600 font-semibold">
                        No teams could be seeded. Please check that your tournament has a valid schedule and teams.
                      </div>
                    )}
                    {topSeeds.map((team, idx) => {
                      const teamNum = team.teamNumber ?? team.teamId;
                      return (
                        <div key={team.teamId} className="flex items-center gap-2">
                          <Badge variant="outline">#{team.seed}</Badge>
                          <span className="font-medium">{team.teamName}</span>
                          {teamNum && (
                            <span className="text-xs text-gray-500">(Team # {teamNum})</span>
                          )}
                        </div>
                      );
                    })}
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