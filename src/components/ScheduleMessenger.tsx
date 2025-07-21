import React, { useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/use-toast';
import { TeamScheduleMessage, generateScheduleMessage } from './TeamScheduleMessage';
import { sendSMS } from '@/api/messaging';

interface ScheduleMessengerProps {
  tournamentId: string;
}

export const ScheduleMessenger: React.FC<ScheduleMessengerProps> = ({ tournamentId }) => {
  const { teams, schedules, tournaments } = useAppContext();
  const [sending, setSending] = useState(false);
  const [sentTeams, setSentTeams] = useState<string[]>([]);
  const [previewTeam, setPreviewTeam] = useState<string>('');

  const schedule = schedules.find(s => s.tournamentId === tournamentId);
  const tournament = tournaments.find(t => t.id === tournamentId);
  const tournamentTeams = teams.filter(team => 
    team.registeredTournaments?.includes(tournamentId)
  );

  if (!schedule || !tournament) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">No schedule found for this tournament</p>
        </CardContent>
      </Card>
    );
  }

  const sendScheduleToTeam = async (team: any) => {
    const message = generateScheduleMessage(team.name, schedule.matches, tournament.name);
    
    try {
      await sendSMS(team.phone_Number, message);
      setSentTeams(prev => [...prev, team.id]);
      toast({ title: `Schedule sent to ${team.name}` });
    } catch (error) {
      toast({ 
        title: `Failed to send to ${team.name}`, 
        description: 'Check phone number and try again',
        variant: 'destructive' 
      });
    }
  };

  const sendToAllTeams = async () => {
    setSending(true);
    
    for (const team of tournamentTeams) {
      if (!sentTeams.includes(team.id)) {
        await sendScheduleToTeam(team);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
      }
    }
    
    setSending(false);
    toast({ title: 'All schedule messages sent!' });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Send Tournament Schedules</CardTitle>
          <p className="text-sm text-muted-foreground">
            Send each team their personalized tournament schedule via SMS
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{tournament.name}</p>
              <p className="text-sm text-muted-foreground">
                {tournamentTeams.length} teams • {schedule.rounds} rounds
              </p>
            </div>
            <Button 
              onClick={sendToAllTeams}
              disabled={sending || sentTeams.length === tournamentTeams.length}
            >
              {sending ? 'Sending...' : 'Send to All Teams'}
            </Button>
          </div>
          
          <Separator />
          
          <div className="space-y-3">
            <h4 className="font-medium">Team Status</h4>
            {tournamentTeams.map(team => (
              <div key={team.id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <span className="font-medium">{team.name}</span>
                  <span className="text-sm text-muted-foreground ml-2">
                    {team.phone_Number}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {sentTeams.includes(team.id) ? (
                    <Badge variant="default">Sent ✓</Badge>
                  ) : (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setPreviewTeam(previewTeam === team.name ? '' : team.name)}
                      >
                        Preview
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => sendScheduleToTeam(team)}
                        disabled={sending}
                      >
                        Send
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {previewTeam && (
        <TeamScheduleMessage 
          teamName={previewTeam} 
          tournamentId={tournamentId} 
        />
      )}
    </div>
  );
};