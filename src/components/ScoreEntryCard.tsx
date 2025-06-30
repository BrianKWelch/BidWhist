import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppContext } from '@/contexts/AppContext';
import { Trophy, Check, Clock } from 'lucide-react';
import type { Team } from '@/contexts/AppContext';

interface ScoreEntryCardProps {
  team: Team;
}

const ScoreEntryCard = ({ team }: ScoreEntryCardProps) => {
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [boston, setBoston] = useState('none');
  const { schedules, games, tournaments, teams, submitGame, scoreSubmissions } = useAppContext();

  const getActiveMatches = () => {
    const activeMatches: any[] = [];
    
    schedules.forEach(schedule => {
      const teamMatches = schedule.matches.filter(match => {
        return (match.teamA === team.id || match.teamB === team.id) && !match.isBye;
      });
      
      teamMatches.sort((a, b) => a.round - b.round);
      
      for (const match of teamMatches) {
        const existingGame = games.find(g => g.matchId === match.id && g.confirmed);
        if (existingGame) continue;
        
        if (match.teamA !== 'TBD' && match.teamB !== 'TBD') {
          const tournament = tournaments.find(t => t.id === schedule.tournamentId);
          const opponentId = match.teamA === team.id ? match.teamB : match.teamA;
          const opponentTeam = teams.find(t => t.id === opponentId);
          
          const mySubmission = scoreSubmissions.find(s => 
            s.matchId === match.id && s.submittedBy === team.id
          );
          const opponentSubmission = scoreSubmissions.find(s => 
            s.matchId === match.id && s.submittedBy !== team.id
          );
          
          let status = 'Ready to Score';
          let statusMessage = '';
          
          if (mySubmission && opponentSubmission) {
            if (mySubmission.scoreA !== opponentSubmission.scoreA || mySubmission.scoreB !== opponentSubmission.scoreB) {
              status = 'Score Conflict';
              statusMessage = 'Scores dont match - resolve with opponent';
            } else {
              status = 'Confirming scores';
              statusMessage = 'Scores match - confirming game';
            }
          } else if (mySubmission) {
            status = 'Waiting for opponent';
            statusMessage = 'Waiting for opponent to enter score';
          }
          
          activeMatches.push({ 
            ...match, 
            tournamentName: tournament?.name || 'Unknown Tournament',
            opponentId,
            opponentTeam,
            mySubmission,
            opponentSubmission,
            status,
            statusMessage
          });
          break;
        }
        
        if (match.teamA === 'TBD' || match.teamB === 'TBD') {
          const tournament = tournaments.find(t => t.id === schedule.tournamentId);
          activeMatches.push({ 
            ...match, 
            tournamentName: tournament?.name || 'Unknown Tournament',
            opponentId: 'TBD',
            opponentTeam: null,
            mySubmission: null,
            opponentSubmission: null,
            status: 'Waiting for opponent',
            statusMessage: `Waiting for Round ${match.round - 1} to complete`
          });
          break;
        }
      }
    });
    
    return activeMatches;
  };

  const handleSubmitScore = () => {
    if (!selectedMatch || !scoreA || !scoreB) return;
    
    const teamAScore = selectedMatch.teamA === team.id ? parseInt(scoreA) : parseInt(scoreB);
    const teamBScore = selectedMatch.teamA === team.id ? parseInt(scoreB) : parseInt(scoreA);
    
    const teamA = teams.find(t => t.id === selectedMatch.teamA);
    const teamB = teams.find(t => t.id === selectedMatch.teamB);
    
    if (!teamA || !teamB) return;
    
    const gameData = {
      teamA,
      teamB,
      scoreA: teamAScore,
      scoreB: teamBScore,
      boston: boston as 'none' | 'teamA' | 'teamB',
      winner: (teamAScore > teamBScore ? 'teamA' : 'teamB') as 'teamA' | 'teamB',
      matchId: selectedMatch.id,
      round: selectedMatch.round,
      submittedBy: team.id
    };
    
    submitGame(gameData);
    setSelectedMatch(null);
    setScoreA('');
    setScoreB('');
    setBoston('none');
  };

  const activeMatches = getActiveMatches();
  const currentRound = activeMatches.length > 0 ? activeMatches[0].round : 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Round {currentRound} Score Entry
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {schedules.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-2">No tournament schedule found</p>
            <p className="text-sm text-gray-400">Please wait for the tournament to be scheduled</p>
          </div>
        ) : activeMatches.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-2">No active matches found</p>
            <p className="text-sm text-gray-400">All rounds completed or waiting for next round</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">Your Active Match</label>
              <div className="space-y-2">
                {activeMatches.map((match: any, index: number) => (
                  <div 
                    key={index}
                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                      selectedMatch?.id === match.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => match.status === 'Ready to Score' && setSelectedMatch(match)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-sm">{match.tournamentName}</p>
                        <p className="text-xs text-gray-600">Round {match.round}</p>
                        {match.teamB === 'TBD' || match.teamA === 'TBD' ? (
                          <p className="text-sm text-orange-600">Waiting for opponent from previous round</p>
                        ) : (
                          <>
                            <p className="text-sm">
                              vs Team {match.opponentTeam?.teamNumber || match.opponentId}
                            </p>
                            {match.opponentTeam && (
                              <p className="text-xs text-gray-500">
                                {match.opponentTeam.player1FirstName} {match.opponentTeam.player1LastName} & {match.opponentTeam.player2FirstName} {match.opponentTeam.player2LastName}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                      <div>
                        <Badge 
                          variant={match.status === 'Ready to Score' ? 'outline' : 
                                  match.status === 'Waiting for opponent' ? 'secondary' : 'destructive'}
                          className="text-xs"
                        >
                          {match.status === 'Waiting for opponent' && <Clock className="h-3 w-3 mr-1" />}
                          {match.status}
                        </Badge>
                        {match.statusMessage && (
                          <p className="text-xs text-gray-500 mt-1">{match.statusMessage}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedMatch && (
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-medium">Enter Score for Round {selectedMatch.round}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600">Your Score</label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={scoreA}
                      onChange={(e) => setScoreA(e.target.value)}
                      placeholder="0"
                      className="text-center"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Opponent Score</label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={scoreB}
                      onChange={(e) => setScoreB(e.target.value)}
                      placeholder="0"
                      className="text-center"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-sm text-gray-600">Boston (if any)</label>
                  <div className="flex gap-2 mt-1">
                    <Button
                      variant={boston === 'none' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setBoston('none')}
                    >
                      None
                    </Button>
                    <Button
                      variant={boston !== 'none' && ((selectedMatch.teamA === team.id && boston === 'teamA') || (selectedMatch.teamB === team.id && boston === 'teamB')) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setBoston(selectedMatch.teamA === team.id ? 'teamA' : 'teamB')}
                    >
                      You
                    </Button>
                    <Button
                      variant={boston !== 'none' && ((selectedMatch.teamA === team.id && boston === 'teamB') || (selectedMatch.teamB === team.id && boston === 'teamA')) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setBoston(selectedMatch.teamA === team.id ? 'teamB' : 'teamA')}
                    >
                      Opponent
                    </Button>
                  </div>
                </div>

                <Button 
                  onClick={handleSubmitScore} 
                  className="w-full"
                  disabled={!scoreA || !scoreB}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Submit Round {selectedMatch.round} Score
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ScoreEntryCard;