import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Send, Copy } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { toast } from '@/components/ui/use-toast';

const ScheduleMessaging: React.FC = () => {
  const { teams, tournaments, schedules } = useAppContext();
  const [selectedTournament, setSelectedTournament] = useState<string>('');
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [customMessage, setCustomMessage] = useState<string>('');

  const generateRoundMessage = (round: number) => {
    if (!selectedTournament) return '';
    
    const tournament = tournaments.find(t => t.id === selectedTournament);
    const schedule = schedules.find(s => s.tournamentId === selectedTournament);
    
    if (!tournament || !schedule) return '';
    
    const roundMatches = schedule.matches.filter(m => m.round === round);
    const tables = ['Table 1', 'Table 2', 'Table 3'];
    
    let message = `🏆 ${tournament.name} - Round ${round} Schedule\n\n`;
    
    roundMatches.forEach((match, index) => {
      const tableNum = (index % 3) + 1;
      message += `${tables[tableNum - 1]}: ${match.teamA} vs ${match.teamB}\n`;
    });
    
    message += `\nGood luck to all teams! 🎯`;
    return message;
  };

  const generateTeamSpecificMessage = (teamName: string, round: number) => {
    if (!selectedTournament) return '';
    
    const tournament = tournaments.find(t => t.id === selectedTournament);
    const schedule = schedules.find(s => s.tournamentId === selectedTournament);
    
    if (!tournament || !schedule) return '';
    
    const teamMatch = schedule.matches.find(m => 
      m.round === round && (m.teamA === teamName || m.teamB === teamName)
    );
    
    if (!teamMatch) return `${teamName}: You have a BYE in Round ${round}`;
    
    const opponent = teamMatch.teamA === teamName ? teamMatch.teamB : teamMatch.teamA;
    const matchIndex = schedule.matches.filter(m => m.round === round).findIndex(m => m.id === teamMatch.id);
    const tableNum = (matchIndex % 3) + 1;
    
    return `🏆 ${tournament.name} - Round ${round}\n\n` +
           `Team: ${teamName}\n` +
           `Opponent: ${opponent}\n` +
           `Table: Table ${tableNum}\n\n` +
           `Good luck! 🎯`;
  };

  const tournament = tournaments.find(t => t.id === selectedTournament);
  const tournamentTeams = teams.filter(team => 
    team.registeredTournaments && team.registeredTournaments.includes(selectedTournament)
  );
  const schedule = schedules.find(s => s.tournamentId === selectedTournament);
  const maxRounds = schedule?.rounds || 1;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Schedule Messaging
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tournament</Label>
              <Select value={selectedTournament} onValueChange={setSelectedTournament}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tournament" />
                </SelectTrigger>
                <SelectContent>
                  {tournaments.map(tournament => {
                    const hasSchedule = schedules.some(s => s.tournamentId === tournament.id);
                    return (
                      <SelectItem key={tournament.id} value={tournament.id} disabled={!hasSchedule}>
                        {tournament.name} {hasSchedule ? '✓' : '(No Schedule)'}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Round</Label>
              <Select value={selectedRound.toString()} onValueChange={(v) => setSelectedRound(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({length: maxRounds}, (_, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      Round {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedTournament && schedule && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Badge variant="outline">
                  {tournamentTeams.length} teams
                </Badge>
                <Badge variant="outline" className="bg-green-50">
                  {schedule.rounds} rounds scheduled
                </Badge>
              </div>

              <div>
                <Label>Round {selectedRound} Schedule Message</Label>
                <Textarea
                  value={generateRoundMessage(selectedRound)}
                  readOnly
                  rows={8}
                  className="font-mono text-sm"
                />
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(generateRoundMessage(selectedRound));
                      toast({ title: 'Round message copied to clipboard' });
                    }}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Round Message
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedTournament && schedule && (
        <Card>
          <CardHeader>
            <CardTitle>Individual Team Messages - Round {selectedRound}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tournamentTeams.map(team => (
                <div key={team.id} className="border rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">{team.name}</div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const message = generateTeamSpecificMessage(team.name, selectedRound);
                        navigator.clipboard.writeText(message);
                        toast({ title: `Message for ${team.name} copied` });
                      }}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                  <div className="text-sm text-gray-600 font-mono whitespace-pre-line">
                    {generateTeamSpecificMessage(team.name, selectedRound)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ScheduleMessaging;