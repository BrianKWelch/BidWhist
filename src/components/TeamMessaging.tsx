import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Send, Phone } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { toast } from '@/components/ui/use-toast';
import { sendSMS } from '@/api/messaging';

const TeamMessaging: React.FC = () => {
  const { teams, tournaments, schedules } = useAppContext();
  const [selectedTournament, setSelectedTournament] = useState<string>('');
  const [messageTemplate, setMessageTemplate] = useState<string>('');
  const [customMessage, setCustomMessage] = useState<string>('');
  const [sending, setSending] = useState(false);

  const generateScheduleMessage = () => {
    if (!selectedTournament) return '';
    
    const tournament = tournaments.find(t => t.id === selectedTournament);
    const schedule = schedules.find(s => s.tournamentId === selectedTournament);
    
    if (!tournament || !schedule) return '';
    
    return `Hello! Here's your schedule for ${tournament.name}:\n\n` +
           `Tournament: ${tournament.name}\n` +
           `Total Rounds: ${schedule.rounds}\n\n` +
           `Your matches will be displayed in the app. Good luck!`;
  };

  const generateTeamSpecificMessage = (teamName: string) => {
    if (!selectedTournament) return '';
    
    const tournament = tournaments.find(t => t.id === selectedTournament);
    const schedule = schedules.find(s => s.tournamentId === selectedTournament);
    
    if (!tournament || !schedule) return '';
    
    const teamMatches = schedule.matches.filter(m => 
      m.teamA === teamName || m.teamB === teamName
    );
    
    let message = `Hello ${teamName}!\n\n`;
    message += `Here's your schedule for ${tournament.name}:\n\n`;
    
    teamMatches.forEach(match => {
      const opponent = match.teamA === teamName ? match.teamB : match.teamA;
      message += `Round ${match.round}: vs ${opponent}\n`;
    });
    
    message += `\nGood luck in the tournament!`;
    return message;
  };

  const handleSendMessages = async () => {
    if (!selectedTournament) {
      toast({ title: 'Please select a tournament', variant: 'destructive' });
      return;
    }
    
    const tournamentTeams = teams.filter(team => 
      team.registeredTournaments && team.registeredTournaments.includes(selectedTournament)
    );
    
    if (tournamentTeams.length === 0) {
      toast({ title: 'No teams found for this tournament', variant: 'destructive' });
      return;
    }

    const message = messageTemplate || customMessage;
    if (!message.trim()) {
      toast({ title: 'Please enter a message', variant: 'destructive' });
      return;
    }
    
    setSending(true);
    try {
      const phoneNumbers = tournamentTeams.map(team => team.phoneNumber);
      
      await sendSMS({
        to: phoneNumbers,
        body: message
      });
      
      toast({ 
        title: 'Messages Sent!', 
        description: `Successfully sent to ${tournamentTeams.length} teams`
      });
    } catch (error) {
      console.error('SMS error:', error);
      toast({ 
        title: 'SMS Error', 
        description: 'Failed to send messages. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSending(false);
    }
  };

  const tournament = tournaments.find(t => t.id === selectedTournament);
  const tournamentTeams = teams.filter(team => 
    team.registeredTournaments && team.registeredTournaments.includes(selectedTournament)
  );
  const schedule = schedules.find(s => s.tournamentId === selectedTournament);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Team Messaging
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Select Tournament</Label>
            <Select value={selectedTournament} onValueChange={setSelectedTournament}>
              <SelectTrigger>
                <SelectValue placeholder="Choose tournament" />
              </SelectTrigger>
              <SelectContent>
                {tournaments.map(tournament => {
                  const hasSchedule = schedules.some(s => s.tournamentId === tournament.id);
                  return (
                    <SelectItem key={tournament.id} value={tournament.id}>
                      {tournament.name} {hasSchedule ? '✓' : '(No Schedule)'}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {selectedTournament && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Badge variant="outline">
                  {tournamentTeams.length} teams
                </Badge>
                {schedule && (
                  <Badge variant="outline" className="bg-green-50">
                    Schedule Ready ({schedule.rounds} rounds)
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                <Label>Message Templates</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMessageTemplate(generateScheduleMessage())}
                    disabled={!schedule}
                  >
                    Schedule Notification
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCustomMessage('')}
                  >
                    Custom Message
                  </Button>
                </div>
              </div>

              <div>
                <Label>Message Content</Label>
                <Textarea
                  value={messageTemplate || customMessage}
                  onChange={(e) => {
                    if (messageTemplate) {
                      setMessageTemplate(e.target.value);
                    } else {
                      setCustomMessage(e.target.value);
                    }
                  }}
                  placeholder="Enter your message to teams..."
                  rows={6}
                />
              </div>

              <Button 
                onClick={handleSendMessages}
                className="w-full"
                disabled={(!messageTemplate && !customMessage) || sending}
              >
                <Send className="w-4 h-4 mr-2" />
                {sending ? 'Sending...' : 'Send Messages to All Teams'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedTournament && tournamentTeams.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Team Contact List</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {tournamentTeams.map(team => (
                <div key={team.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <div className="font-medium">{team.name}</div>
                    <div className="text-sm text-gray-600">{team.city}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">{team.phoneNumber}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const message = generateTeamSpecificMessage(team.name);
                        navigator.clipboard.writeText(message);
                        toast({ title: 'Message copied to clipboard' });
                      }}
                    >
                      Copy Message
                    </Button>
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

export default TeamMessaging;