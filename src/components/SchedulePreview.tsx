import React, { useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { generateScheduleMessage } from './TeamScheduleMessage';

interface SchedulePreviewProps {
  tournamentId: string;
}

export const SchedulePreview: React.FC<SchedulePreviewProps> = ({ tournamentId }) => {
  const { teams, schedules, tournaments } = useAppContext();
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [showAll, setShowAll] = useState(false);

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

  const getScheduleMessage = (teamName: string) => {
    return generateScheduleMessage(teamName, schedule.matches, tournament.name);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Schedule Message Preview</CardTitle>
          <p className="text-sm text-muted-foreground">
            Preview the SMS messages that will be sent to each team
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a team to preview" />
                </SelectTrigger>
                <SelectContent>
                  {tournamentTeams.map(team => (
                    <SelectItem key={team.id} value={team.name}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              variant="outline"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? 'Show Selected Only' : 'Show All Teams'}
            </Button>
          </div>
          
          <div className="text-sm text-muted-foreground">
            <Badge variant="outline">{tournament.name}</Badge>
            <span className="ml-2">{tournamentTeams.length} teams • {schedule.rounds} rounds</span>
          </div>
        </CardContent>
      </Card>

      {showAll ? (
        <div className="space-y-4">
          {tournamentTeams.map(team => (
            <Card key={team.id}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>{team.name}</span>
                  <Badge variant="secondary">{team.phone_Number}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <pre className="whitespace-pre-wrap text-sm font-mono">
                    {getScheduleMessage(team.name)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : selectedTeam ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Schedule for {selectedTeam}</span>
              <Badge variant="secondary">
                {tournamentTeams.find(t => t.name === selectedTeam)?.phone_Number}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 p-4 rounded-lg border">
              <pre className="whitespace-pre-wrap text-sm font-mono">
                {getScheduleMessage(selectedTeam)}
              </pre>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};