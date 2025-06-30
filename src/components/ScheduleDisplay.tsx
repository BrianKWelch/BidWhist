import React from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { TournamentSchedule } from '@/contexts/AppContext';

interface ScheduleDisplayProps {
  schedule: TournamentSchedule;
  tournamentName: string;
}

export const ScheduleDisplay: React.FC<ScheduleDisplayProps> = ({ schedule, tournamentName }) => {
  const { teams, games, scoreSubmissions } = useAppContext();

  const getMatchStatus = (match: any) => {
    const completedGame = games.find(g => g.matchId === match.id && g.confirmed);
    if (completedGame) {
      const winner = completedGame.scoreA > completedGame.scoreB ? 
        teams.find(t => t.id === match.teamA) : teams.find(t => t.id === match.teamB);
      return `Completed - Team ${winner?.teamNumber || 'Unknown'} won ${Math.max(completedGame.scoreA, completedGame.scoreB)}-${Math.min(completedGame.scoreA, completedGame.scoreB)}`;
    }

    const submissions = scoreSubmissions.filter(s => s.matchId === match.id);
    if (submissions.length === 2) {
      const scoresMatch = submissions[0].scoreA === submissions[1].scoreA && 
                         submissions[0].scoreB === submissions[1].scoreB;
      return scoresMatch ? 'Confirming scores' : 'Score conflict - needs resolution';
    }
    if (submissions.length === 1) {
      const submittingTeam = teams.find(t => t.id === submissions[0].submittedBy);
      return `Waiting for opponent score (Team ${submittingTeam?.teamNumber || 'Unknown'} submitted)`;
    }

    if (match.teamA === 'TBD' || match.teamB === 'TBD') {
      if (match.round === 1) {
        return 'Ready to start';
      } else {
        const prevRoundMatches = schedule.matches.filter(m => m.round === match.round - 1);
        const incompletePrevMatches = prevRoundMatches.filter(m => 
          !games.find(g => g.matchId === m.id && g.confirmed)
        );
        
        if (incompletePrevMatches.length > 0) {
          return `Waiting for ${incompletePrevMatches.length} Round ${match.round - 1} match${incompletePrevMatches.length > 1 ? 'es' : ''} to complete`;
        } else {
          return 'Waiting for team assignment';
        }
      }
    }

    return 'Ready to score';
  };

  const getStatusColor = (status: string) => {
    if (status.includes('Completed')) return 'bg-green-100 border-green-300 text-green-800';
    if (status.includes('Ready to score')) return 'bg-blue-100 border-blue-300 text-blue-800';
    if (status.includes('Waiting for opponent score')) return 'bg-yellow-100 border-yellow-300 text-yellow-800';
    if (status.includes('Confirming scores')) return 'bg-orange-100 border-orange-300 text-orange-800';
    if (status.includes('Score conflict')) return 'bg-red-100 border-red-300 text-red-800';
    if (status.includes('Ready to start')) return 'bg-blue-100 border-blue-300 text-blue-800';
    return 'bg-gray-100 border-gray-300 text-gray-600';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Complete Tournament Schedule - {tournamentName}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {schedule.rounds} rounds total • {schedule.matches.length} matches
        </p>
      </CardHeader>
      <CardContent>
        {Array.from({ length: schedule.rounds }, (_, i) => i + 1).map(round => {
          const roundMatches = schedule.matches.filter(m => m.round === round);
          
          return (
            <div key={round} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="font-medium">
                  Round {round}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {roundMatches.length} match{roundMatches.length !== 1 ? 'es' : ''}
                </span>
              </div>
              <div className="space-y-3">
                {roundMatches.map(match => {
                  const teamA = teams.find(t => t.id === match.teamA);
                  const teamB = teams.find(t => t.id === match.teamB);
                  const status = getMatchStatus(match);
                  const statusColor = getStatusColor(status);
                  
                  return (
                    <div key={match.id} className={`p-4 border rounded-lg ${statusColor}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {match.teamA === 'TBD' ? 'Team TBD' : 
                             teamA ? `Team ${teamA.teamNumber}: ${teamA.name}` : `Team ${match.teamA}`}
                          </div>
                          {teamA && (
                            <div className="text-xs text-muted-foreground">
                              {teamA.player1FirstName} {teamA.player1LastName} & {teamA.player2FirstName} {teamA.player2LastName}
                            </div>
                          )}
                        </div>
                        <span className="text-muted-foreground mx-3 font-medium">vs</span>
                        <div className="flex-1 text-right">
                          <div className="font-medium text-sm">
                            {match.teamB === 'TBD' ? 'Team TBD' : 
                             teamB ? `Team ${teamB.teamNumber}: ${teamB.name}` : `Team ${match.teamB}`}
                          </div>
                          {teamB && (
                            <div className="text-xs text-muted-foreground">
                              {teamB.player1FirstName} {teamB.player1LastName} & {teamB.player2FirstName} {teamB.player2LastName}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-center">
                        <Badge variant="outline" className="text-xs px-2 py-1">
                          {status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
              {round < schedule.rounds && <Separator className="mt-4" />}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};