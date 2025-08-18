import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DollarSign, Search, User, Check, X, Phone, MapPin, ChevronDown, ChevronRight } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  teamName: string;
  phone_Number: string;
  city: string;
  tournamentPayments: { [tournamentId: string]: boolean };
  teamId: string;
}

const IndividualPlayerPayments: React.FC = () => {
  const { teams, tournaments, updatePlayerTournamentPayment } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [openTournaments, setOpenTournaments] = useState<Set<string>>(new Set());

  // Convert teams to individual players
  const players: Player[] = teams.flatMap(team => [
    {
      id: `${team.id}-player1`,
      firstName: team.player1_first_name || team.player1FirstName,
      lastName: team.player1_last_name || team.player1LastName,
      teamName: team.name,
      phone_Number: team.phone_Number || team.phoneNumber,
      city: team.city,
      tournamentPayments: team.player1TournamentPayments || {},
      teamId: team.id
    },
    {
      id: `${team.id}-player2`,
      firstName: team.player2_first_name || team.player2FirstName,
      lastName: team.player2_last_name || team.player2LastName,
      teamName: team.name,
      phone_Number: team.phone_Number || team.phoneNumber,
      city: team.city,
      tournamentPayments: team.player2TournamentPayments || {},
      teamId: team.id
    }
  ]);

  const handlePlayerPayment = (player: Player, tournamentId: string, currentPaid: boolean) => {
    const playerNumber = player.id.endsWith('-player1') ? 'player1' : 'player2';
    updatePlayerTournamentPayment(player.teamId, playerNumber, tournamentId, !currentPaid);
  };

  const toggleTournament = (tournamentId: string) => {
    setOpenTournaments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tournamentId)) {
        newSet.delete(tournamentId);
      } else {
        newSet.add(tournamentId);
      }
      return newSet;
    });
  };

  const searchLower = searchTerm.toLowerCase();
  const norm = (val: any) => (val ? String(val).toLowerCase() : '');
  const filteredPlayers = players.filter(player => 
    norm(player.firstName).includes(searchLower) ||
    norm(player.lastName).includes(searchLower) ||
    norm(player.teamName).includes(searchLower) ||
    norm(player.city).includes(searchLower)
  );

  const playersByTournament = tournaments.reduce((acc, tournament) => {
    const tournamentPlayers = filteredPlayers.filter(player => {
      const team = teams.find(t => t.id === player.teamId);
      return team?.registeredTournaments?.includes(tournament.id);
    });
    if (tournamentPlayers.length > 0) {
      acc[tournament.id] = {
        tournament,
        players: tournamentPlayers
      };
    }
    return acc;
  }, {} as Record<string, { tournament: any; players: Player[] }>);

  const getPlayerPaymentStatus = (player: Player, tournamentId: string) => {
    const tournament = tournaments.find(t => t.id === tournamentId);
    if (!tournament) return { status: 'pending', amount: 0, details: '' };
    
    const team = teams.find(t => t.id === player.teamId);
    const baseCost = tournament.cost / 2; // Split team cost between players
    const bostonPotCost = tournament.bostonPotCost / 2;
    const isInBostonPot = team?.bostonPotTournaments?.includes(tournamentId);
    const totalCost = baseCost + (isInBostonPot ? bostonPotCost : 0);
    
    const isPaid = player.tournamentPayments[tournamentId] || false;
    
    if (isPaid) {
      return { status: 'paid', amount: totalCost, details: `Paid $${totalCost.toFixed(2)}` };
    } else {
      if (isInBostonPot) {
        return { 
          status: 'pending', 
          amount: totalCost, 
          details: `Owes $${baseCost.toFixed(2)} entry + $${bostonPotCost.toFixed(2)} Boston pot = $${totalCost.toFixed(2)}` 
        };
      } else {
        return { 
          status: 'pending', 
          amount: totalCost, 
          details: `Owes $${totalCost.toFixed(2)} entry fee` 
        };
      }
    }
  };

  const PlayerCard = ({ player, tournamentId }: { player: Player; tournamentId: string }) => {
    const tournament = tournaments.find(t => t.id === tournamentId);
    const paymentStatus = getPlayerPaymentStatus(player, tournamentId);
    const isPaid = paymentStatus.status === 'paid';
    const team = teams.find(t => t.id === player.teamId);
    
    return (
      <div className="p-4 bg-gray-50 rounded-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-lg">{player.firstName} {player.lastName}</div>
          <Badge variant={isPaid ? 'default' : 'secondary'} className={isPaid ? 'bg-green-500' : 'bg-red-500'}>
            {isPaid ? 'Paid' : 'Unpaid'}
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <Phone className="w-3 h-3" />
            <span>{player.phone_Number}</span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            <span>{player.city}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-sm">
          <User className="w-4 h-4" />
          <span>Team: {player.teamName}</span>
        </div>
        
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="space-y-1">
            <div className="font-medium">{tournament?.name}</div>
            <div className="text-sm text-gray-600">{paymentStatus.details}</div>
          </div>
          <Button
            size="sm"
            variant={isPaid ? 'secondary' : 'default'}
            className={isPaid ? 'bg-gray-400 hover:bg-gray-500' : 'bg-blue-500 hover:bg-blue-600'}
            onClick={() => handlePlayerPayment(player, tournamentId, isPaid)}
          >
            {isPaid ? 'Reverse' : 'Pay Now'}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Individual Player Payments ({players.length} players)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by player name, team name, or city..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {players.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No players registered yet.</p>
            ) : filteredPlayers.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No players match your search.</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(playersByTournament).map(([tournamentId, { tournament, players: tournamentPlayers }]) => {
                  const isOpen = searchTerm.trim() ? tournamentPlayers.length > 0 : openTournaments.has(tournamentId);
                  return (
                    <Collapsible key={tournamentId} open={isOpen}>
                      <CollapsibleTrigger
                        onClick={() => toggleTournament(tournamentId)}
                        className="flex items-center justify-between w-full p-3 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200"
                      >
                        <div className="flex items-center gap-2">
                          {openTournaments.has(tournamentId) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                          <span className="font-semibold">{tournament.name}</span>
                          <Badge variant="outline">{tournamentPlayers.length} players</Badge>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 space-y-3">
                        {tournamentPlayers.map((player) => (
                          <PlayerCard key={player.id} player={player} tournamentId={tournamentId} />
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default IndividualPlayerPayments;


