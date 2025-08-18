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

      if (paymentError) {
        console.error('Error fetching player payments:', paymentError);
        return;
      }

      // Build the refreshed team object
      const regTournaments = registrations?.map(r => r.tournament_id) || [];
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
    
    // Boston Pot mismatch if one player is in Boston Pot and the other isn't
    const bostonPotMismatch = (player1BostonPot !== player2BostonPot);
    
    return { tournamentPaid, bostonPotPaid, bostonPotMismatch };
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
            <div className="text-sm font-medium mt-2">
              Total Amount Due: ${calculateTeamTotalOwed(team)}
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
                    Tournament Cost: ${tournament?.cost || 0} per player
                    {tournament?.bostonPotCost && (
                      <span> | Boston Pot: ${tournament.bostonPotCost} per player</span>
                    )}
                  </div>
                  
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


