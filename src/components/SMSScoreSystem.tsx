import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAppContext } from '@/contexts/AppContext';
import { toast } from '@/components/ui/use-toast';
import { sendSMS } from '@/api/messaging';

interface SMSScoreSystemProps {
  tournamentId: string;
}

interface ScoreRequest {
  id: string;
  matchId: string;
  teamA: string;
  teamB: string;
  round: number;
  sentTo: string;
  sentAt: Date;
  status: 'sent' | 'received' | 'confirmed';
  scoreA?: number;
  scoreB?: number;
  boston?: 'none' | 'teamA' | 'teamB';
  submittedBy?: string;
  confirmationSentTo?: string;
}

export const SMSScoreSystem: React.FC<SMSScoreSystemProps> = ({ tournamentId }) => {
  const { schedules, teams, games, updateGameScore } = useAppContext();
  const [scoreRequests, setScoreRequests] = useState<ScoreRequest[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<ScheduleMatch | null>(null);
  const [incomingScore, setIncomingScore] = useState({ scoreA: '', scoreB: '', boston: 'none' as 'none' | 'teamA' | 'teamB' });
  const [currentRound, setCurrentRound] = useState(1);

  const schedule = schedules.find(s => s.tournamentId === tournamentId);
  
  // Filter matches for current round only
  const currentRoundMatches = schedule?.matches.filter(m => 
    !m.isBye && m.round === currentRound
  ) || [];
  
  // Check if current round is complete
  const isRoundComplete = currentRoundMatches.every(match => 
    games.some(game => 
      game.matchId === match.id && game.status === 'confirmed'
    )
  );

  // Auto-advance to next round when current round is complete
  useEffect(() => {
    if (isRoundComplete && currentRoundMatches.length > 0) {
      const maxRound = schedule?.rounds || 1;
      if (currentRound < maxRound) {
        setCurrentRound(prev => prev + 1);
        toast({ title: `Round ${currentRound} complete! Advanced to Round ${currentRound + 1}` });
      }
    }
  }, [isRoundComplete, currentRound, currentRoundMatches.length, schedule?.rounds]);

  const getTeamPhone = (teamName: string): string => {
    const team = teams.find(t => t.name === teamName);
    return team?.phone_Number || '';
  };

  const sendScoreRequest = async () => {
    if (!selectedMatch) return;

    const teamAPhone = getTeamPhone(selectedMatch.teamA);
    const teamBPhone = getTeamPhone(selectedMatch.teamB);

    if (!teamAPhone || !teamBPhone) {
      toast({ title: 'Missing phone numbers for teams', variant: 'destructive' });
      return;
    }

    const message = `Score request for Round ${selectedMatch.round}: ${selectedMatch.teamA} vs ${selectedMatch.teamB}. Reply with format: "SCORE A-B BOSTON" (e.g., "SCORE 21-15 NONE" or "SCORE 21-19 TEAMB")`;

    try {
      await sendSMS(teamAPhone, message);
      await sendSMS(teamBPhone, message);

      const newRequest: ScoreRequest = {
        id: Date.now().toString(),
        matchId: selectedMatch.id,
        teamA: selectedMatch.teamA,
        teamB: selectedMatch.teamB,
        round: selectedMatch.round,
        sentTo: 'both teams',
        sentAt: new Date(),
        status: 'sent'
      };

      setScoreRequests(prev => [...prev, newRequest]);
      setSelectedMatch(null);
      toast({ title: 'Score request sent to both teams!' });
    } catch (error) {
      toast({ title: 'Failed to send SMS', variant: 'destructive' });
    }
  };

  const simulateIncomingScore = () => {
    if (!selectedMatch || !incomingScore.scoreA || !incomingScore.scoreB) return;

    const request = scoreRequests.find(r => r.matchId === selectedMatch.id && r.status === 'sent');
    if (!request) {
      toast({ title: 'No pending request for this match', variant: 'destructive' });
      return;
    }

    const updatedRequest: ScoreRequest = {
      ...request,
      status: 'received',
      scoreA: parseInt(incomingScore.scoreA),
      scoreB: parseInt(incomingScore.scoreB),
      boston: incomingScore.boston,
      submittedBy: selectedMatch.teamA
    };

    setScoreRequests(prev => prev.map(r => r.id === request.id ? updatedRequest : r));
    
    const opponentPhone = getTeamPhone(selectedMatch.teamB);
    const confirmMessage = `Score confirmation needed: ${selectedMatch.teamA} ${incomingScore.scoreA} - ${incomingScore.scoreB} ${selectedMatch.teamB}${incomingScore.boston !== 'none' ? ` (Boston: ${incomingScore.boston === 'teamA' ? selectedMatch.teamA : selectedMatch.teamB})` : ''}. Reply "CONFIRM" or "DISPUTE"`;
    
    sendSMS(opponentPhone, confirmMessage);
    
    setIncomingScore({ scoreA: '', scoreB: '', boston: 'none' });
    toast({ title: 'Score received! Confirmation sent to opponent.' });
  };

  const confirmScore = (requestId: string) => {
    const request = scoreRequests.find(r => r.id === requestId);
    if (!request || !request.scoreA || !request.scoreB) return;

    // Update the game score in the context
    updateGameScore(request.matchId, request.scoreA, request.scoreB);
    
    setScoreRequests(prev => prev.map(r => 
      r.id === requestId ? { ...r, status: 'confirmed' } : r
    ));
    
    toast({ title: 'Score confirmed! Match completed.' });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Current Round: {currentRound}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-600 mb-4">
            {isRoundComplete && currentRoundMatches.length > 0 ? 
              'Round complete! Moving to next round...' : 
              `${currentRoundMatches.length} matches available for scoring`
            }
          </div>
          
          {currentRoundMatches.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No active matches to score for Round {currentRound}
            </div>
          )}
        </CardContent>
      </Card>

      {currentRoundMatches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Send Score Request via SMS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Select Match (Round {currentRound})</Label>
              <select 
                className="w-full p-2 border rounded"
                value={selectedMatch?.id || ''}
                onChange={(e) => {
                  const match = currentRoundMatches.find(m => m.id === e.target.value);
                  setSelectedMatch(match || null);
                }}
              >
                <option value="">Select a match...</option>
                {currentRoundMatches.map(match => (
                  <option key={match.id} value={match.id}>
                    {match.teamA} vs {match.teamB}
                  </option>
                ))}
              </select>
            </div>

            {selectedMatch && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  Will send to: {getTeamPhone(selectedMatch.teamA)} and {getTeamPhone(selectedMatch.teamB)}
                </p>
                <Button onClick={sendScoreRequest} className="w-full">
                  Send Score Request SMS
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedMatch && (
        <Card>
          <CardHeader>
            <CardTitle>Simulate Incoming Score (Testing)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{selectedMatch.teamA} Score</Label>
                <Input 
                  value={incomingScore.scoreA} 
                  onChange={(e) => setIncomingScore(prev => ({ ...prev, scoreA: e.target.value }))}
                  type="number" 
                />
              </div>
              <div>
                <Label>{selectedMatch.teamB} Score</Label>
                <Input 
                  value={incomingScore.scoreB} 
                  onChange={(e) => setIncomingScore(prev => ({ ...prev, scoreB: e.target.value }))}
                  type="number" 
                />
              </div>
            </div>
            <div>
              <Label>Boston</Label>
              <div className="flex gap-2 mt-2">
                <Button 
                  variant={incomingScore.boston === 'none' ? 'default' : 'outline'}
                  onClick={() => setIncomingScore(prev => ({ ...prev, boston: 'none' }))}
                  size="sm"
                >
                  None
                </Button>
                <Button 
                  variant={incomingScore.boston === 'teamA' ? 'default' : 'outline'}
                  onClick={() => setIncomingScore(prev => ({ ...prev, boston: 'teamA' }))}
                  size="sm"
                >
                  {selectedMatch.teamA}
                </Button>
                <Button 
                  variant={incomingScore.boston === 'teamB' ? 'default' : 'outline'}
                  onClick={() => setIncomingScore(prev => ({ ...prev, boston: 'teamB' }))}
                  size="sm"
                >
                  {selectedMatch.teamB}
                </Button>
              </div>
            </div>
            <Button onClick={simulateIncomingScore} className="w-full">
              Simulate Score Received
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Score Requests Status</CardTitle>
        </CardHeader>
        <CardContent>
          {scoreRequests.length === 0 ? (
            <p className="text-gray-500">No score requests sent</p>
          ) : (
            <div className="space-y-3">
              {scoreRequests.map(request => (
                <div key={request.id} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">
                        Round {request.round}: {request.teamA} vs {request.teamB}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={request.status === 'sent' ? 'secondary' : request.status === 'received' ? 'default' : 'outline'}>
                          {request.status.toUpperCase()}
                        </Badge>
                        <span className="text-sm text-gray-600">
                          {request.sentAt.toLocaleTimeString()}
                        </span>
                      </div>
                      {request.status === 'received' && (
                        <p className="text-sm mt-2">
                          Score: {request.teamA} {request.scoreA} - {request.scoreB} {request.teamB}
                          {request.boston !== 'none' && ` (Boston: ${request.boston === 'teamA' ? request.teamA : request.teamB})`}
                        </p>
                      )}
                    </div>
                    {request.status === 'received' && (
                      <Button 
                        onClick={() => confirmScore(request.id)}
                        size="sm"
                      >
                        Confirm Score
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};