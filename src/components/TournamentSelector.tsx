import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Trophy, Star } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';

interface TournamentSelectorProps {
  selectedTournaments: string[];
  bostonPotTournaments: string[];
  onTournamentChange: (tournamentId: string, checked: boolean) => void;
  onBostonPotChange: (tournamentId: string, checked: boolean) => void;
}

const TournamentSelector: React.FC<TournamentSelectorProps> = ({
  selectedTournaments,
  bostonPotTournaments,
  onTournamentChange,
  onBostonPotChange
}) => {
  const { tournaments } = useAppContext();

  const totalCost = selectedTournaments.reduce((sum, tournamentId) => {
    const tournament = tournaments.find(t => t.id === tournamentId);
    let cost = tournament?.cost || 0;
    if (bostonPotTournaments.includes(tournamentId)) {
      cost += tournament?.bostonPotCost || 0;
    }
    return sum + cost;
  }, 0);

  const costPerPlayer = totalCost / 2; // Cost per player (team cost / 2)

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5" />
          Select Tournaments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          {tournaments.map((tournament) => {
            const isSelected = selectedTournaments.includes(tournament.id);
            const isBostonPot = bostonPotTournaments.includes(tournament.id);
            const tournamentCost = tournament.cost + (isBostonPot ? tournament.bostonPotCost : 0);
            
            return (
              <div
                key={tournament.id}
                className={`p-3 rounded-lg border transition-colors ${
                  isSelected ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id={tournament.id}
                      checked={isSelected}
                      onCheckedChange={(checked) => 
                        onTournamentChange(tournament.id, checked as boolean)
                      }
                    />
                    <label
                      htmlFor={tournament.id}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {tournament.name}
                    </label>
                  </div>
                  <Badge variant="secondary">
                    ${tournamentCost}
                  </Badge>
                </div>
                
                {isSelected && (
                  <div className="ml-6 flex items-center space-x-3 pt-2 border-t border-gray-200">
                    <Checkbox
                      id={`boston-${tournament.id}`}
                      checked={isBostonPot}
                      onCheckedChange={(checked) => 
                        onBostonPotChange(tournament.id, checked as boolean)
                      }
                    />
                    <label
                      htmlFor={`boston-${tournament.id}`}
                      className="text-xs text-gray-600 cursor-pointer flex items-center gap-1"
                    >
                      <Star className="w-3 h-3" />
                      Boston Pot (+${tournament.bostonPotCost})
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {selectedTournaments.length > 0 && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Total Cost:</span>
                <span className="font-semibold">${totalCost}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Cost per Player:</span>
                <span className="font-semibold text-green-600">${costPerPlayer}</span>
              </div>
              {bostonPotTournaments.length > 0 && (
                <div className="flex justify-between text-xs text-orange-600">
                  <span>Boston Pot Tournaments:</span>
                  <span>{bostonPotTournaments.length}</span>
                </div>
              )}
              <div className="text-xs text-gray-600 mt-2">
                Each player owes ${costPerPlayer} to participate in {selectedTournaments.length} tournament{selectedTournaments.length > 1 ? 's' : ''}
                {bostonPotTournaments.length > 0 && ` (including ${bostonPotTournaments.length} Boston Pot${bostonPotTournaments.length > 1 ? 's' : ''})`}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TournamentSelector;