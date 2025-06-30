import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trophy, Users, Phone, MapPin, Edit, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import TeamEditor from './TeamEditor';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const TeamsByTournament: React.FC = () => {
  const { teams, tournaments, updateTeam } = useAppContext();
  const [editingTeam, setEditingTeam] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedTournaments, setCollapsedTournaments] = useState<Set<string>>(new Set());

  const getTeamsForTournament = (tournamentId: string) => {
    return teams.filter(team => 
      team.registeredTournaments?.includes(tournamentId)
    );
  };

  const getPaymentStatus = (team: any) => {
    const player1Paid = team.player1PaymentStatus === 'paid';
    const player2Paid = team.player2PaymentStatus === 'paid';
    
    if (player1Paid && player2Paid) return 'fully-paid';
    if (player1Paid || player2Paid) return 'partially-paid';
    return 'unpaid';
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case 'fully-paid':
        return <Badge className="bg-green-500">Fully Paid</Badge>;
      case 'partially-paid':
        return <Badge variant="secondary" className="bg-yellow-500 text-white">Partial</Badge>;
      default:
        return <Badge variant="secondary">Unpaid</Badge>;
    }
  };

  const filterTeams = (teams: any[]) => {
    if (!searchTerm) return teams;
    
    return teams.filter(team => {
      const searchLower = searchTerm.toLowerCase();
      return (
        team.name.toLowerCase().includes(searchLower) ||
        team.city.toLowerCase().includes(searchLower) ||
        team.player1FirstName.toLowerCase().includes(searchLower) ||
        team.player1LastName.toLowerCase().includes(searchLower) ||
        team.player2FirstName.toLowerCase().includes(searchLower) ||
        team.player2LastName.toLowerCase().includes(searchLower)
      );
    });
  };

  const toggleTournament = (tournamentId: string) => {
    const newCollapsed = new Set(collapsedTournaments);
    if (newCollapsed.has(tournamentId)) {
      newCollapsed.delete(tournamentId);
    } else {
      newCollapsed.add(tournamentId);
    }
    setCollapsedTournaments(newCollapsed);
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Teams by Tournament
          </CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by team name, city, or player name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tournaments.map((tournament) => {
              const tournamentTeams = filterTeams(getTeamsForTournament(tournament.id));
              const isCollapsed = collapsedTournaments.has(tournament.id);
              
              return (
                <Collapsible key={tournament.id} open={!isCollapsed}>
                  <div className="border rounded-lg">
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
                        onClick={() => toggleTournament(tournament.id)}
                      >
                        <div className="flex items-center gap-2">
                          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          <h3 className="text-lg font-semibold">{tournament.name}</h3>
                        </div>
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {tournamentTeams.length} teams
                        </Badge>
                      </Button>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <div className="p-4 pt-0">
                        {tournamentTeams.length === 0 ? (
                          <p className="text-gray-500 text-center py-2">No teams found</p>
                        ) : (
                          <div className="space-y-2">
                            {tournamentTeams.map((team) => {
                              const paymentStatus = getPaymentStatus(team);
                              const inBostonPot = team.bostonPotTournaments?.includes(tournament.id);
                              
                              return (
                                <div key={team.id} className="p-3 bg-gray-50 rounded space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="font-medium">{team.name}</div>
                                      <div className="text-sm text-gray-600">
                                        {team.player1FirstName} {team.player1LastName} & {team.player2FirstName} {team.player2LastName}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditingTeam(team)}
                                      >
                                        <Edit className="w-3 h-3" />
                                      </Button>
                                      <div className="text-right">
                                        {getPaymentBadge(paymentStatus)}
                                        <div className="text-xs text-gray-500 mt-1">
                                          ${team.totalOwed} each
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-4">
                                      <div className="flex items-center gap-1 text-gray-600">
                                        <Phone className="w-3 h-3" />
                                        <span>{team.phoneNumber}</span>
                                      </div>
                                      <div className="flex items-center gap-1 text-gray-600">
                                        <MapPin className="w-3 h-3" />
                                        <span>{team.city}</span>
                                      </div>
                                    </div>
                                    {inBostonPot && (
                                      <Badge variant="outline" className="text-xs">
                                        Boston Pot
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        </CardContent>
      </Card>
      
      {editingTeam && (
        <TeamEditor
          team={editingTeam}
          isOpen={!!editingTeam}
          onClose={() => setEditingTeam(null)}
          onSave={updateTeam}
        />
      )}
    </div>
  );
};

export default TeamsByTournament;