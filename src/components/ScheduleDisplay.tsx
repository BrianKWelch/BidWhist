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
      const winnerId = completedGame.scoreA > completedGame.scoreB ? match.teamA : match.teamB;
      const winner = teams.find(t => String(t.id) === String(winnerId));
      return `Completed - Team ${winner?.teamNumber || winner?.id || 'Unknown'} won ${Math.max(completedGame.scoreA, completedGame.scoreB)}-${Math.min(completedGame.scoreA, completedGame.scoreB)}`;
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

  const getPlaceholderLabel = (id: string) => {
    const loserMatch = /^R(\d+)L(\d+)$/.exec(id);
    if (loserMatch) {
      return `Loser of Table ${loserMatch[2]}, Round ${loserMatch[1]}`;
    }
    const winnerMatch = /^R(\d+)W(\d+)$/.exec(id);
    if (winnerMatch) {
      return `Winner of Table ${winnerMatch[2]}, Round ${winnerMatch[1]}`;
    }
    const byeMatch = /^R(\d+)Bye(\d+)$/.exec(id);
    if (byeMatch) {
      return `Bye from Round ${byeMatch[1]}, Slot ${byeMatch[2]}`;
    }
    // Try to find a real team by ID
    const team = teams.find(t => String(t.id) === String(id));
    if (team) {
      return `Team ${team.teamNumber || team.id}: ${team.name}`;
    }
    return id;
  };

  // REMOVE_ME: File name display for testing
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
          // Sort matches by match.table (if present)
          const sortedMatches = roundMatches.slice().sort((a, b) => {
            if (a.table && b.table) return a.table - b.table;
            if (a.table) return -1;
            if (b.table) return 1;
            return 0;
          });
          // When rendering matches for a round:
          const totalTeams = teams.length;
          const numTables = Math.floor(totalTeams / 2);
          const byes = roundMatches.filter(m => m.isBye || !('table' in m) || (m.table && m.table > numTables));
          const realMatches = roundMatches.filter(m => m.table && m.table >= 1 && m.table <= numTables).sort((a, b) => a.table - b.table);
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
                {/* Render byes first (no table number) */}
                {byes.map(match => {
                  // Render bye card (no table number)
                  const team = teams.find(t => t.id === match.teamA) || { name: match.teamA, teamNumber: '', player1FirstName: '', player1LastName: '', player2FirstName: '', player2LastName: '', city: '' };
                  return (
                    <div key={match.id} className={`p-2 md:p-4 border rounded-lg bg-yellow-50 border-yellow-300 text-yellow-800`}>
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2 gap-2 md:gap-0">
                        <div className="flex-1 font-medium text-xs md:text-sm">
                          Team {('teamNumber' in team && team.teamNumber) ? team.teamNumber : (('id' in team && team.id) ? team.id : '?')}: {team.name} has a <span className="font-bold">BYE</span> this round
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-center items-center gap-1 md:gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px] md:text-xs px-1.5 py-0.5 md:px-2 md:py-1 bg-yellow-100 border-yellow-300 text-yellow-800">
                          BYE
                        </Badge>
                      </div>
                    </div>
                  );
                })}
                {/* Render real matches with table numbers */}
                {realMatches.map(match => {
                  // Render match card with Table {match.table}
                  const teamA = teams.find(t => String(t.id) === String(match.teamA));
                  const teamB = teams.find(t => String(t.id) === String(match.teamB));
                  const status = getMatchStatus(match);
                  const statusColor = getStatusColor(status);
                  return (
                    <div key={match.id} className={`p-2 md:p-4 border rounded-lg ${statusColor}`}>
                      <div className="flex flex-col items-center mb-2">
                        {match.table && (
                          <span className="rounded-full bg-green-100 text-green-800 px-4 py-1 text-xs font-semibold mb-2">
                            Table {match.table}
                          </span>
                        )}
                        <div className="flex w-full justify-between items-center">
                          <div className="text-left flex-1">
                            <div className="font-bold text-base">
                              {teamA ? `Team ${teamA.teamNumber || teamA.id}` : getPlaceholderLabel(match.teamA)}
                            </div>
                            <div className="text-sm">{teamA ? teamA.name : ''}</div>
                            <div className="text-xs text-gray-500">{teamA ? teamA.city : ''}</div>
                          </div>
                          <div className="text-center px-4 font-bold text-lg">vs</div>
                          <div className="text-right flex-1">
                            <div className="font-bold text-base">
                              {teamB ? `Team ${teamB.teamNumber || teamB.id}` : getPlaceholderLabel(match.teamB)}
                            </div>
                            <div className="text-sm">{teamB ? teamB.name : ''}</div>
                            <div className="text-xs text-gray-500">{teamB ? teamB.city : ''}</div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-center items-center gap-1 md:gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px] md:text-xs px-1.5 py-0.5 md:px-2 md:py-1">
                          {status}
                        </Badge>
                        {teamA && teamB && teamA.city === teamB.city && (
                          <Badge variant="destructive" className="text-[10px] md:text-xs px-1.5 py-0.5 md:px-2 md:py-1">
                            Same City
                          </Badge>
                        )}
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