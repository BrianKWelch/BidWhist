import React, { useState, useEffect } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { ScheduleDisplay } from './ScheduleDisplay';
import { generateNRoundsWithByeAndFinal, generateWinLossRotationSchedule, generateNextWinLossRound } from '@/lib/scheduler';
import type { TournamentSchedule, ScheduleMatch } from '@/contexts/AppContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export const TournamentScheduler: React.FC = () => {
  const { teams, tournaments, schedules, saveSchedule, sendScoreSheetLinks, clearTournamentResults, clearGames, clearScoreSubmissions, updatePlaceholders, forceReplaceAllPlaceholders, refreshSchedules } = useAppContext();
  const [selectedTournament, setSelectedTournament] = useState<string>('');
  const [numberOfRounds, setNumberOfRounds] = useState<string>('4');
  const [currentSchedule, setCurrentSchedule] = useState<TournamentSchedule | null>(null);
  const [isScheduleLocked, setIsScheduleLocked] = useState(false);
  const [linksSent, setLinksSent] = useState(false);
  const [showByeDialog, setShowByeDialog] = useState(false);
  const [byeTeamsList, setByeTeamsList] = useState<string[]>([]);
  // Add state for schedule option modal
  const [showScheduleOptionModal, setShowScheduleOptionModal] = useState(false);
  const [pendingScheduleAction, setPendingScheduleAction] = useState<null | (() => void)>(null);
  const [selectedScheduleOption, setSelectedScheduleOption] = useState<'A' | 'B' | null>(null);

  // initial load when selecting tournament
  useEffect(() => {
    if (selectedTournament) {
      const existingSchedule = schedules.find(s => s.tournamentId === selectedTournament) || null;
      if (existingSchedule) {
        setCurrentSchedule(existingSchedule);
        setNumberOfRounds(existingSchedule.rounds ? existingSchedule.rounds.toString() : '4');
      } else {
        setCurrentSchedule(null);
        setNumberOfRounds('4');
      }
      setIsScheduleLocked(false);
    }
  }, [selectedTournament, schedules]);

  // keep currentSchedule in sync with live schedules after updates
  useEffect(() => {
    if (!selectedTournament) return;
    const live = schedules.find(s => s.tournamentId === selectedTournament) || null;
    setCurrentSchedule(live);
  }, [schedules, selectedTournament]);

  // Handler for when admin selects an option
  const handleScheduleOptionSelect = (option: 'A' | 'B') => {
    setSelectedScheduleOption(option);
    setShowScheduleOptionModal(false);
    setTimeout(() => {
      if (option === 'A') {
        actuallyGenerateScheduleA();
      } else if (option === 'B') {
        actuallyGenerateScheduleB();
      }
    }, 0);
  };

  // Helper to get a safe number of rounds
  const getSafeNumberOfRounds = () => {
    const num = parseInt(numberOfRounds);
    if (isNaN(num) || num < 2) return 4;
    return num;
  };

  // Refactor generateSchedule to show modal
  const generateSchedule = () => {
    if (!selectedTournament || !numberOfRounds || isNaN(parseInt(numberOfRounds)) || parseInt(numberOfRounds) < 2) {
      toast({ title: 'Please select tournament and a valid number of rounds (minimum 2)', variant: 'destructive' });
      return;
    }
    // Check if there's an existing schedule and warn about clearing results
    const existingSchedule = schedules.find(s => s.tournamentId === selectedTournament);
    if (existingSchedule) {
      const confirmed = window.confirm(
        'Generating a new schedule will clear all existing results, scores, and standings for this tournament. Are you sure you want to continue?'
      );
      if (!confirmed) {
        return;
      }
    }
    setShowScheduleOptionModal(true);
  };

  // Existing logic for Option A
  const actuallyGenerateScheduleA = () => {
    const tournamentTeams = teams.filter(team => 
      team.registeredTournaments?.includes(selectedTournament)
    );
    if (tournamentTeams.length < 2) {
      toast({ title: 'Need at least 2 teams to generate schedule', variant: 'destructive' });
      return;
    }
    const schedulerTeams = tournamentTeams.map(team => ({
      id: team.id,
      name: team.name,
      city: team.city
    }));
    const numRounds = getSafeNumberOfRounds();
    const roundMatches = generateNRoundsWithByeAndFinal(schedulerTeams, numRounds);
    const matches: ScheduleMatch[] = [];
    let matchId = 1;
    let tableNum = 1;
    const maxTables = Math.floor(tournamentTeams.length / 2);
    roundMatches.forEach((roundData, roundIndex) => {
      tableNum = 1;
      roundData.forEach(match => {
        if ('teamA' in match && 'teamB' in match) {
          matches.push({
            id: `${selectedTournament}-r${roundIndex + 1}-m${matchId++}`,
            teamA: match.teamA.id,
            teamB: match.teamB.id,
            round: roundIndex + 1,
            table: Math.min(tableNum++, maxTables),
            tournamentId: selectedTournament,
            isBye: match.teamA.id === 'BYE' || match.teamB.id === 'BYE',
            isSameCity: match.teamA.city === match.teamB.city
          });
        }
      });
    });
    const schedule: TournamentSchedule = {
      tournamentId: selectedTournament,
      matches,
      rounds: numRounds
    };
    saveSchedule(schedule);
    setCurrentSchedule(schedule);
    setIsScheduleLocked(true);
    setLinksSent(false);
  };

  // Update Option B handler
  const actuallyGenerateScheduleB = () => {
    const tournamentTeams = teams.filter(team => 
      team.registeredTournaments?.includes(selectedTournament)
    );
    if (tournamentTeams.length < 2) {
      toast({ title: 'Need at least 2 teams to generate schedule', variant: 'destructive' });
      return;
    }
    const schedulerTeams = tournamentTeams.map(team => ({
      id: String(team.id),
      name: team.name,
      city: team.city
    }));
    const numRounds = getSafeNumberOfRounds();
    const matches: ScheduleMatch[] = [];
    let matchId = 1;
    const numTables = Math.floor(schedulerTeams.length / 2);
    const hasBye = schedulerTeams.length % 2 !== 0;
    const byeHistory: string[] = [];
    // --- Round 1 ---
    const round1Matches = generateWinLossRotationSchedule(schedulerTeams)[0];
    let round1ByeTeamId = null;
    round1Matches.forEach((match, idx) => {
      if ('teamA' in match && 'teamB' in match && match.teamA && match.teamB) {
        matches.push({
          id: `${selectedTournament}-r1-m${matchId++}`,
          teamA: String(match.teamA.id),
          teamB: String(match.teamB.id),
          round: 1,
          table: match.table,
          tournamentId: selectedTournament,
          isBye: false,
          isSameCity: match.teamA.city === match.teamB.city
        });
      } else if ('teamA' in match && match.teamA && !match.teamB) {
        round1ByeTeamId = String(match.teamA.id);
        byeHistory.push(round1ByeTeamId);
        matches.push({
          id: `${selectedTournament}-r1-m${matchId++}`,
          teamA: String(match.teamA.id),
          teamB: null,
          round: 1,
          table: numTables + 1,
          tournamentId: selectedTournament,
          isBye: true,
          isSameCity: false
        });
      }
    });
    // --- Subsequent rounds with correct bye rotation ---
    let prevByeTeamId = round1ByeTeamId;
    for (let round = 2; round <= numRounds; round++) {
      let table = 1;
      let losers = [];
      for (let i = 1; i <= numTables; i++) {
        losers.push(`R${round-1}L${i}`);
      }
      let winners = [];
      for (let i = 1; i <= numTables; i++) {
        winners.push(`R${round-1}W${i}`);
      }
      let loserIdx = 0;
      let newByeTeamId = null;
      // Insert previous round's bye team into table 1 as teamB, and loser of table 2 becomes new bye
      if (prevByeTeamId) {
        matches.push({
          id: `${selectedTournament}-r${round}-m${matchId++}`,
          teamA: losers[loserIdx],
          teamB: prevByeTeamId,
          round: round,
          table: table++,
          tournamentId: selectedTournament,
          isBye: false,
          isSameCity: false,
          opponentPlaceholder: undefined
        });
        // Loser of table 2 is the new bye
        newByeTeamId = losers[loserIdx + 1];
        if (newByeTeamId) {
          byeHistory.push(newByeTeamId);
          // Assign the bye to table numTables + 1
          matches.push({
            id: `${selectedTournament}-r${round}-byem${matchId++}`,
            teamA: newByeTeamId,
            teamB: null,
            round: round,
            table: numTables + 1,
            tournamentId: selectedTournament,
            isBye: true,
            isSameCity: false,
            opponentPlaceholder: undefined
          });
        }
        loserIdx += 2;
      }
      // Pair remaining losers in order
      while (loserIdx + 1 < losers.length) {
        matches.push({
          id: `${selectedTournament}-r${round}-m${matchId++}`,
          teamA: losers[loserIdx],
          teamB: losers[loserIdx + 1],
          round: round,
          table: table++,
          tournamentId: selectedTournament,
          isBye: false,
          isSameCity: false,
          opponentPlaceholder: undefined
        });
        loserIdx += 2;
      }
      let winnerIdx = 0;
      if (loserIdx < losers.length) {
        matches.push({
          id: `${selectedTournament}-r${round}-m${matchId++}`,
          teamA: losers[loserIdx],
          teamB: winners[winnerIdx],
          round: round,
          table: table++,
          tournamentId: selectedTournament,
          isBye: false,
          isSameCity: false,
          opponentPlaceholder: undefined
        });
        winnerIdx++;
      }
      while (winnerIdx + 1 < winners.length) {
        matches.push({
          id: `${selectedTournament}-r${round}-m${matchId++}`,
          teamA: winners[winnerIdx],
          teamB: winners[winnerIdx + 1],
          round: round,
          table: table++,
          tournamentId: selectedTournament,
          isBye: false,
          isSameCity: false,
          opponentPlaceholder: undefined
        });
        winnerIdx += 2;
      }
      prevByeTeamId = newByeTeamId;
    }
    // --- Final catch-up/bye round ---
    let totalRounds = numRounds;
    if (byeHistory.length > 0) {
      totalRounds = numRounds + 1;
      let finalRound = totalRounds;
      let byeTeams = byeHistory.map(byeId => {
        const team = schedulerTeams.find(t => t.id === byeId);
        return team ? team.id : byeId;
      });
      let byeTable = 1;
      for (let i = 0; i < byeTeams.length; i += 2) {
        matches.push({
          id: `${selectedTournament}-r${finalRound}-byem${matchId++}`,
          teamA: byeTeams[i],
          teamB: byeTeams[i+1] || null,
          round: finalRound,
          table: byeTable++,
          tournamentId: selectedTournament,
          isBye: byeTeams[i+1] ? false : true,
          isSameCity: false,
          opponentPlaceholder: undefined
        });
      }
    }
    const schedule: TournamentSchedule = {
      tournamentId: selectedTournament,
      matches,
      rounds: totalRounds
    };
    saveSchedule(schedule);
    setCurrentSchedule(schedule);
    setIsScheduleLocked(true);
    setLinksSent(false);
    toast({ title: `Option B schedule generated!`, description: `All rounds pre-created with correct loser/winner and bye rotation logic for any number of teams.` });
  };

  const handleSendScoreSheets = async () => {
    if (!currentSchedule) return;
    
    try {
      const baseUrl = window.location.origin;
      await sendScoreSheetLinks(currentSchedule.tournamentId, baseUrl);
      setLinksSent(true);
      toast({ title: 'Score sheet links sent to all teams!' });
    } catch (error) {
      toast({ title: 'Failed to send score sheet links', variant: 'destructive' });
    }
  };

  const tournament = tournaments.find(t => t.id === selectedTournament);
  const tournamentTeams = teams.filter(team => 
    team.registeredTournaments?.includes(selectedTournament)
  );
  const existingSchedule = schedules.find(s => s.tournamentId === selectedTournament);
  const maxTablesForTournament = tournamentTeams.length > 0 ? Math.floor(tournamentTeams.length / 2) : 0;
  const isOdd = tournamentTeams.length % 2 === 1;

  const teamsByCity = tournamentTeams.reduce((acc, team) => {
    if (!acc[team.city]) acc[team.city] = 0;
    acc[team.city]++;
    return acc;
  }, {} as { [city: string]: number });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Tournament Scheduler (Smart Algorithm)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tournament">Select Tournament</Label>
              <Select value={selectedTournament} onValueChange={setSelectedTournament}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose tournament" />
                </SelectTrigger>
                <SelectContent>
                  {tournaments.map(tournament => (
                    <SelectItem key={tournament.id} value={tournament.id}>
                      {tournament.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="rounds">Number of Rounds</Label>
              <Input
                id="rounds"
                type="number"
                value={numberOfRounds}
                onChange={(e) => setNumberOfRounds(e.target.value)}
                placeholder="e.g., 4"
              />
            </div>
          </div>
          
          {selectedTournament && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">
                  Teams: {tournamentTeams.length} {isOdd && <Badge variant="secondary" className="ml-1">Odd - Byes Required</Badge>}
                </p>
                <div className="flex gap-1">
                  {Object.entries(teamsByCity).map(([city, count]) => (
                    <Badge key={city} variant="outline" className="text-xs">
                      {city}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
              <p className="text-sm text-blue-600">
                Tables: {maxTablesForTournament}
              </p>
              <p className="text-xs text-green-600">
                ✓ Avoids same-city matchups and rematches
                {isOdd && ' ✓ Handles byes with final bye round'}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              onClick={generateSchedule}
              disabled={!selectedTournament || !numberOfRounds || isNaN(parseInt(numberOfRounds)) || parseInt(numberOfRounds) < 2}
              className="flex-1"
            >
              {existingSchedule ? 'Regenerate Schedule (Clears Results)' : 'Generate Schedule'}
            </Button>
            
            {isScheduleLocked && currentSchedule && (
              <Button 
                onClick={handleSendScoreSheets}
                disabled={linksSent}
                variant="secondary"
                className="flex-1"
              >
                {linksSent ? 'Links Sent ✓' : 'Send Score Sheet Out'}
              </Button>
            )}
            {currentSchedule && (
              <Button onClick={refreshSchedules} variant="outline" className="flex-1">Refresh from DB</Button>
            )}
            {currentSchedule && (
              <Button onClick={async () => {
                await updatePlaceholders();
                forceReplaceAllPlaceholders();
              }} variant="outline" className="flex-1">Update Schedule</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {currentSchedule && (
        <ScheduleDisplay 
          schedule={currentSchedule} 
          tournamentName={tournament?.name || ''} 
        />
      )}

      <Dialog open={showScheduleOptionModal} onOpenChange={setShowScheduleOptionModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose Schedule Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Button variant="outline" className="w-full" onClick={() => handleScheduleOptionSelect('A')}>
              Option A: Full Schedule (all matchups, avoids same-city, existing logic)
            </Button>
            <Button variant="outline" className="w-full" onClick={() => handleScheduleOptionSelect('B')}>
              Option B: Win/Loss Dictated Rotation (dynamic, round-by-round)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showByeDialog} onOpenChange={setShowByeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Teams with Byes</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {byeTeamsList.length === 0 ? (
              <div className="text-gray-600">No teams received a bye.</div>
            ) : (
              <ul className="list-disc pl-6">
                {byeTeamsList.map(name => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={() => setShowByeDialog(false)}>OK</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TournamentScheduler;