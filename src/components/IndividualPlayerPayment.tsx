import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Check, User, X } from 'lucide-react';
import { Team } from '@/contexts/AppContext';
import { useAppContext } from '@/contexts/AppContext';

interface IndividualPlayerPaymentProps {
  team: Team;
  onComplete: () => void;
}

const IndividualPlayerPayment: React.FC<IndividualPlayerPaymentProps> = ({
  team,
  onComplete
}) => {
  const { updatePlayerTournamentPayment, tournaments } = useAppContext();

  const getTournamentCost = (tournamentId: string) => {
    const tournament = tournaments.find(t => t.id === tournamentId);
    if (!tournament) return 0;
    
    let cost = tournament.cost;
    if (team.bostonPotTournaments?.includes(tournamentId)) {
      cost += tournament.bostonPotCost;
    }
    return cost;
  };

  const getTotalPlayerCost = () => {
    if (!team.registeredTournaments) return 0;
    return team.registeredTournaments.reduce((total, tournamentId) => {
      return total + getTournamentCost(tournamentId);
    }, 0);
  };

  const isPlayerTournamentPaid = (player: 'player1' | 'player2', tournamentId: string) => {
    const payments = player === 'player1' ? team.player1TournamentPayments : team.player2TournamentPayments;
    return payments?.[tournamentId] || false;
  };
console.log('Registered tournaments:', team.registeredTournaments);

  const handleTournamentPayment = (playerId: 'player1' | 'player2', tournamentId: string, paid: boolean) => {
    updatePlayerTournamentPayment(team.id, playerId, tournamentId, paid);
  };

  const handlePayForAll = (playerId: 'player1' | 'player2') => {
    if (!team.registeredTournaments) return;
    console.log(`Paying all for ${playerId}:`, team.registeredTournaments);
    team.registeredTournaments.forEach(tournamentId => {
      updatePlayerTournamentPayment(team.id, playerId, tournamentId, true);
    });
  };

  const totalPerPlayer = getTotalPlayerCost();

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Individual Payment - {team.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm text-gray-600 mb-2">Team Details:</div>
          <div className="font-semibold">{team.name}</div>
          <div className="text-sm text-gray-600">
            Phone: {team.phoneNumber} | City: {team.city}
          </div>
        </div>

        <div className="space-y-4">
          {/* Player 1 */}
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4" />
              <span className="font-medium">
                {team.player1FirstName} {team.player1LastName}
              </span>
            </div>
            
            <div className="space-y-2 mb-3">
              {team.registeredTournaments?.map(tournamentId => {
                const tournament = tournaments.find(t => t.id === tournamentId);
                const cost = getTournamentCost(tournamentId);
                const isPaid = isPlayerTournamentPaid('player1', tournamentId);
                return (
                  <div key={tournamentId} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                    <div className="flex items-center gap-2">
                      <span>{tournament?.name}</span>
                      <Badge variant={isPaid ? 'default' : 'secondary'} className={isPaid ? 'bg-green-500' : ''}>
                        {isPaid ? 'Paid' : 'Pending'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">${cost.toFixed(2)}</span>
                      {!isPaid ? (
                        <Button
                          onClick={() => handleTournamentPayment('player1', tournamentId, true)}
                          size="sm"
                          variant="outline"
                          className="h-6 px-2"
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleTournamentPayment('player1', tournamentId, false)}
                          size="sm"
                          variant="outline"
                          className="h-6 px-2"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-between font-medium pt-2 border-t">
                <span>Pay for All</span>
                <div className="flex items-center gap-2">
                  <span>${totalPerPlayer.toFixed(2)}</span>
                  <Button
                    onClick={() => handlePayForAll('player1')}
                    size="sm"
                    className="h-6 px-2"
                  >
                    Pay All
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Player 2 */}
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4" />
              <span className="font-medium">
                {team.player2FirstName} {team.player2LastName}
              </span>
            </div>
            
            <div className="space-y-2 mb-3">
              {team.registeredTournaments?.map(tournamentId => {
                const tournament = tournaments.find(t => t.id === tournamentId);
                const cost = getTournamentCost(tournamentId);
                const isPaid = isPlayerTournamentPaid('player2', tournamentId);
                return (
                  <div key={tournamentId} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                    <div className="flex items-center gap-2">
                      <span>{tournament?.name}</span>
                      <Badge variant={isPaid ? 'default' : 'secondary'} className={isPaid ? 'bg-green-500' : ''}>
                        {isPaid ? 'Paid' : 'Pending'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">${cost.toFixed(2)}</span>
                      {!isPaid ? (
                        <Button
                          onClick={() => handleTournamentPayment('player2', tournamentId, true)}
                          size="sm"
                          variant="outline"
                          className="h-6 px-2"
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleTournamentPayment('player2', tournamentId, false)}
                          size="sm"
                          variant="outline"
                          className="h-6 px-2"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-between font-medium pt-2 border-t">
                <span>Pay for All</span>
                <div className="flex items-center gap-2">
                  <span>${totalPerPlayer.toFixed(2)}</span>
                  <Button
                    onClick={() => handlePayForAll('player2')}
                    size="sm"
                    className="h-6 px-2"
                  >
                    Pay All
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            onClick={onComplete}
            className="flex-1"
          >
            Complete Registration
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default IndividualPlayerPayment;