import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAppContext, ScheduleMatch, ScoreText } from '@/contexts/AppContext';
import { toast } from '@/components/ui/use-toast';
import { MessageSquare, Send, CheckCircle } from 'lucide-react';

interface TextScoreSystemProps {
  tournamentId: string;
}

export const TextScoreSystem: React.FC<TextScoreSystemProps> = ({ tournamentId }) => {
  const { schedules, teams, tournaments, scoreTexts, addScoreText, updateScoreText, submitGame } = useAppContext();
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [customMessage, setCustomMessage] = useState('');

  const schedule = schedules.find(s => s.tournamentId === tournamentId);
  const tournament = tournaments.find(t => t.id === tournamentId);
  const currentTexts = scoreTexts.filter(st => st.matchId.includes(tournamentId));

  const getLeftSideTeam = (match: ScheduleMatch): string => {
    return match.teamA;
  };

  const getRightSideTeam = (match: ScheduleMatch): string => {
    return match.teamB;
  };

  const getTeamPhone = (teamName: string): string => {
    const team = teams.find(t => t.name === teamName);
    return team?.phoneNumber || 'No phone number';
  };

  const generateScoreSheetMessage = (match: ScheduleMatch): string => {
    const baseMessage = customMessage || 
      `Score Sheet - ${tournament?.name}\n\n` +
      `Round ${match.round}\n` +
      `${match.teamA} vs ${match.teamB}\n\n` +
      `Please fill out and reply:\n` +
      `${match.teamA} Score: ___\n` +
      `${match.teamB} Score: ___\n` +
      `Boston (if any): ___\n\n` +
      `Reply with scores in format: ${match.teamA} X - Y ${match.teamB}, Boston: [team name or none]`;
    
    return baseMessage;
  };

  const sendScoreTexts = () => {
    if (!schedule) return;
    
    const roundMatches = schedule.matches.filter(m => 
      m.round === selectedRound && !m.isBye && !m.isByeRound
    );

    roundMatches.forEach(match => {
      // Check if already sent
      const existing = currentTexts.find(st => st.matchId === match.id);
      if (existing) {
        toast({ title: `Score sheet already sent for ${match.teamA} vs ${match.teamB}`, variant: 'destructive' });
        return;
      }

      // Determine which team gets the score sheet first based on round
      const isOddRound = selectedRound % 2 === 1;
      const firstTeam = isOddRound ? getLeftSideTeam(match) : getRightSideTeam(match);
      const phoneNumber = getTeamPhone(firstTeam);
      
      const scoreText: ScoreText = {
        id: `${match.id}-${Date.now()}`,
        matchId: match.id,
        round: match.round,
        teamA: match.teamA,
        teamB: match.teamB,
        phoneNumber,
        messageContent: generateScoreSheetMessage(match),
        sentAt: new Date(),
        status: 'sent'
      };
      
      addScoreText(scoreText);
    });

    toast({ 
      title: `Score sheets sent!`, 
      description: `Sent ${roundMatches.length} score sheets for Round ${selectedRound}` 
    });
  };

  const simulateFillScore = (textId: string, scoreA: number, scoreB: number, boston: 'none' | 'teamA' | 'teamB') => {
    const scoreText = currentTexts.find(st => st.id === textId);
    if (!scoreText) return;

    updateScoreText(textId, {
      status: 'filled',
      scoreA,
      scoreB,
      boston,
      filledBy: scoreText.phoneNumber
    });
    
    toast({ title: 'Score filled! Sending to opponent for confirmation...' });
  };

  const simulateConfirmScore = (textId: string) => {
    const scoreText = currentTexts.find(st => st.id === textId);
    if (!scoreText || !scoreText.scoreA || !scoreText.scoreB) return;

    const teamAObj = teams.find(t => t.name === scoreText.teamA);
    const teamBObj = teams.find(t => t.name === scoreText.teamB);
    
    if (!teamAObj || !teamBObj) {
      toast({ title: 'Error: Could not find team data', variant: 'destructive' });
      return;
    }

    // Create game record
    const winner = scoreText.scoreA > scoreText.scoreB ? 'teamA' : 'teamB';
    const gameData = {
      teamA: teamAObj,
      teamB: teamBObj,
      scoreA: scoreText.scoreA,
      scoreB: scoreText.scoreB,
      boston: scoreText.boston || 'none',
      winner,
      matchId: scoreText.matchId,
      round: scoreText.round,
      confirmed: true,
      confirmedBy: scoreText.teamA === scoreText.filledBy ? scoreText.teamB : scoreText.teamA
    };

    submitGame(gameData);

    updateScoreText(textId, {
      status: 'confirmed',
      confirmedBy: scoreText.teamA === scoreText.filledBy ? scoreText.teamB : scoreText.teamA
    });
    
    toast({ title: 'Score confirmed! Game completed and added to records.' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'filled': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <Send className="w-4 h-4" />;
      case 'filled': return <MessageSquare className="w-4 h-4" />;
      case 'confirmed': return <CheckCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const roundOptions = schedule ? Array.from({ length: schedule.rounds }, (_, i) => i + 1) : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Text Score System</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Select Round</Label>
              <select 
                className="w-full p-2 border rounded"
                value={selectedRound}
                onChange={(e) => setSelectedRound(parseInt(e.target.value))}
              >
                {roundOptions.map(round => (
                  <option key={round} value={round}>Round {round}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={sendScoreTexts} className="w-full">
                Send Score Sheets
              </Button>
            </div>
          </div>

          <div>
            <Label>Custom Message Template (optional)</Label>
            <Textarea 
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Leave blank to use default template..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Score Text Status</CardTitle>
        </CardHeader>
        <CardContent>
          {currentTexts.length === 0 ? (
            <p className="text-gray-500">No score texts sent yet</p>
          ) : (
            <div className="space-y-4">
              {currentTexts.map(text => (
                <div key={text.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-medium">
                        Round {text.round}: {text.teamA} vs {text.teamB}
                      </p>
                      <p className="text-sm text-gray-600">To: {text.phoneNumber}</p>
                    </div>
                    <Badge className={`${getStatusColor(text.status)} flex items-center gap-1`}>
                      {getStatusIcon(text.status)}
                      {text.status.toUpperCase()}
                    </Badge>
                  </div>

                  {text.status === 'sent' && (
                    <div className="mt-3 p-3 bg-gray-50 rounded">
                      <p className="text-sm font-medium mb-2">Simulate Team Response:</p>
                      <div className="flex gap-2">
                        <Input placeholder={`${text.teamA} score`} className="w-20" id={`scoreA-${text.id}`} />
                        <Input placeholder={`${text.teamB} score`} className="w-20" id={`scoreB-${text.id}`} />
                        <select className="p-2 border rounded" id={`boston-${text.id}`}>
                          <option value="none">No Boston</option>
                          <option value="teamA">{text.teamA}</option>
                          <option value="teamB">{text.teamB}</option>
                        </select>
                        <Button 
                          size="sm"
                          onClick={() => {
                            const scoreAInput = document.getElementById(`scoreA-${text.id}`) as HTMLInputElement;
                            const scoreBInput = document.getElementById(`scoreB-${text.id}`) as HTMLInputElement;
                            const bostonSelect = document.getElementById(`boston-${text.id}`) as HTMLSelectElement;
                            
                            simulateFillScore(
                              text.id, 
                              parseInt(scoreAInput.value) || 0, 
                              parseInt(scoreBInput.value) || 0,
                              bostonSelect.value as 'none' | 'teamA' | 'teamB'
                            );
                          }}
                        >
                          Fill Score
                        </Button>
                      </div>
                    </div>
                  )}

                  {text.status === 'filled' && (
                    <div className="mt-3 p-3 bg-yellow-50 rounded">
                      <p className="text-sm font-medium mb-2">Score Submitted:</p>
                      <p>{text.teamA} {text.scoreA} - {text.scoreB} {text.teamB}</p>
                      {text.boston !== 'none' && (
                        <p className="text-sm">Boston: {text.boston === 'teamA' ? text.teamA : text.teamB}</p>
                      )}
                      <Button 
                        size="sm" 
                        className="mt-2"
                        onClick={() => simulateConfirmScore(text.id)}
                      >
                        Confirm Score
                      </Button>
                    </div>
                  )}

                  {text.status === 'confirmed' && (
                    <div className="mt-3 p-3 bg-green-50 rounded">
                      <p className="text-sm font-medium mb-1">Game Completed:</p>
                      <p>{text.teamA} {text.scoreA} - {text.scoreB} {text.teamB}</p>
                      {text.boston !== 'none' && (
                        <p className="text-sm">Boston: {text.boston === 'teamA' ? text.teamA : text.teamB}</p>
                      )}
                      <p className="text-xs text-gray-600 mt-1">Confirmed by: {text.confirmedBy}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};