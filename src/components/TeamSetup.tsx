import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Plus } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import TournamentSelector from './TournamentSelector';
import PaymentTracker from './PaymentTracker';
import TeamsByTournament from './TeamsByTournament';
import IndividualPlayerPayment from './IndividualPlayerPayment';

const TeamSetup: React.FC = () => {
  const { addTeam, cities, teams } = useAppContext();
  const [player1First, setPlayer1First] = useState('');
  const [player1Last, setPlayer1Last] = useState('');
  const [player2First, setPlayer2First] = useState('');
  const [player2Last, setPlayer2Last] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [city, setCity] = useState('');
  const [selectedTournaments, setSelectedTournaments] = useState<string[]>([]);
  const [bostonPotTournaments, setBostonPotTournaments] = useState<string[]>([]);
  const [showPaymentFlow, setShowPaymentFlow] = useState(false);
  const [currentTeamForPayment, setCurrentTeamForPayment] = useState<string | null>(null);

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // If exactly 10 digits, format as (XXX) XXX-XXXX
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    
    return value;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  const handleTournamentChange = (tournamentId: string, checked: boolean) => {
    setSelectedTournaments(prev => 
      checked 
        ? [...prev, tournamentId]
        : prev.filter(id => id !== tournamentId)
    );
    if (!checked) {
      setBostonPotTournaments(prev => prev.filter(id => id !== tournamentId));
    }
  };

  const handleBostonPotChange = (tournamentId: string, checked: boolean) => {
    setBostonPotTournaments(prev => 
      checked 
        ? [...prev, tournamentId]
        : prev.filter(id => id !== tournamentId)
    );
  };

  const formatTeamName = (firstName: string, lastName: string) => {
    if (!firstName.trim() || !lastName.trim()) return '';
    const lastInitial = lastName.trim().charAt(0).toUpperCase();
    return `${firstName.trim()} ${lastInitial}`;
  };

  const handleRegisterTeam = () => {
    if (!player1First.trim() || !player1Last.trim() || !player2First.trim() || !player2Last.trim() || !phoneNumber.trim() || !city.trim() || selectedTournaments.length === 0) return;
    
    const teamId = addTeam(player1First.trim(), player1Last.trim(), player2First.trim(), player2Last.trim(), phoneNumber.trim(), city.trim(), selectedTournaments, bostonPotTournaments);
    
    // Show payment flow for the newly registered team
    setCurrentTeamForPayment(teamId);
    setShowPaymentFlow(true);
  };

  const handlePaymentComplete = () => {
    // Clear form for next team registration
    setPlayer1First('');
    setPlayer1Last('');
    setPlayer2First('');
    setPlayer2Last('');
    setPhoneNumber('');
    setCity('');
    setSelectedTournaments([]);
    setBostonPotTournaments([]);
    setShowPaymentFlow(false);
    setCurrentTeamForPayment(null);
  };

  const getTeamName = () => {
    const player1Name = formatTeamName(player1First, player1Last);
    const player2Name = formatTeamName(player2First, player2Last);
    
    if (player1Name && player2Name) {
      return `${player1Name}/${player2Name}`;
    }
    return '';
  };

  const currentTeam = currentTeamForPayment ? teams.find(t => t.id === currentTeamForPayment) : null;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="register" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="register">Register Team</TabsTrigger>
          <TabsTrigger value="payments">Payment Tracking</TabsTrigger>
          <TabsTrigger value="tournaments">Teams by Tournament</TabsTrigger>
        </TabsList>
        
        <TabsContent value="register" className="space-y-6">
          {showPaymentFlow && currentTeam ? (
            <IndividualPlayerPayment
              team={currentTeam}
              onComplete={handlePaymentComplete}
            />
          ) : (
            <>
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Team Registration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="player1First">Player 1 First Name *</Label>
                        <Input
                          id="player1First"
                          placeholder="John"
                          value={player1First}
                          onChange={(e) => setPlayer1First(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="player1Last">Player 1 Last Name *</Label>
                        <Input
                          id="player1Last"
                          placeholder="Smith"
                          value={player1Last}
                          onChange={(e) => setPlayer1Last(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="player2First">Player 2 First Name *</Label>
                        <Input
                          id="player2First"
                          placeholder="Frank"
                          value={player2First}
                          onChange={(e) => setPlayer2First(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="player2Last">Player 2 Last Name *</Label>
                        <Input
                          id="player2Last"
                          placeholder="Stone"
                          value={player2Last}
                          onChange={(e) => setPlayer2Last(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="phoneNumber">Team Phone Number *</Label>
                        <Input
                          id="phoneNumber"
                          placeholder="(555) 123-4567"
                          value={phoneNumber}
                          onChange={handlePhoneChange}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="city">City/Location *</Label>
                        <Select value={city} onValueChange={setCity}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a city" />
                          </SelectTrigger>
                          <SelectContent>
                            {cities.map((cityOption) => (
                              <SelectItem key={cityOption} value={cityOption}>
                                {cityOption}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  
                  {getTeamName() && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-sm text-gray-600">Team Name (Auto-generated):</div>
                      <div className="font-semibold text-blue-700">{getTeamName()}</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <TournamentSelector 
                selectedTournaments={selectedTournaments}
                bostonPotTournaments={bostonPotTournaments}
                onTournamentChange={handleTournamentChange}
                onBostonPotChange={handleBostonPotChange}
              />

              <Button
                onClick={handleRegisterTeam}
                disabled={!player1First.trim() || !player1Last.trim() || !player2First.trim() || !player2Last.trim() || !phoneNumber.trim() || !city.trim() || selectedTournaments.length === 0}
                className="w-full flex items-center gap-2"
                size="lg"
              >
                <Plus className="w-4 h-4" />
                Register Team
              </Button>
            </>
          )}
        </TabsContent>
        
        <TabsContent value="payments">
          <PaymentTracker />
        </TabsContent>
        
        <TabsContent value="tournaments">
          <TeamsByTournament />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TeamSetup;