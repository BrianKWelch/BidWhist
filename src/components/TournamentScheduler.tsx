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
import { generateNRoundsWithByeAndFinal } from '@/lib/scheduler';
import type { TournamentSchedule, ScheduleMatch } from '@/contexts/AppContext';

export const TournamentScheduler: React.FC = () => {
  const { teams, tournaments, schedules, saveSchedule, sendScoreSheetLinks, clearTournamentResults, clearGames, clearScoreSubmissions } = useAppContext();
  const [selectedTournament, setSelectedTournament] = useState<string>('');
  const [numberOfRounds, setNumberOfRounds] = useState<string>('4');
  const [currentSchedule, setCurrentSchedule] = useState<TournamentSchedule | null>(null);
  const [isScheduleLocked, setIsScheduleLocked] = useState(false);
  const [linksSent, setLinksSent] = useState(false);

  useEffect(() => {
    if (selectedTournament) {
      const existingSchedule = schedules.find(s => s.tournamentId === selectedTournament);
      if (existingSchedule) {
        setCurrentSchedule(existingSchedule);
        setNumberOfRounds(existingSchedule.rounds ? existingSchedule.rounds.toString() : '4');
        setIsScheduleLocked(false);
      } else {
        setCurrentSchedule(null);
        setNumberOfRounds('4');
        setIsScheduleLocked(false);
      }
    }
  }, [selectedTournament, schedules]);

  const generateSchedule = () => {
    if (!selectedTournament || !numberOfRounds) {
      toast({ title: 'Please select tournament and number of rounds', variant: 'destructive' });
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

    const tournamentTeams = teams.filter(team => 
      team.registeredTournaments?.includes(selectedTournament)
    );

    if (tournamentTeams.length < 2) {
      toast({ title: 'Need at least 2 teams to generate schedule', variant: 'destructive' });
      return;
    }

    // Convert teams to scheduler format
    const schedulerTeams = tournamentTeams.map(team => ({
      id: team.id,
      name: team.name,
      city: team.city
    }));

    // Use new scheduler logic for correct bye and final round handling
    const numRounds = parseInt(numberOfRounds);
    const roundMatches = generateNRoundsWithByeAndFinal(schedulerTeams, numRounds);
    const matches: ScheduleMatch[] = [];
    let matchId = 1;
    let tableNum = 1;
    const maxTables = Math.floor(tournamentTeams.length / 2);
    roundMatches.forEach((roundData, roundIndex) => {
      tableNum = 1;
      roundData.forEach(match => {
        if ('isBye' in match && match.isBye) {
          matches.push({
            id: `${selectedTournament}-r${roundIndex + 1}-bye${matchId++}`,
            teamA: match.team.id,
            teamB: 'BYE',
            round: roundIndex + 1,
            table: 0,
            tournamentId: selectedTournament,
            isBye: true,
            isSameCity: false
          });
        } else if ('teamA' in match && 'teamB' in match) {
          matches.push({
            id: `${selectedTournament}-r${roundIndex + 1}-m${matchId++}`,
            teamA: match.teamA.id,
            teamB: match.teamB.id,
            round: roundIndex + 1,
            table: Math.min(tableNum++, maxTables),
            tournamentId: selectedTournament,
            isBye: false,
            isSameCity: match.teamA.city === match.teamB.city
          });
        }
      });
    });
    
    const schedule: TournamentSchedule = {
      tournamentId: selectedTournament,
      rounds: roundMatches.length,
      matches
    };

    // Clear all existing results and data for this tournament before saving new schedule
    clearTournamentResults(selectedTournament);
    clearGames(selectedTournament);
    clearScoreSubmissions(selectedTournament);
    
    if (existingSchedule) {
      toast({ 
        title: 'Previous results cleared', 
        description: 'All scores and standings have been reset for the new schedule.',
        variant: 'default'
      });
    }
    
    setCurrentSchedule(schedule);
    saveSchedule(schedule);
    setIsScheduleLocked(true);
    
    const sameCityMatches = matches.filter(m => m.isSameCity).length;
    const byeMatches = matches.filter(m => m.isBye).length;
    let description = '';
    if (byeMatches > 0) description += `${byeMatches} bye matches. `;
    if (sameCityMatches > 0) description += `Warning: ${sameCityMatches} same-city matches found`;
    else if (byeMatches === 0) description = 'No same-city conflicts!';
    
    toast({ 
      title: `Schedule generated! ${roundMatches.length} rounds`,
      description: description || undefined
    });
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
              disabled={!selectedTournament || !numberOfRounds}
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
          </div>
        </CardContent>
      </Card>

      {currentSchedule && (
        <ScheduleDisplay 
          schedule={currentSchedule} 
          tournamentName={tournament?.name || ''} 
        />
      )}
    </div>
  );
};