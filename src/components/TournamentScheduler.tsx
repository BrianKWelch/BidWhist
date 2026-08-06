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
import { ScheduleEditor } from './ScheduleEditor';
import { generateNRoundsWithByeAndFinal } from '@/lib/scheduler';
import type { TournamentSchedule, ScheduleMatch } from '@/contexts/AppContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export const TournamentScheduler: React.FC = () => {
  const { teams, tournaments, schedules, games, saveSchedule, sendScoreSheetLinks, clearTournamentResults, clearGames, clearScoreSubmissions, getActiveTournament, generateMaltNextRound, generateMaltMakeupRound, refreshTournaments } = useAppContext();
  const [selectedTournament, setSelectedTournament] = useState<string>('');
  const [numberOfRounds, setNumberOfRounds] = useState<string>('4');
  const [currentSchedule, setCurrentSchedule] = useState<TournamentSchedule | null>(null);
  const [isScheduleLocked, setIsScheduleLocked] = useState(false);
  const [linksSent, setLinksSent] = useState(false);
  const [showByeDialog, setShowByeDialog] = useState(false);
  const [byeTeamsList, setByeTeamsList] = useState<string[]>([]);
  const [showScheduleEditor, setShowScheduleEditor] = useState(false);
  const [scheduleOption, setScheduleOption] = useState<'A' | 'B' | null>(null);

  // Default to active tournament when component mounts
  useEffect(() => {
    const activeTournament = getActiveTournament();
    if (activeTournament && !selectedTournament) {
      setSelectedTournament(activeTournament.id);
    }
  }, [getActiveTournament, selectedTournament]);

  useEffect(() => {
    if (selectedTournament) {
      const existingSchedule = schedules.find(s => s.tournamentId === selectedTournament);
      if (existingSchedule) {
        setCurrentSchedule(existingSchedule);
        const t = tournaments.find(t => t.id === selectedTournament);
        if (t?.rotationType === 'malt') {
          // For MALT: use stored maltRounds if available; otherwise keep whatever the admin typed (default '4')
          if (t.maltRounds) setNumberOfRounds(t.maltRounds.toString());
        } else {
          setNumberOfRounds(existingSchedule.rounds ? existingSchedule.rounds.toString() : '4');
        }
        setIsScheduleLocked(false);
      } else {
        setCurrentSchedule(null);
        setNumberOfRounds('4');
        setIsScheduleLocked(false);
      }
    }
  }, [selectedTournament, schedules, tournaments]);

  const generateSchedule = () => {
    if (!selectedTournament || !numberOfRounds) {
      toast({ title: 'Please select tournament and number of rounds', variant: 'destructive' });
      return;
    }

    const tournamentTeams = teams.filter(team =>
      team.registeredTournaments?.includes(selectedTournament)
    );

    if (tournamentTeams.length < 2) {
      toast({ title: 'Need at least 2 teams to generate schedule', variant: 'destructive' });
      return;
    }

    // MALT: generate only Round 1 directly, no dialog
    if (tournament?.rotationType === 'malt') {
      void generateMaltRound1(tournamentTeams);
      return;
    }

    // Standard: show option selection dialog
    setScheduleOption(null);
    setShowScheduleEditor(true);
  };

  const handleScheduleOptionSelect = (option: 'A' | 'B') => {
    setScheduleOption(option);
    
    if (option === 'A') {
      // Option A: Use ScheduleEditor
      setShowScheduleEditor(true);
    } else {
      // Option B: Use existing logic (for now)
      generateOptionBSchedule();
    }
  };

  const generateOptionBSchedule = () => {
    const tournamentTeams = teams.filter(team => 
      team.registeredTournaments?.includes(selectedTournament)
    );

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

    // Collect all teams that received a bye in any round
    const allByeTeams = new Set<string>();
    roundMatches.forEach(round => {
      round.forEach(m => {
        if ('isBye' in m && m.isBye) {
          allByeTeams.add(m.team.name);
        }
      });
    });

    // Add bye team names to the message
    if (allByeTeams.size > 0) {
      description += `\nTeams with byes: ${Array.from(allByeTeams).join(', ')}`;
      setByeTeamsList(Array.from(allByeTeams));
      setShowByeDialog(true);
    }

    toast({ 
      title: `Schedule generated! ${roundMatches.length} rounds`,
      description: description || undefined
    });
  };

  const generateMaltRound1 = async (tournamentTeams: typeof teams) => {
    const existingSchedule = schedules.find(s => s.tournamentId === selectedTournament);
    if (existingSchedule) {
      const confirmed = window.confirm(
        'Generating a new schedule will clear all existing results, scores, and standings for this tournament. Are you sure?'
      );
      if (!confirmed) return;
    }

    const schedulerTeams = tournamentTeams.map(team => ({
      id: team.id,
      name: team.name,
      city: team.city
    }));

    const allRounds = generateNRoundsWithByeAndFinal(schedulerTeams, 1);
    const round1 = allRounds[0];

    const matches: ScheduleMatch[] = [];
    let matchId = 1;
    let tableNum = 1;
    const maxTables = Math.floor(tournamentTeams.length / 2);

    round1.forEach(match => {
      if ('teamA' in match && 'teamB' in match) {
        const isBye = match.teamA.id === 'BYE' || match.teamB.id === 'BYE';
        matches.push({
          id: `${selectedTournament}-r1-m${matchId++}`,
          teamA: match.teamA.id,
          teamB: match.teamB.id,
          round: 1,
          table: Math.min(tableNum++, maxTables),
          tournamentId: selectedTournament,
          isBye,
          isSameCity: match.teamA.city === match.teamB.city
        });
      }
    });

    const schedule: TournamentSchedule = {
      tournamentId: selectedTournament,
      rounds: 1,
      matches
    };

    clearTournamentResults(selectedTournament);
    clearGames(selectedTournament);
    clearScoreSubmissions(selectedTournament);

    setCurrentSchedule(schedule);
    saveSchedule(schedule);
    setIsScheduleLocked(true);

    // Save total rounds to tournament record and refresh so numberOfRounds stays correct
    try {
      const { supabase } = await import('../supabaseClient');
      await supabase.from('tournaments').update({ malt_rounds: numRoundsInt }).eq('id', selectedTournament);
      await refreshTournaments();
    } catch (e) {
      console.warn('Could not save malt_rounds:', e);
    }

    const nonByeCount = matches.filter(m => !m.isBye).length;
    toast({
      title: `MALT Round 1 generated! (${nonByeCount} tables)`,
      description: 'Generate the next round after all games are confirmed.'
    });
  };

  const handleScheduleSave = (schedule: TournamentSchedule) => {
    // Clear all existing results and data for this tournament before saving new schedule
    clearTournamentResults(selectedTournament);
    clearGames(selectedTournament);
    clearScoreSubmissions(selectedTournament);
    
    setCurrentSchedule(schedule);
    saveSchedule(schedule);
    setIsScheduleLocked(true);
    setShowScheduleEditor(false);
    
    toast({ 
      title: 'Schedule saved successfully!',
      description: `${schedule.rounds} rounds generated with ${schedule.matches.length} matches.`,
      variant: 'default'
    });
  };

  const handleScheduleCancel = () => {
    setShowScheduleEditor(false);
    setScheduleOption(null);
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

  const isMalt = tournament?.rotationType === 'malt';
  // For MALT: read the stored total directly from the tournament record so it
  // can never be overwritten by the generated round count.
  const numRoundsInt = isMalt
    ? (tournament?.maltRounds || parseInt(numberOfRounds) || 4)
    : (parseInt(numberOfRounds) || 4);
  const maltCurrentRound = currentSchedule?.rounds ?? 0;
  const maltCurrentRoundMatches = currentSchedule?.matches.filter(m => m.round === maltCurrentRound && !m.isBye) ?? [];
  const maltRoundComplete = maltCurrentRoundMatches.length > 0 &&
    maltCurrentRoundMatches.every(m => games.some(g => g.matchId === m.id && (g.confirmed || g.status === 'confirmed')));
  const maltRoundHasResults = maltCurrentRoundMatches.length > 0 &&
    maltCurrentRoundMatches.every(m => games.some(g => g.matchId === m.id && g.winner));
  const maltConfirmedCount = maltCurrentRoundMatches.filter(m =>
    games.some(g => g.matchId === m.id && (g.confirmed || g.status === 'confirmed'))
  ).length;
  const maltHasByes = (currentSchedule?.matches ?? []).some(m => m.isBye);
  const maltCanGenerateNext = isMalt && !!currentSchedule && maltCurrentRound < numRoundsInt && maltRoundHasResults;
  const maltCanGenerateMakeup = isMalt && !!currentSchedule && maltCurrentRound >= numRoundsInt && maltRoundComplete && maltHasByes;

  const teamsByCity = tournamentTeams.reduce((acc, team) => {
    if (!acc[team.city]) acc[team.city] = 0;
    acc[team.city]++;
    return acc;
  }, {} as { [city: string]: number });

  return (
    <div className="space-y-6">
      {/* Schedule Editor Modal */}
      {showScheduleEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <ScheduleEditor
              tournamentId={selectedTournament}
              teams={teams.filter(team => team.registeredTournaments?.includes(selectedTournament))}
              numberOfRounds={parseInt(numberOfRounds)}
              onSave={handleScheduleSave}
              onCancel={handleScheduleCancel}
              existingSchedule={currentSchedule}
            />
          </div>
        </div>
      )}

             <Card className="border-2" style={{ borderColor: '#a60002' }}>
        <CardHeader className="border-b-2 pb-2" style={{ borderColor: '#a60002' }}>
          <div className="flex items-center gap-2">
            <img src={import.meta.env.BASE_URL + 'sched.png'} alt="Schedule" className="h-5 w-5" style={{ filter: 'brightness(0)' }} />
                         <CardTitle>
               Tournament Scheduler
             </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end mt-4">
            <div className="w-48">
              <Label htmlFor="tournament">Tournament</Label>
              <Select value={selectedTournament} onValueChange={setSelectedTournament}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
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
            <div className="w-20">
              <Label htmlFor="rounds">Rounds</Label>
              <Input
                id="rounds"
                type="number"
                value={numberOfRounds}
                onChange={(e) => setNumberOfRounds(e.target.value)}
                placeholder="4"
                min="1"
                max="10"
              />
            </div>
            {selectedTournament && (
              <div className="w-48">
                <Label>Teams</Label>
                <div className="text-sm font-medium">
                  {tournamentTeams.length}
                </div>
              </div>
            )}
            {selectedTournament && (
              <div className="w-20">
                <Label>Tables</Label>
                <div className="text-sm text-blue-600">
                  {maxTablesForTournament}
                </div>
              </div>
            )}
            {selectedTournament && tournament && (
              <div className="w-48">
                <Label>Scoring</Label>
                <div className="text-sm font-medium">
                  {tournament.scoringMode === 'admin' ? 'Admin Only' : 'Teams Enter Scores'}
                </div>
              </div>
            )}
            <div className="flex flex-col items-center">
              <Button 
                onClick={generateSchedule}
                disabled={!selectedTournament || !numberOfRounds}
                size="sm"
                className="h-20 w-20 p-0 text-lg font-bold"
                style={{ backgroundColor: 'black', color: 'white' }}
              >
                Run
              </Button>
              {selectedTournament && isOdd && (
                <Badge variant="secondary" className="text-xs mt-2">
                  Odd - Byes Required
                </Badge>
              )}
            </div>
          </div>
          


          {isScheduleLocked && currentSchedule && (
            <div className="flex gap-2">
              <Button
                onClick={handleSendScoreSheets}
                disabled={linksSent}
                variant="secondary"
                className="flex-1"
              >
                {linksSent ? 'Links Sent ✓' : 'Send Score Sheet Out'}
              </Button>
            </div>
          )}

          {isMalt && currentSchedule && (
            <div className="flex items-center gap-3 pt-1 flex-wrap">
              <Badge variant="outline" className="border-blue-400 text-blue-700 text-sm px-3 py-1">
                Round {maltCurrentRound} of {numRoundsInt}
              </Badge>
              {maltCurrentRoundMatches.length > 0 && (
                <Badge
                  variant="outline"
                  className={`text-sm px-3 py-1 ${maltRoundComplete ? 'border-green-500 text-green-700' : 'border-amber-400 text-amber-700'}`}
                >
                  {maltConfirmedCount}/{maltCurrentRoundMatches.length} confirmed
                </Badge>
              )}
              {maltCanGenerateNext && (
                <Button
                  size="sm"
                  style={{ backgroundColor: '#1d4ed8', color: 'white' }}
                  onClick={async () => {
                    if (!tournament?.maltRounds && numRoundsInt > 0) {
                      try {
                        const { supabase } = await import('../supabaseClient');
                        await supabase.from('tournaments').update({ malt_rounds: numRoundsInt }).eq('id', selectedTournament);
                        await refreshTournaments();
                      } catch (e) { console.warn('Could not persist malt_rounds:', e); }
                    }
                    const ok = await generateMaltNextRound(selectedTournament);
                    if (ok) toast({ title: `Round ${maltCurrentRound + 1} generated!` });
                    else toast({ title: 'Could not generate next round.', variant: 'destructive' });
                  }}
                >
                  Generate Round {maltCurrentRound + 1}
                </Button>
              )}
              {maltCanGenerateMakeup && (
                <Button
                  size="sm"
                  style={{ backgroundColor: '#15803d', color: 'white' }}
                  onClick={async () => {
                    const ok = await generateMaltMakeupRound(selectedTournament);
                    if (ok) toast({ title: 'Makeup round generated!' });
                    else toast({ title: 'Could not generate makeup round.', variant: 'destructive' });
                  }}
                >
                  Generate Makeup Round
                </Button>
              )}
              {isMalt && currentSchedule && maltCurrentRound >= numRoundsInt && maltRoundComplete && !maltHasByes && (
                <Badge variant="outline" className="border-green-500 text-green-700 text-sm px-3 py-1">
                  All rounds complete
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {currentSchedule && (
        <ScheduleDisplay 
          schedule={currentSchedule} 
          tournamentName={tournament?.name || ''} 
        />
      )}

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