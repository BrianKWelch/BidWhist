import React, { useState, useMemo, useRef } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ArrowUpDown, Trophy } from 'lucide-react';

export const TournamentResults: React.FC = () => {
  const { tournaments, teams, getTournamentResults, updateTournamentResult } = useAppContext();
  const [selectedTournament, setSelectedTournament] = useState('1');
  const [sortApplied, setSortApplied] = useState(false);
  const sortedOrderRef = useRef<any[]>([]);

  const tournament = tournaments.find(t => t.id === selectedTournament);
  const results = getTournamentResults(selectedTournament);
  const numRounds = 5;

  // Only sort when sortApplied is true and maintain that exact order
  const displayResults = useMemo(() => {
    if (!sortApplied) {
      // Return results in original order (by team number)
      const originalOrder = [...results].sort((a, b) => a.teamNumber - b.teamNumber);
      sortedOrderRef.current = originalOrder;
      return originalOrder;
    }
    
    // If we have a previously sorted order, maintain it with updated data
    if (sortedOrderRef.current.length > 0) {
      return sortedOrderRef.current.map(sortedTeam => 
        results.find(r => r.teamId === sortedTeam.teamId) || sortedTeam
      );
    }
    
    return results;
  }, [results, sortApplied]);

  const handleSortByWinsAndPoints = () => {
    // Create a new sorted order and store it
    const newSortedOrder = [...results].sort((a, b) => {
      if (a.totalWins !== b.totalWins) return b.totalWins - a.totalWins;
      return b.totalPoints - a.totalPoints;
    });
    
    sortedOrderRef.current = newSortedOrder;
    setSortApplied(true);
  };

  const handleInputChange = (teamId: string, round: number, field: 'points' | 'wl' | 'boston', value: string) => {
    let processedValue: any = value;
    if (field === 'points' || field === 'boston') {
      processedValue = parseInt(value) || 0;
    } else if (field === 'wl') {
      processedValue = value.toUpperCase();
      if (processedValue !== '' && processedValue !== 'W' && processedValue !== 'L') {
        return;
      }
    }
    updateTournamentResult(selectedTournament, teamId, round, field, processedValue);
    // Maintain current sort state - do not change sorting
  };

  if (!tournament) {
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
        <div className="flex gap-2">
          <Button 
            onClick={handleSortByWinsAndPoints} 
            variant={sortApplied ? 'default' : 'outline'}
          >
            Sort by Wins then Points
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead rowSpan={2} className="bg-yellow-200 border border-gray-400 text-center align-middle">TEAM<br />#</TableHead>
                {Array.from({ length: numRounds }, (_, i) => (
                  <TableHead key={i} colSpan={3} className={`text-center border border-gray-400 ${
                    i % 2 === 0 ? 'bg-pink-200' : 'bg-green-200'
                  }`}>
                    Round {i + 1}
                  </TableHead>
                ))}
                <TableHead colSpan={4} className="text-center bg-gray-100 border border-gray-400">Totals</TableHead>
              </TableRow>
              <TableRow>
                {Array.from({ length: numRounds }, (_, i) => (
                  <React.Fragment key={i}>
                    <TableHead className={`text-center text-xs border border-gray-400 ${
                      i % 2 === 0 ? 'bg-pink-200' : 'bg-green-200'
                    }`}>Game<br />Win=W<br />Loss=L</TableHead>
                    <TableHead className={`text-center text-xs border border-gray-400 ${
                      i % 2 === 0 ? 'bg-pink-200' : 'bg-green-200'
                    }`}>Points</TableHead>
                    <TableHead className={`text-center text-xs border border-gray-400 ${
                      i % 2 === 0 ? 'bg-pink-200' : 'bg-green-200'
                    }`}>Boston</TableHead>
                  </React.Fragment>
                ))}
                <TableHead className="text-center text-xs bg-gray-100 border border-gray-400">Wins</TableHead>
                <TableHead className="text-center text-xs bg-gray-100 border border-gray-400">Losses</TableHead>
                <TableHead className="text-center text-xs bg-gray-100 border border-gray-400">Points</TableHead>
                <TableHead className="text-center text-xs bg-gray-100 border border-gray-400">Bostons</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayResults.map((team) => (
                <TableRow key={team.teamId}>
                  <TableCell className="font-medium border border-gray-400 bg-yellow-100">
                    <div className="flex flex-col items-center">
                      <Badge variant="outline" className="mb-1">#{team.teamNumber}</Badge>
                      <span className="text-sm">{team.teamName}</span>
                    </div>
                  </TableCell>
                  {Array.from({ length: numRounds }, (_, roundIndex) => {
                    const round = roundIndex + 1;
                    const roundData = team.rounds[round] || { points: 0, wl: '', boston: 0 };
                    return (
                      <React.Fragment key={round}>
                        <TableCell className="text-center border border-gray-400">
                          <Input
                            type="text"
                            value={roundData.wl}
                            onChange={(e) => handleInputChange(team.teamId, round, 'wl', e.target.value)}
                            className="w-12 h-8 text-center"
                            maxLength={1}
                          />
                        </TableCell>
                        <TableCell className="text-center border border-gray-400">
                          <Input
                            type="number"
                            value={roundData.points}
                            onChange={(e) => handleInputChange(team.teamId, round, 'points', e.target.value)}
                            className="w-16 h-8 text-center"
                            min="0"
                          />
                        </TableCell>
                        <TableCell className="text-center border border-gray-400">
                          <Input
                            type="number"
                            value={roundData.boston}
                            onChange={(e) => handleInputChange(team.teamId, round, 'boston', e.target.value)}
                            className="w-16 h-8 text-center"
                            min="0"
                          />
                        </TableCell>
                      </React.Fragment>
                    );
                  })}
                  <TableCell className="text-center font-bold bg-gray-100 border border-gray-400">{team.totalWins}</TableCell>
                  <TableCell className="text-center font-bold bg-gray-100 border border-gray-400">{Object.values(team.rounds).filter(r => r.wl === 'L').length}</TableCell>
                  <TableCell className="text-center font-bold bg-gray-100 border border-gray-400">{team.totalPoints}</TableCell>
                  <TableCell className="text-center font-bold bg-gray-100 border border-gray-400">{team.totalBoston}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};