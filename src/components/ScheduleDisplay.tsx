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
    const completedGame = games.find((g) => g.matchId === match.id && g.confirmed);
    if (completedGame) {
      const winner =
        completedGame.scoreA > completedGame.scoreB
          ? teams.find((t) => String(t.id) === String(match.teamA))
          : teams.find((t) => String(t.id) === String(match.teamB));
      const loserTeam = winner === teams.find((t) => String(t.id) === String(match.teamA)) ? teams.find((t)=> String(t.id) === String(match.teamB)) : teams.find((t)=> String(t.id) === String(match.teamA));
      return `Winner - Team ${winner?.teamNumber ?? winner?.id ?? 'Unknown'} ${Math.max(completedGame.scoreA, completedGame.scoreB)} ***** Loser - Team ${loserTeam?.teamNumber ?? loserTeam?.id ?? 'Unknown'} ${Math.min(completedGame.scoreA, completedGame.scoreB)}`;

    }

    const submissions = scoreSubmissions.filter((s) => s.matchId === match.id);
    if (submissions.length === 2) {
      const scoresMatch =
        submissions[0].scoreA === submissions[1].scoreA &&
        submissions[0].scoreB === submissions[1].scoreB;
      return scoresMatch ? 'Confirming scores' : 'Score conflict - needs resolution';
    }
    if (submissions.length === 1) {
      const submittingTeam = teams.find((t) => String(t.id) === String(submissions[0].submittedBy));
      return `Waiting for opponent score (Team ${submittingTeam?.teamNumber || 'Unknown'} submitted)`;
    }

    if (match.teamA === 'TBD' || match.teamB === 'TBD') {
      if (match.round === 1) {
        return 'Ready to start';
      } else {
        const prevRoundMatches = schedule.matches.filter((m) => m.round === match.round - 1);
        const incompletePrevMatches = prevRoundMatches.filter(
          (m) => !games.find((g) => g.matchId === m.id && g.confirmed),
        );
        if (incompletePrevMatches.length > 0) {
          return `Waiting for ${incompletePrevMatches.length} Round ${match.round - 1} match${
            incompletePrevMatches.length > 1 ? 'es' : ''
          } to complete`;
        } else {
          return 'Waiting for team assignment';
        }
      }
    }

    return 'Ready to score';
  };

  const getStatusColor = (status: string) => {
    if (status.includes('Completed') || status.includes('Winner')) return 'bg-green-100 border-green-300 text-green-800';
    if (status.includes('Ready to score')) return 'bg-blue-100 border-blue-300 text-blue-800';
    if (status.includes('Waiting for opponent score'))
      return 'bg-yellow-100 border-yellow-300 text-yellow-800';
    if (status.includes('Confirming scores')) return 'bg-orange-100 border-orange-300 text-orange-800';
    if (status.includes('Score conflict')) return 'bg-red-100 border-red-300 text-red-800';
    if (status.includes('Ready to start')) return 'bg-blue-100 border-blue-300 text-blue-800';
    return 'bg-gray-100 border-gray-300 text-gray-600';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Complete Tournament Schedule - {tournamentName}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {schedule.rounds} rounds total • {schedule.matches.length} matches
        </p>
      </CardHeader>
      <CardContent>
        {Array.from({ length: schedule.rounds }, (_, i) => i + 1).map((round) => {
          const roundMatches = schedule.matches.filter((m) => m.round === round);
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
                {roundMatches.map((match) => {
                  // BYE ROUND
                  if (match.isBye) {
                    const team =
                      teams.find((t) => String(t.id) === String(match.teamA)) ||
                      ({ name: match.teamA, teamNumber: '', city: '' } as any);
                    return (
                      <div
                        key={match.id}
                        className="p-2 md:p-4 border rounded-lg bg-green-100 border-green-300 text-green-800"
                      >
                        <div className="flex flex-col md:flex-row md:justify-between gap-2">
                          <div className="flex-1">
                            <div className="font-bold text-xs md:text-sm">
                              Team {team.teamNumber || team.id}
                            </div>
                            <div className="text-[10px] md:text-xs font-medium">{team.name}</div>
                            <div className="text-[10px] md:text-xs text-blue-600">{team.city}</div>
                          </div>
                          <div className="flex items-center justify-center">
                            <Badge
                              variant="outline"
                              className="text-[10px] md:text-xs px-2 py-1 bg-yellow-100 border-yellow-300 text-yellow-800"
                            >
                              BYE
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // REGULAR MATCH
                  const teamA = teams.find((t) => String(t.id) === String(match.teamA));
                  const teamB = teams.find((t) => String(t.id) === String(match.teamB));
                  const status = getMatchStatus(match);
                  const statusColor = getStatusColor(status);

                  return (
                    <div
                      key={match.id}
                      className={`p-2 md:p-4 border rounded-lg ${statusColor}`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        {/* TEAM A */}
                        <div className="flex-1">
                          <div className="font-bold text-xs md:text-sm">
                            {match.teamA === 'TBD'
                              ? 'Team TBD'
                              : teamA
                              ? `Team ${teamA.teamNumber ?? teamA.id}`
                              : `Team ${match.teamA}`}
                          </div>
                          {teamA && (
                            <>
                              <div className="text-[10px] md:text-xs font-medium">{teamA.name}</div>
                              <div className="text-[10px] md:text-xs text-blue-600">{teamA.city}</div>
                            </>
                          )}
                        </div>

                        <div className="flex flex-col items-center mx-0 md:mx-3">
                          <Badge variant="outline" className="text-[10px] md:text-xs px-2 py-0.5 mb-0.5">
                            Table {match.table ?? '?'}
                          </Badge>
                          <span className="text-muted-foreground font-bold text-xs md:text-sm text-center">
                          vs
                        </span>

                        </div>
                        {/* TEAM B */}
                        <div className="flex-1 md:text-right">
                          <div className="font-bold text-xs md:text-sm">
                            {match.teamB === 'TBD'
                              ? 'Team TBD'
                              : teamB
                              ? `Team ${teamB.teamNumber ?? teamB.id}`
                              : `Team ${match.teamB}`}
                          </div>
                          {teamB && (
                            <>
                              <div className="text-[10px] md:text-xs font-medium">{teamB.name}</div>
                              <div className="text-[10px] md:text-xs text-blue-600">{teamB.city}</div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* STATUS */}
                      <div className="flex flex-wrap justify-center items-center gap-1 md:gap-2 mt-1">
                        {status !== 'Ready to score' && (
                        <Badge
                          variant="outline"
                          className="text-[10px] md:text-xs px-1.5 py-0.5 md:px-2 md:py-1"
                        >
                          {status}
                        </Badge>
                        )}
                        {false && (
                          <Badge
                            variant="destructive"
                            className="text-[10px] md:text-xs px-1.5 py-0.5 md:px-2 md:py-1"
                          >
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
