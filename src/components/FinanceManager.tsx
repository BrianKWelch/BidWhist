import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppContext } from '@/contexts/AppContext';
import { DollarSign, Percent } from 'lucide-react';

const FinanceManager: React.FC = () => {
  const { tournaments, teams } = useAppContext();
  const [selectedTournament, setSelectedTournament] = useState('');
  const [collected, setCollected] = useState(0);
  const [owed, setOwed] = useState(0);
  const [clubShare, setClubShare] = useState(30);
  const [firstPlace, setFirstPlace] = useState(50);
  const [secondPlace, setSecondPlace] = useState(25);
  const [thirdPlace, setThirdPlace] = useState(15);
  const [fourthPlace, setFourthPlace] = useState(10);

  // Calculate collected and owed amounts based on selected tournament
  useEffect(() => {
    if (selectedTournament) {
      const tournament = tournaments.find(t => t.id === selectedTournament);
      if (tournament) {
        let totalCollected = 0;
        let totalOwed = 0;

        teams.forEach(team => {
          if (team.registeredTournaments?.includes(selectedTournament)) {
            const tournamentCost = tournament.cost;
            const bostonCost = team.bostonPotTournaments?.includes(selectedTournament) ? tournament.bostonPotCost : 0;
            const totalCost = tournamentCost + bostonCost;

            // Check player 1 payment
            const player1Paid = team.player1TournamentPayments?.[selectedTournament] || false;
            if (player1Paid) {
              totalCollected += totalCost / 2;
            } else {
              totalOwed += totalCost / 2;
            }

            // Check player 2 payment
            const player2Paid = team.player2TournamentPayments?.[selectedTournament] || false;
            if (player2Paid) {
              totalCollected += totalCost / 2;
            } else {
              totalOwed += totalCost / 2;
            }
          }
        });

        setCollected(totalCollected);
        setOwed(totalOwed);
      }
    } else {
      setCollected(0);
      setOwed(0);
    }
  }, [selectedTournament, tournaments, teams]);

  const totalExpected = collected + owed;
  const clubAmount = (totalExpected * clubShare) / 100;
  const prizePool = totalExpected - clubAmount;
  
  const firstPayout = (prizePool * firstPlace) / 100;
  const secondPayout = (prizePool * secondPlace) / 100;
  const thirdPayout = (prizePool * thirdPlace) / 100;
  const fourthPayout = (prizePool * fourthPlace) / 100;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Tournament Finance Manager
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tournament">Select Tournament</Label>
              <Select value={selectedTournament} onValueChange={setSelectedTournament}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose tournament" />
                </SelectTrigger>
                <SelectContent>
                  {tournaments.map((tournament) => (
                    <SelectItem key={tournament.id} value={tournament.id}>
                      {tournament.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Money Collected ($)</Label>
              <div className="p-2 bg-green-100 rounded border font-semibold text-green-700">
                ${collected.toFixed(2)}
              </div>
            </div>
            <div>
              <Label>Money Owed ($)</Label>
              <div className="p-2 bg-red-100 rounded border font-semibold text-red-700">
                ${owed.toFixed(2)}
              </div>
            </div>
            <div>
              <Label>Total Expected ($)</Label>
              <div className="p-2 bg-blue-100 rounded border font-semibold text-blue-700">
                ${totalExpected.toFixed(2)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Payout Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="clubShare" className="min-w-0 flex-1">Club Share (%)</Label>
              <Input
                id="clubShare"
                type="number"
                value={clubShare}
                onChange={(e) => setClubShare(Number(e.target.value))}
                className="w-20"
              />
              <div className="font-semibold text-green-600 min-w-0">
                ${clubAmount.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">Prize Pool: ${prizePool.toFixed(2)}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="first" className="min-w-0 flex-1">1st Place (%)</Label>
                <Input
                  id="first"
                  type="number"
                  value={firstPlace}
                  onChange={(e) => setFirstPlace(Number(e.target.value))}
                  className="w-20"
                />
                <div className="font-semibold text-yellow-600 min-w-0">
                  ${firstPayout.toFixed(2)}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Label htmlFor="second" className="min-w-0 flex-1">2nd Place (%)</Label>
                <Input
                  id="second"
                  type="number"
                  value={secondPlace}
                  onChange={(e) => setSecondPlace(Number(e.target.value))}
                  className="w-20"
                />
                <div className="font-semibold text-gray-600 min-w-0">
                  ${secondPayout.toFixed(2)}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Label htmlFor="third" className="min-w-0 flex-1">3rd Place (%)</Label>
                <Input
                  id="third"
                  type="number"
                  value={thirdPlace}
                  onChange={(e) => setThirdPlace(Number(e.target.value))}
                  className="w-20"
                />
                <div className="font-semibold text-orange-600 min-w-0">
                  ${thirdPayout.toFixed(2)}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Label htmlFor="fourth" className="min-w-0 flex-1">4th Place (%)</Label>
                <Input
                  id="fourth"
                  type="number"
                  value={fourthPlace}
                  onChange={(e) => setFourthPlace(Number(e.target.value))}
                  className="w-20"
                />
                <div className="font-semibold text-blue-600 min-w-0">
                  ${fourthPayout.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceManager;