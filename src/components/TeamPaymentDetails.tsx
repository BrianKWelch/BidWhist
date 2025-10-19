import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, AlertTriangle } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { Team } from '@/contexts/AppContext';
import { toast } from '@/hooks/use-toast';

interface TeamPaymentDetailsProps {
  teamId?: string;
  onBackToCommandCenter?: () => void;
}

const TeamPaymentDetails: React.FC<TeamPaymentDetailsProps> = ({ teamId, onBackToCommandCenter }) => {
  const { teams, tournaments, updatePlayerPayment, getTeamPaymentStatus, calculateTeamTotalOwed, refreshTeams } = useAppContext();
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [refreshedTeam, setRefreshedTeam] = useState<Team | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Use refreshed team data if available, otherwise use selected team
  const displayTeam = refreshedTeam || selectedTeam;

  // Set initial team from prop or find by ID
  useEffect(() => {
    if (teamId) {
      const team = teams.find(t => t.id === teamId);
      if (team) {
        setSelectedTeam(team);
      }
    }
  }, [teamId, teams]);

  // Refresh team data when a team is first selected
  useEffect(() => {
    if (selectedTeam && !refreshedTeam) {
      refreshTeamPaymentData(selectedTeam.id);
    }
  }, [selectedTeam]);

  const refreshTeamPaymentData = async (teamId: string) => {
    try {
      const { supabase } = await import('../supabaseClient');
      
      // Fetch the team with player data
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select(`
          *,
          player1:players!player1_id(*),
          player2:players!player2_id(*)
        `)
        .eq('id', teamId)
        .single();

      if (teamError) {
        console.error('Error fetching team data:', teamError);
        return;
      }

      // Fetch team registrations
      const { data: registrations, error: regError } = await supabase
        .from('team_registrations')
        .select('tournament_id')
        .eq('team_id', teamId);

      if (regError) {
        console.error('Error fetching team registrations:', regError);
        return;
      }

      // Fetch player tournament payments for both players
      const { data: playerPayments, error: paymentError } = await supabase
        .from('player_tournament')
        .select('*')
        .or(`player_id.eq.${teamData.player1_id},player_id.eq.${teamData.player2_id}`);

      console.log('Player payments query:', {
        player1_id: teamData.player1_id,
        player2_id: teamData.player2_id,
        playerPayments,
        paymentError
      });

      if (paymentError) {
        console.error('Error fetching player payments:', paymentError);
        return;
      }

      // Build the refreshed team object
      const regTournaments = registrations?.map(r => r.tournament_id) || [];
      
      // Determine Boston Pot tournaments based on player_tournament records
      const bostonPotTournaments: string[] = [];
      const player1BostonPotTournaments = new Set<string>();
      const player2BostonPotTournaments = new Set<string>();
      
      console.log('Player payments data:', playerPayments);
      console.log('Team data:', { player1_id: teamData.player1_id, player2_id: teamData.player2_id });
      
      playerPayments?.forEach(payment => {
        console.log(`Payment: player_id=${payment.player_id}, tournament_id=${payment.tournament_id}, entered_boston_pot=${payment.entered_boston_pot}`);
        
        if (payment.player_id === teamData.player1_id && payment.entered_boston_pot) {
          player1BostonPotTournaments.add(payment.tournament_id);
          console.log(`Added player1 Boston Pot tournament: ${payment.tournament_id}`);
        } else if (payment.player_id === teamData.player2_id && payment.entered_boston_pot) {
          player2BostonPotTournaments.add(payment.tournament_id);
          console.log(`Added player2 Boston Pot tournament: ${payment.tournament_id}`);
        }
      });
      
      console.log('Player1 Boston Pot tournaments:', Array.from(player1BostonPotTournaments));
      console.log('Player2 Boston Pot tournaments:', Array.from(player2BostonPotTournaments));
      
      // Team is in Boston Pot if both players are in Boston Pot for the same tournament
      regTournaments.forEach(tournamentId => {
        const player1InBostonPot = player1BostonPotTournaments.has(tournamentId);
        const player2InBostonPot = player2BostonPotTournaments.has(tournamentId);
        console.log(`Tournament ${tournamentId}: player1=${player1InBostonPot}, player2=${player2InBostonPot}`);
        
        if (player1InBostonPot && player2InBostonPot) {
          bostonPotTournaments.push(tournamentId);
          console.log(`Added tournament ${tournamentId} to team Boston Pot tournaments`);
        }
      });
      
      console.log('Final bostonPotTournaments:', bostonPotTournaments);
      
      const refreshedTeamData: Team = {
        ...teamData,
        id: String(teamData.id),
        player1FirstName: teamData.player1?.first_name || '',
        player1LastName: teamData.player1?.last_name || '',
        player2FirstName: teamData.player2?.first_name || '',
        player2LastName: teamData.player2?.last_name || '',
        phoneNumber: teamData.player1?.phone_number || teamData.player2?.phone_number || '',
        city: teamData.player1?.city || teamData.player2?.city || '',
        registeredTournaments: regTournaments,
        bostonPotTournaments: bostonPotTournaments,
        player1TournamentPayments: {},
        player2TournamentPayments: {},
        player1BostonPotPayments: {},
        player2BostonPotPayments: {}
      };

      // Populate payment data
      playerPayments?.forEach(payment => {
        if (payment.player_id === teamData.player1_id) {
          refreshedTeamData.player1TournamentPayments![payment.tournament_id] = payment.paid;
          refreshedTeamData.player1BostonPotPayments![payment.tournament_id] = payment.b_paid;
        } else if (payment.player_id === teamData.player2_id) {
          refreshedTeamData.player2TournamentPayments![payment.tournament_id] = payment.paid;
          refreshedTeamData.player2BostonPotPayments![payment.tournament_id] = payment.b_paid;
        }
      });

      console.log('Refreshed team data:', {
        teamName: refreshedTeamData.name,
        registeredTournaments: refreshedTeamData.registeredTournaments,
        bostonPotTournaments: refreshedTeamData.bostonPotTournaments,
        player1TournamentPayments: refreshedTeamData.player1TournamentPayments,
        player2TournamentPayments: refreshedTeamData.player2TournamentPayments,
        player1BostonPotPayments: refreshedTeamData.player1BostonPotPayments,
        player2BostonPotPayments: refreshedTeamData.player2BostonPotPayments
      });

      setRefreshedTeam(refreshedTeamData);
    } catch (error) {
      console.error('Error refreshing team payment data:', error);
    }
  };

  const handleMarkPlayerPaid = async (playerId: string, tournamentId: string, isPaid: boolean) => {
    if (!displayTeam) return;

    try {
      setIsUpdating(true);
      
      // Update both tournament and Boston Pot payments simultaneously
      const { supabase } = await import('../supabaseClient');
      
      const { error } = await supabase
        .from('player_tournament')
        .update({ paid: isPaid, b_paid: isPaid })
        .eq('player_id', playerId)
        .eq('tournament_id', tournamentId);

      if (error) {
        console.error('Error updating player payment:', error);
        throw error;
      }

      // Immediately update the local state to reflect the change
      if (refreshedTeam) {
        const updatedTeam = { ...refreshedTeam };
        
        if (playerId === updatedTeam.player1_id) {
          updatedTeam.player1TournamentPayments = {
            ...updatedTeam.player1TournamentPayments,
            [tournamentId]: isPaid
          };
          updatedTeam.player1BostonPotPayments = {
            ...updatedTeam.player1BostonPotPayments,
            [tournamentId]: isPaid
          };
        } else if (playerId === updatedTeam.player2_id) {
          updatedTeam.player2TournamentPayments = {
            ...updatedTeam.player2TournamentPayments,
            [tournamentId]: isPaid
          };
          updatedTeam.player2BostonPotPayments = {
            ...updatedTeam.player2BostonPotPayments,
            [tournamentId]: isPaid
          };
        }
        
        setRefreshedTeam(updatedTeam);
      }

      // Refresh teams to update payment status in other components
      await refreshTeams();

      toast({ title: `Payment ${isPaid ? 'marked as paid' : 'marked as unpaid'} successfully` });
      
    } catch (error) {
      console.error('Error updating player payment:', error);
      alert('Failed to update payment. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleBostonPot = async (tournamentId: string, isInBostonPot: boolean) => {
    if (!displayTeam) return;

    try {
      setIsUpdating(true);
      
      const { supabase } = await import('../supabaseClient');
      
      // Update both players' Boston Pot status
      const { error: player1Error } = await supabase
        .from('player_tournament')
        .update({ entered_boston_pot: isInBostonPot })
        .eq('player_id', displayTeam.player1_id)
        .eq('tournament_id', tournamentId);

      const { error: player2Error } = await supabase
        .from('player_tournament')
        .update({ entered_boston_pot: isInBostonPot })
        .eq('player_id', displayTeam.player2_id)
        .eq('tournament_id', tournamentId);

      if (player1Error || player2Error) {
        console.error('Error updating Boston Pot status:', player1Error || player2Error);
        throw player1Error || player2Error;
      }

      // Update local state
      if (refreshedTeam) {
        const updatedTeam = { ...refreshedTeam };
        
        if (isInBostonPot) {
          // Add to Boston Pot
          updatedTeam.bostonPotTournaments = [
            ...(updatedTeam.bostonPotTournaments || []),
            tournamentId
          ];
        } else {
          // Remove from Boston Pot
          updatedTeam.bostonPotTournaments = (updatedTeam.bostonPotTournaments || [])
            .filter(id => id !== tournamentId);
        }
        
        setRefreshedTeam(updatedTeam);
      }

      // Refresh teams to update payment status in other components
      await refreshTeams();

      toast({ 
        title: `Boston Pot ${isInBostonPot ? 'enabled' : 'disabled'}`, 
        description: `Team ${isInBostonPot ? 'added to' : 'removed from'} Boston Pot for this tournament.` 
      });
      
    } catch (error) {
      console.error('Error updating Boston Pot status:', error);
      alert('Failed to update Boston Pot status. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const getPaymentBadge = (status: { tournamentPaid: boolean; bostonPotPaid: boolean; bostonPotMismatch: boolean }) => {
    if (status.tournamentPaid && status.bostonPotPaid) {
      return <Badge className="bg-green-500">Fully Paid</Badge>;
    } else if (status.tournamentPaid) {
      return <Badge className="bg-yellow-500">Entry Paid</Badge>;
    } else {
      return <Badge variant="secondary">Unpaid</Badge>;
    }
  };

  const getTeamPaymentStatusFromRefreshedData = (team: Team, tournamentId: string) => {
    const player1Tournament = team.player1TournamentPayments?.[tournamentId];
    const player2Tournament = team.player2TournamentPayments?.[tournamentId];
    const player1BostonPot = team.player1BostonPotPayments?.[tournamentId];
    const player2BostonPot = team.player2BostonPotPayments?.[tournamentId];
    
    const tournamentPaid = player1Tournament && player2Tournament;
    const bostonPotPaid = player1BostonPot && player2BostonPot;
    
    // Boston Pot mismatch if one player has paid for Boston Pot and the other hasn't
    // This should only happen if the team is in Boston Pot but payments are mismatched
    const isInBostonPot = team.bostonPotTournaments?.includes(tournamentId);
    const bostonPotMismatch = isInBostonPot && (player1BostonPot !== player2BostonPot);
    
    return { tournamentPaid, bostonPotPaid, bostonPotMismatch };
  };

  const calculateTournamentTotal = (team: Team): number => {
    let total = 0;
    if (team.registeredTournaments) {
      team.registeredTournaments.forEach(tournamentId => {
        const tournament = tournaments.find(t => t.id === tournamentId);
        if (tournament) {
          total += tournament.cost;
        }
      });
    }
    return total;
  };

  const calculateBostonPotTotal = (team: Team): number => {
    let total = 0;
    console.log('Calculating Boston Pot total for team:', {
      teamName: team.name,
      registeredTournaments: team.registeredTournaments,
      bostonPotTournaments: team.bostonPotTournaments
    });
    
    if (team.registeredTournaments) {
      team.registeredTournaments.forEach(tournamentId => {
        const tournament = tournaments.find(t => t.id === tournamentId);
        const isInBostonPot = team.bostonPotTournaments?.includes(tournamentId);
        console.log(`Tournament ${tournamentId}: isInBostonPot=${isInBostonPot}, bostonPotCost=${tournament?.bostonPotCost}`);
        
        if (tournament && isInBostonPot) {
          total += tournament.bostonPotCost;
          console.log(`Added Boston Pot cost: ${tournament.bostonPotCost}, total now: ${total}`);
        }
      });
    }
    
    console.log(`Final Boston Pot total for team ${team.name}: ${total}`);
    return total;
  };

  if (!displayTeam) {
    return (
      <div className="space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Team Payment Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500 text-center py-8">No team selected or team not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const team = displayTeam;
  
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Payment Details for {team.name}
            </CardTitle>
            <div className="flex gap-2">
              {onBackToCommandCenter && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onBackToCommandCenter}
                  className="text-red-600 border-red-600 hover:bg-red-600 hover:text-white"
                >
                  ← Back to Command Center
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => refreshTeamPaymentData(team.id)}
                disabled={isUpdating}
              >
                Refresh Data
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm text-gray-600 mb-2">Team Details:</div>
            <div className="font-semibold">{team.name}</div>
            <div className="text-sm text-gray-600">
              Phone: {team.phoneNumber} | City: {team.city}
            </div>
            <div className="text-sm font-medium mt-2 space-y-1">
              <div>Tournament Total: ${calculateTournamentTotal(team)}</div>
              <div>Boston Pot Total: ${calculateBostonPotTotal(team)}</div>
              <div className="font-bold text-lg">Grand Total: ${calculateTeamTotalOwed(team)}</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-medium">Tournament Payments:</div>
            {team.registeredTournaments?.map(tournamentId => {
              const tournament = tournaments.find(t => t.id === tournamentId);
              const paymentStatus = getTeamPaymentStatusFromRefreshedData(team, tournamentId);
              
              return (
                <div key={tournamentId} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{tournament?.name || tournamentId}</span>
                    {getPaymentBadge(paymentStatus)}
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    Tournament Cost: ${((tournament?.cost || 0) / 2).toFixed(2)} per player
                    {tournament?.bostonPotCost && (
                      <span> | Boston Pot: ${(tournament.bostonPotCost / 2).toFixed(2)} per player</span>
                    )}
                  </div>
                  
                  {/* Boston Pot Opt-out Toggle */}
                  {tournament?.bostonPotCost && (
                    <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-yellow-800">Boston Pot Participation</div>
                          <div className="text-sm text-yellow-700">
                            {team.bostonPotTournaments?.includes(tournamentId) 
                              ? `Team is in Boston Pot (+$${(tournament.bostonPotCost / 2).toFixed(2)} per player)`
                              : `Team opted out of Boston Pot (saves $${(tournament.bostonPotCost / 2).toFixed(2)} per player)`
                            }
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={team.bostonPotTournaments?.includes(tournamentId) ? "default" : "outline"}
                          onClick={() => handleToggleBostonPot(tournamentId, !team.bostonPotTournaments?.includes(tournamentId))}
                          disabled={isUpdating}
                          className={team.bostonPotTournaments?.includes(tournamentId) 
                            ? "bg-yellow-600 hover:bg-yellow-700" 
                            : "border-yellow-600 text-yellow-600 hover:bg-yellow-50"
                          }
                        >
                          {team.bostonPotTournaments?.includes(tournamentId) ? 'In Boston Pot' : 'Opt Out'}
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {paymentStatus.bostonPotMismatch && (
                    <div className="mb-2 p-2 bg-orange-50 border border-orange-200 rounded-md">
                      <div className="flex items-center gap-2 text-orange-700">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm font-medium">Boston Pot Mismatch</span>
                      </div>
                      <p className="text-xs text-orange-600 mt-1">
                        One player opted into Boston Pot, the other didn't. Team is not in Boston Pot.
                      </p>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    {/* Player 1 */}
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div>
                        <span className="font-medium">{team.player1FirstName} {team.player1LastName}</span>
                        <div className="text-xs text-gray-600">
                          Tournament: {team.player1TournamentPayments?.[tournamentId] ? 'Paid' : 'Unpaid'} | 
                          Boston Pot: {team.player1BostonPotPayments?.[tournamentId] ? 'Paid' : 'Unpaid'}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant={team.player1TournamentPayments?.[tournamentId] ? "default" : "outline"}
                          onClick={() => handleMarkPlayerPaid(team.player1_id, tournamentId, !team.player1TournamentPayments?.[tournamentId])}
                          disabled={isUpdating}
                        >
                          {team.player1TournamentPayments?.[tournamentId] ? 'Paid' : 'Mark Paid'}
                        </Button>
                      </div>
                    </div>

                    {/* Player 2 */}
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div>
                        <span className="font-medium">{team.player2FirstName} {team.player2LastName}</span>
                        <div className="text-xs text-gray-600">
                          Tournament: {team.player2TournamentPayments?.[tournamentId] ? 'Paid' : 'Unpaid'} | 
                          Boston Pot: {team.player2BostonPotPayments?.[tournamentId] ? 'Paid' : 'Unpaid'}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant={team.player2TournamentPayments?.[tournamentId] ? "default" : "outline"}
                          onClick={() => handleMarkPlayerPaid(team.player2_id, tournamentId, !team.player2TournamentPayments?.[tournamentId])}
                          disabled={isUpdating}
                        >
                          {team.player2TournamentPayments?.[tournamentId] ? 'Paid' : 'Mark Paid'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamPaymentDetails;


