import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAppContext } from '@/contexts/AppContext';
import { Trophy, Check, Clock, AlertTriangle } from 'lucide-react';
import type { Team } from '@/contexts/AppContext';

interface ScoreEntryCardProps {
  team: Team;
}

const ScoreEntryCard = ({ team }: ScoreEntryCardProps) => {
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [boston, setBoston] = useState('none');
  const [refreshKey, setRefreshKey] = useState(0);
  const { schedules, games, tournaments, teams, submitGame, scoreSubmissions, getActiveTournament } = useAppContext();

  const getActiveMatches = React.useMemo(() => {
    const activeTournament = getActiveTournament && getActiveTournament();
    if (!activeTournament) return [];
    const schedule = schedules.find(s => s.tournamentId === activeTournament.id);
    if (!schedule) return [];
    const activeMatches: any[] = [];
    const teamMatches = schedule.matches.filter(match => {
      return (match.teamA === team.id || match.teamB === team.id) && !match.isBye;
    });
    teamMatches.sort((a, b) => a.round - b.round);
    for (const match of teamMatches) {
      const existingGame = games.find(g => g.matchId === match.id && g.confirmed);
      if (existingGame) continue;
      if (match.teamA !== 'TBD' && match.teamB !== 'TBD') {
        const tournament = activeTournament;
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
          if (
            mySubmission.scoreA !== opponentSubmission.scoreA ||
            mySubmission.scoreB !== opponentSubmission.scoreB ||
            mySubmission.boston !== opponentSubmission.boston
          ) {
            status = 'Score Conflict';
            statusMessage = 'Scores or Boston value don\'t match - resolve with opponent';
          } else {
            status = 'Confirming scores';
            statusMessage = 'Scores and Boston match - confirming game';
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
        const tournament = activeTournament;
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
    return activeMatches;
  }, [schedules, games, scoreSubmissions, tournaments, teams, team.id, refreshKey, getActiveTournament]);

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
    
    // Clear the form and selection
    setSelectedMatch(null);
    setScoreA('');
    setScoreB('');
    setBoston('none');
    
    // Force a re-render
    setRefreshKey(prev => prev + 1);
  };

  // Pre-populate scores when there's a conflict
  React.useEffect(() => {
    if (selectedMatch && selectedMatch.status === 'Score Conflict' && selectedMatch.mySubmission) {
      const myScore = selectedMatch.teamA === team.id ? selectedMatch.mySubmission.scoreA : selectedMatch.mySubmission.scoreB;
      const opponentScore = selectedMatch.teamA === team.id ? selectedMatch.mySubmission.scoreB : selectedMatch.mySubmission.scoreA;
      setScoreA(myScore.toString());
      setScoreB(opponentScore.toString());
      setBoston(selectedMatch.mySubmission.boston || 'none');
    }
  }, [selectedMatch, team.id]);

  // Reset form when match selection changes or when score submissions change
  React.useEffect(() => {
    if (!selectedMatch) {
      setScoreA('');
      setScoreB('');
      setBoston('none');
    }
  }, [selectedMatch, scoreSubmissions]);


  const activeMatches = getActiveMatches;
  const currentRound = activeMatches.length > 0 ? activeMatches[0].round : 1;

  const activeTournament = getActiveTournament && getActiveTournament();

  if (!activeTournament) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Active Tournament</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 text-center">There is currently no active tournament. Please check back later.</p>
        </CardContent>
      </Card>
    );
  }

  // REMOVE_ME: File name display for testing
  return (
    <Card>
      <div className="w-full flex justify-center REMOVE_ME_FILENAME" style={{ position: 'sticky', top: 0, zIndex: 999 }}>
        <span className="text-xs text-gray-400 py-2 bg-white/80 px-2 rounded shadow" style={{ zIndex: 999 }}>
          ScoreEntryCard.tsx
        </span>
      </div>
      {/* REMOVE_ME_FILENAME: ScoreEntryCard.tsx */}
      <CardHeader>
        <p 
          className="mb-1"
          style={{ fontWeight: 'bold', color: 'red', fontSize: 28 }}
        >
          {activeTournament?.name}
        </p>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Score Entry
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
              <div className="space-y-2">
                {activeMatches.map((match: any, index: number) => (
                  <div 
                    key={index}
                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                      selectedMatch?.id === match.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => (match.status === 'Ready to Score' || match.status === 'Score Conflict') && setSelectedMatch(match)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        {/* <p className="font-medium text-sm">{match.tournamentName}</p> */}
                        <p className="text-xs text-gray-600 font-bold" style={{fontWeight: 'bold'}}>
                          Round {match.round}
                        </p>
                        {match.teamB === 'TBD' || match.teamA === 'TBD' ? (
                          <p className="text-sm text-orange-600">Waiting for opponent from previous round</p>
                        ) : (
                          <>
                            <p className="text-sm">
                              Your Team is Playing Team {match.opponentTeam?.id || match.opponentId}
                              {match.opponentTeam && (
                                <span className="text-xs text-gray-500 ml-1">
                                  ( {match.opponentTeam.name} — {match.opponentTeam.player1FirstName} {match.opponentTeam.player1LastName} & {match.opponentTeam.player2FirstName} {match.opponentTeam.player2LastName} )
                                </span>
                              )}
                            </p>
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
                <h3 className="font-medium">
                  {selectedMatch.status === 'Score Conflict' ? 'Fix Score Conflict for Round' : 'Enter Score for Round'} {selectedMatch.round}
                </h3>
                {selectedMatch.status === 'Score Conflict' && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Your scores don't match your opponent's scores. Please review and correct your entry.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600">Your Score</label>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={scoreA}
                      onChange={(e) => setScoreA(e.target.value)}
                      placeholder="0"
                      className="text-center"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Opponent Score</label>
                    <Input
                      type="tel"
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
                  {selectedMatch.status === 'Score Conflict' ? 'Resubmit Score' : `Submit Round ${selectedMatch.round} Score`}
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