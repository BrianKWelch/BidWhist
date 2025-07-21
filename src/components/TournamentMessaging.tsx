import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Users, Calendar, Send } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { toast } from '@/components/ui/use-toast';
import { sendSMS } from '@/api/messaging';
import RecipientEditor from './RecipientEditor';
import SampleMessages from './SampleMessages';

const TournamentMessaging: React.FC = () => {
  const { teams, tournaments, schedules } = useAppContext();
  const [selectedTournament, setSelectedTournament] = useState<string>('');
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [messageType, setMessageType] = useState<'schedule' | 'general'>('schedule');
  const [message, setMessage] = useState('');
  const [recipients, setRecipients] = useState<string[]>(['555-123-4567']);
  const [sending, setSending] = useState(false);

  const generateScheduleMessage = (round: number) => {
    if (!selectedTournament) return '';
    
    const tournament = tournaments.find(t => t.id === selectedTournament);
    const schedule = schedules.find(s => s.tournamentId === selectedTournament);
    
    if (!tournament || !schedule) return '';
    
    const roundMatches = schedule.matches.filter(m => m.round === round);
    
    let message = `🏆 ${tournament.name} - Round ${round} Schedule\n\n`;
    
    roundMatches.forEach((match, index) => {
      const tableNum = (index % 3) + 1;
      message += `Table ${tableNum}: ${match.teamA} vs ${match.teamB}\n`;
    });
    
    message += `\nGood luck to all teams! 🎯`;
    return message;
  };

  const tournament = tournaments.find(t => t.id === selectedTournament);
  const tournamentTeams = teams.filter(team => 
    team.registeredTournaments && team.registeredTournaments.includes(selectedTournament)
  );
  const schedule = schedules.find(s => s.tournamentId === selectedTournament);
  const maxRounds = schedule?.rounds || 1;

  React.useEffect(() => {
    if (messageType === 'schedule') {
      setMessage(generateScheduleMessage(selectedRound));
    } else {
      setMessage('');
    }
  }, [messageType, selectedRound, selectedTournament]);

  const sendMessage = async () => {
    if (!message.trim() || recipients.length === 0) {
      toast({ 
        title: 'Error', 
        description: 'Please enter a message and ensure there are recipients',
        variant: 'destructive'
      });
      return;
    }

    setSending(true);
    try {
      const smsData = {
        to: recipients,
        body: message
      };
      
      await sendSMS(smsData);
      
      toast({ 
        title: 'SMS Messages Sent!', 
        description: `Successfully sent to ${recipients.length} phone numbers` 
      });
      
      if (messageType === 'general') {
        setMessage('');
      }
    } catch (error) {
      console.error('SMS error:', error);
      toast({ 
        title: 'SMS Error', 
        description: 'Failed to send SMS messages. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Tournament Messaging
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Tournament</Label>
              <Select value={selectedTournament} onValueChange={setSelectedTournament}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tournament" />
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
              <Label>Message Type</Label>
              <Select value={messageType} onValueChange={(v: 'schedule' | 'general') => setMessageType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="schedule">
                    <Calendar className="w-4 h-4 mr-2 inline" />
                    Schedule Update
                  </SelectItem>
                  <SelectItem value="general">
                    <MessageSquare className="w-4 h-4 mr-2 inline" />
                    General Message
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {messageType === 'schedule' && schedule && (
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
            )}
          </div>

          {selectedTournament && (
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {tournamentTeams.length} teams
              </Badge>
              {schedule && (
                <Badge variant="outline" className="bg-green-50">
                  {schedule.rounds} rounds scheduled
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <RecipientEditor
            recipients={recipients}
            onRecipientsChange={setRecipients}
            title="Team Phone Numbers"
          />
          
          <Card>
            <CardHeader>
              <CardTitle>Message</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter your message"
                rows={6}
              />
              
              <Button
                onClick={sendMessage}
                disabled={sending || recipients.length === 0 || !message.trim()}
                className="w-full"
              >
                <Send className="w-4 h-4 mr-2" />
                {sending ? 'Sending...' : `Send SMS to ${recipients.length} recipients`}
              </Button>
            </CardContent>
          </Card>
        </div>
        
        <SampleMessages
          onSelectMessage={setMessage}
          tournamentName={tournament?.name}
        />
      </div>
    </div>
  );
};

export default TournamentMessaging;