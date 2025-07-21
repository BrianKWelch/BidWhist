import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Smartphone, Trophy, ArrowRight } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';

interface GameResult {
  id: string;
  round: number;
  table: number;
  team1: string;
  team2: string;
  opponent: string;
  tournamentName: string;
}

interface PhoneAccessPortalProps {
  onPhoneAccess: (phoneNumber: string) => void;
}

export const PhoneAccessPortal: React.FC<PhoneAccessPortalProps> = ({ onPhoneAccess }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [error, setError] = useState('');
  const { teams, schedules, tournaments } = useAppContext();

  const handlePhoneSubmit = () => {
    if (!phoneNumber) {
      setError('Please enter a phone number');
      return;
    }
    
    setError('');
    
    // Find team by phone number
    const team = teams.find(t => t.phoneNumber === phoneNumber);
    if (!team) {
      setError('Team not found with this phone number. Please check the number and try again.');
      return;
    }

    // Check if team has registered tournaments
    if (!team.registeredTournaments || team.registeredTournaments.length === 0) {
      setError(`Team ${team.name} is not registered for any tournaments. Please register for tournaments first.`);
      return;
    }

    // Find games for this team from scheduled tournaments
    const teamTournaments = team.registeredTournaments;
    let foundGame = false;
    
    for (const tournamentId of teamTournaments) {
      const schedule = schedules.find(s => s.tournamentId === tournamentId);
      
      if (schedule && schedule.matches && schedule.matches.length > 0) {
        // Find a match for this team using team name
        const teamMatch = schedule.matches.find(match => 
          match.teamA === team.name || match.teamB === team.name
        );
        
        if (teamMatch) {
          const opponent = teamMatch.teamA === team.name ? teamMatch.teamB : teamMatch.teamA;
          const tournament = tournaments.find(t => t.id === tournamentId);
          
          const result: GameResult = {
            id: teamMatch.id,
            round: teamMatch.round,
            table: 1,
            team1: teamMatch.teamA,
            team2: teamMatch.teamB,
            opponent: opponent,
            tournamentName: tournament?.name || 'Unknown Tournament'
          };
          
          setGameResult(result);
          onPhoneAccess(phoneNumber);
          foundGame = true;
          break;
        }
      }
    }
    
    if (!foundGame) {
      const tournamentNames = teamTournaments.map(id => {
        const tournament = tournaments.find(t => t.id === id);
        return tournament?.name || id;
      }).join(', ');
      
      const scheduledTournaments = schedules.map(s => {
        const tournament = tournaments.find(t => t.id === s.tournamentId);
        return tournament?.name || s.tournamentId;
      }).join(', ');
      
      setError(`No games found for ${team.name}. Team is registered for: ${tournamentNames}. Scheduled tournaments: ${scheduledTournaments}. Make sure your tournament has been scheduled and includes your team.`);
    }
  };

  if (gameResult) {
    const team = teams.find(t => t.phone_Number === phoneNumber);
    
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Game Found!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Trophy className="h-4 w-4" />
            <AlertDescription className="text-base">
              <strong>Found game for {team?.name}!</strong> You are scheduled to play <strong>{gameResult.opponent}</strong> in round {gameResult.round} for the {gameResult.tournamentName}.
            </AlertDescription>
          </Alert>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Game Details</h3>
            <p><strong>Tournament:</strong> {gameResult.tournamentName}</p>
            <p><strong>Round:</strong> {gameResult.round}</p>
            <p><strong>Your Team:</strong> {team?.name}</p>
            <p><strong>Opponent:</strong> {gameResult.opponent}</p>
          </div>

          <Button className="w-full" size="lg">
            <ArrowRight className="h-4 w-4 mr-2" />
            Enter Game Score
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Team Access
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Enter your team phone number to access your game
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Team Phone Number</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="555-123-4567"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
          />
        </div>
        
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <Button 
          onClick={handlePhoneSubmit}
          disabled={!phoneNumber}
          className="w-full"
          size="lg"
        >
          Access Game
        </Button>
        
        <Alert>
          <AlertDescription className="text-sm">
            <strong>Debug Info:</strong> Teams: {teams.length}, Schedules: {schedules.length}
          </AlertDescription>
        </Alert>
        
        {teams.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <p><strong>Sample phone numbers to try:</strong></p>
            {teams.slice(0, 3).map(team => (
              <p key={team.id}>{team.name}: {team.phone_Number} (Tournaments: {team.registeredTournaments?.length || 0})</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};