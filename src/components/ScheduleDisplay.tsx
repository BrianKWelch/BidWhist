import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { TournamentSchedule } from '@/contexts/AppContext';

interface ScheduleDisplayProps {
  schedule: TournamentSchedule;
  tournamentName: string;
}

export const ScheduleDisplay: React.FC<ScheduleDisplayProps> = ({ schedule, tournamentName }) => {
  const { teams, games, scoreSubmissions, refreshGamesFromSupabase } = useAppContext();
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(new Set());

  // Calculate the current round (lowest round with incomplete matches)
  const currentRound = useMemo(() => {
    if (!schedule || !games || !schedule.matches || schedule.matches.length === 0) return 1;

    // Get all unique rounds from the schedule
    const allRounds = [...new Set(schedule.matches.map(m => m.round))].sort((a, b) => a - b);
    if (allRounds.length === 0) return 1;

    // Find the lowest round with incomplete matches
    for (const round of allRounds) {
      const roundMatches = schedule.matches.filter(m => m.round === round && !m.isBye);
      
      if (roundMatches.length === 0) continue;
      
      // Check if any matches in this round are incomplete
      const hasIncomplete = roundMatches.some(match => {
        const completed = games.some(g => 
          g.matchId === match.id && g.confirmed
        );
        return !completed;
      });

      if (hasIncomplete) {
        return round;
      }
    }

    // If all rounds are complete, default to the highest round
    return allRounds.length > 0 ? Math.max(...allRounds) : 1;
  }, [schedule, games]);

  // Set current round as expanded on mount
  useEffect(() => {
    setExpandedRounds(new Set([currentRound]));
  }, [currentRound]);

  // Real-time updates for admin portal schedule
  useEffect(() => {
    const interval = setInterval(() => {
      refreshGamesFromSupabase();
    }, 2000); // Refresh every 2 seconds for faster admin updates

    return () => clearInterval(interval);
  }, [refreshGamesFromSupabase]);

  const toggleRound = (round: number) => {
    setExpandedRounds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(round)) {
        newSet.delete(round);
      } else {
        newSet.add(round);
      }
      return newSet;
    });
  };

  const getMatchStatus = (match: any) => {
    const completedGame = games.find(g => g.matchId === match.id && g.confirmed);
    if (completedGame) {
      // Use the actual teams from the game record, not the schedule
      const gameTeamA = teams.find(t => t.id === completedGame.teamA);
      const gameTeamB = teams.find(t => t.id === completedGame.teamB);
      
      const winner = completedGame.winner === 'teamA' ? gameTeamA : gameTeamB;
      const winnerScore = completedGame.winner === 'teamA' ? completedGame.scoreA : completedGame.scoreB;
      const loserScore = completedGame.winner === 'teamA' ? completedGame.scoreB : completedGame.scoreA;
      
      return `Completed - Team ${winner?.teamNumber || winner?.id || 'Unknown'} won ${winnerScore}-${loserScore}`;
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

  // REMOVE_ME: File name display for testing
  return (
         <Card className="border-2" style={{ borderColor: '#a60002' }}>
      <CardHeader>
        <CardTitle className="text-center text-2xl font-bold mb-2 border-b-2 pb-2 shadow-sm" style={{ color: 'black', borderColor: '#a60002' }}>
          {tournamentName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center text-sm text-gray-600 mb-4">
          {schedule.matches.length} matches • {Math.max(...schedule.matches.map(m => m.round))} rounds
        </div>
        {Array.from({ length: Math.max(schedule.rounds, Math.max(...schedule.matches.map(m => m.round))) }, (_, i) => i + 1).map(round => {
          const roundMatches = schedule.matches.filter(m => m.round === round);
          const isExpanded = expandedRounds.has(round);
          return (
            <div key={round} className="mb-6">
              <Collapsible open={isExpanded} onOpenChange={() => toggleRound(round)}>
                <CollapsibleTrigger asChild>
                  <div className="flex justify-center mb-4 cursor-pointer hover:opacity-80">
                    <Badge variant="outline" className="font-bold text-lg px-4 py-2 flex items-center gap-2" style={{ backgroundColor: 'black', color: 'white', borderColor: 'black' }}>
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      Round {round}
                    </Badge>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-3">
                                                  {roundMatches.map(match => {
                   if (match.isBye) {
                     // Find the real team (not BYE) - one of teamA or teamB will be "null" for BYE matches
                     const realTeamId = match.teamA === "null" ? match.teamB : match.teamA;
                     
                     const team = teams.find(t => String(t.id) === String(realTeamId));
                    return (
                      <div key={match.id} className={`p-2 md:p-3 border rounded-lg bg-yellow-50 border-yellow-300 text-yellow-800`}>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-1 gap-2 md:gap-0">
                          <div className="flex-1 font-medium text-xs md:text-sm">
                            {team ? (
                              <span>
                                {team.teamNumber ?? team.id}: {team.name} - <span className="text-[8px] md:text-[10px]">{team.city}</span>
                              </span>
                            ) : 'Unknown Team'}
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-center items-center gap-1 md:gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] md:text-xs px-1.5 py-0.5 md:px-2 md:py-1 bg-yellow-100 border-yellow-300 text-yellow-800">
                            BYE
                          </Badge>
                        </div>
                      </div>
                    );
                  }
                  const teamA = teams.find(t => t.id === match.teamA);
                  const teamB = teams.find(t => t.id === match.teamB);
                  const status = getMatchStatus(match);
                  const statusColor = getStatusColor(status);
                  
                  // Get completed game data for result display
                  const completedGame = games.find(g => g.matchId === match.id && g.confirmed);
                  let gameResult = null;
                  if (completedGame) {
                    // Use the actual teams from the game record, not the schedule
                    const gameTeamA = teams.find(t => t.id === completedGame.teamA);
                    const gameTeamB = teams.find(t => t.id === completedGame.teamB);
                    
                    const winner = completedGame.winner === 'teamA' ? gameTeamA : gameTeamB;
                    const winnerScore = completedGame.winner === 'teamA' ? completedGame.scoreA : completedGame.scoreB;
                    const loserScore = completedGame.winner === 'teamA' ? completedGame.scoreB : completedGame.scoreA;
                    
                    gameResult = {
                      winner,
                      winnerScore,
                      loserScore
                    };
                  }
                  
                  return (
                    <div key={match.id} className={`p-2 md:p-3 border rounded-lg ${statusColor} relative`}>
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-1 gap-2 md:gap-0">
                        <div className="flex-1">
                          <div className="font-medium text-xs md:text-sm">
                            {match.teamA === 'TBD' ? 'TBD' : 
                             teamA ? (
                               <span>
                                 {teamA.teamNumber ?? teamA.id}: {teamA.name} - <span className="text-[8px] md:text-[10px]">{teamA.city}</span>
                               </span>
                             ) : `${match.teamA}`}
                          </div>
                        </div>
                        <div className="flex flex-col items-center">
                          <Badge variant="outline" className="text-[10px] md:text-xs px-1.5 py-0.5 md:px-2 md:py-1 mb-1">
                            Table {match.table}
                          </Badge>
                          <span className="text-muted-foreground mx-0 md:mx-3 font-medium text-xs md:text-sm text-center">vs</span>
                        </div>
                        <div className="flex-1 md:text-right">
                          <div className="font-medium text-xs md:text-sm">
                            {match.teamB === 'TBD' ? 'TBD' : 
                             teamB ? (
                               <span>
                                 {teamB.teamNumber ?? teamB.id}: {teamB.name} - <span className="text-[8px] md:text-[10px]">{teamB.city}</span>
                               </span>
                             ) : `${match.teamB}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-center items-center gap-1 md:gap-2 mt-1">
                        {teamA && teamB && teamA.city === teamB.city && (
                          <Badge variant="destructive" className="text-[10px] md:text-xs px-1.5 py-0.5 md:px-2 md:py-1">
                            Same City
                          </Badge>
                        )}
                      </div>
                      
                      {/* Completed game result in bottom corner */}
                      {gameResult && (
                        <div className="absolute bottom-1 right-2">
                          <span className="text-xs italic text-red-600">
                            Team {gameResult.winner?.teamNumber ?? gameResult.winner?.id} won {gameResult.winnerScore}-{gameResult.loserScore}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
              {round < schedule.rounds && <Separator className="mt-4" />}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};