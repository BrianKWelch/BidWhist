import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Users, Plus, X, Check, ArrowRight, RefreshCw } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { Player, Team } from '@/contexts/AppContext';

interface PendingTeam {
  id: string;
  player1: Player;
  player2: Player;
  name: string;
}

const TeamBuilder: React.FC = () => {
  const { teams, tournaments, getActiveTournament, createTeamFromPlayers } = useAppContext();
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [pendingTeams, setPendingTeams] = useState<PendingTeam[]>([]);
  const [selectedPlayer1, setSelectedPlayer1] = useState<Player | null>(null);
  const [selectedPlayer2, setSelectedPlayer2] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const activeTournament = getActiveTournament();

  // Load pending teams from localStorage on component mount
  useEffect(() => {
    if (!activeTournament) return;
    
    const storageKey = `pendingTeams_${activeTournament.id}`;
    const savedPendingTeams = localStorage.getItem(storageKey);
    
    if (savedPendingTeams) {
      try {
        const parsedTeams = JSON.parse(savedPendingTeams);
        setPendingTeams(parsedTeams);
        console.log('Loaded pending teams from localStorage:', parsedTeams.length);
      } catch (error) {
        console.error('Error parsing pending teams from localStorage:', error);
      }
    }
  }, [activeTournament]);

  // Save pending teams to localStorage whenever they change
  useEffect(() => {
    if (!activeTournament) return;
    
    const storageKey = `pendingTeams_${activeTournament.id}`;
    localStorage.setItem(storageKey, JSON.stringify(pendingTeams));
    console.log('Saved pending teams to localStorage:', pendingTeams.length);
  }, [pendingTeams, activeTournament]);

  // Debug logging
  useEffect(() => {
    console.log('=== TeamBuilder Debug ===');
    console.log('Active tournament:', activeTournament);
    console.log('Teams count:', teams.length);
    console.log('Sample team:', teams[0]);
    console.log('Teams with registrations:', teams.filter(t => t.registeredTournaments?.length > 0).length);
  }, [teams, activeTournament]);

  // Load available players for the active tournament
  useEffect(() => {
    if (!activeTournament) return;

    const loadTournamentPlayers = async () => {
      try {
        setIsLoading(true);
        const { supabase } = await import('../supabaseClient');
        
        console.log('=== Starting to load players for tournament:', activeTournament.id);
        console.log('Active tournament ID type:', typeof activeTournament.id);
        console.log('Active tournament ID value:', activeTournament.id);
        
        // Test 1: Get all records first to see what's in the table
        const { data: allRecords, error: allError } = await supabase
          .from('player_tournament')
          .select('*');

        if (allError) {
          console.error('Error fetching all player_tournament records:', allError);
          return;
        }

        console.log('Total records in player_tournament table:', allRecords?.length || 0);
        if (allRecords && allRecords.length > 0) {
          console.log('Sample record:', allRecords[0]);
          console.log('Sample tournament_id type:', typeof allRecords[0].tournament_id);
          console.log('Sample tournament_id value:', allRecords[0].tournament_id);
        }
        
        // Test 2: Try querying with different data types
        console.log('\n=== Testing different query approaches ===');
        
        // Test with string
        const { data: testString, error: errorString } = await supabase
          .from('player_tournament')
          .select('player_id')
          .eq('tournament_id', String(activeTournament.id));

        console.log('Query with string tournament_id:', testString?.length || 0, 'records');
        if (errorString) console.error('String query error:', errorString);
        
        // Test with number
        const { data: testNumber, error: errorNumber } = await supabase
          .from('player_tournament')
          .select('player_id')
          .eq('tournament_id', Number(activeTournament.id));

        console.log('Query with number tournament_id:', testNumber?.length || 0, 'records');
        if (errorNumber) console.error('Number query error:', errorNumber);
        
        // Test with original value
        const { data: testOriginal, error: errorOriginal } = await supabase
          .from('player_tournament')
          .select('player_id')
          .eq('tournament_id', activeTournament.id);

        console.log('Query with original tournament_id:', testOriginal?.length || 0, 'records');
        if (errorOriginal) console.error('Original query error:', errorOriginal);
        
        // Use the working query result
        const playerTournamentData = testString || testNumber || testOriginal;
        const ptError = errorString || errorNumber || errorOriginal;

        if (ptError) {
          console.error('Error fetching tournament player IDs:', ptError);
          return;
        }

        console.log('Final player tournament data:', playerTournamentData);
        console.log('Number of players in player_tournament table:', playerTournamentData?.length || 0);

        if (!playerTournamentData || playerTournamentData.length === 0) {
          console.log('No players registered for this tournament');
          setAvailablePlayers([]);
          return;
        }

        // Step 2: Get full player details for those IDs
        const playerIds = playerTournamentData.map(pt => pt.player_id);
        console.log('Player IDs to fetch:', playerIds);
        
        const { data: tournamentPlayers, error: playersError } = await supabase
          .from('players')
          .select('*')
          .in('id', playerIds);

        if (playersError) {
          console.error('Error fetching tournament players:', playersError);
          return;
        }

        console.log('Tournament players fetched:', tournamentPlayers);
        console.log('Number of players fetched:', tournamentPlayers?.length || 0);

        // For now, just show ALL players from the tournament (no filtering)
        const available = tournamentPlayers || [];

        // Step 3: Get teams registered for this tournament
        const { data: teamRegistrations, error: regError } = await supabase
          .from('team_registrations')
          .select('team_id')
          .eq('tournament_id', activeTournament.id);

        if (regError) {
          console.error('Error fetching team registrations:', regError);
          return;
        }

        console.log('Team registrations for tournament:', teamRegistrations);
        console.log('Number of teams registered:', teamRegistrations?.length || 0);

        // Step 4: Get player IDs from registered teams
        let committedPlayerIds = new Set<string>();
        if (teamRegistrations && teamRegistrations.length > 0) {
          const teamIds = teamRegistrations.map(tr => tr.team_id);
          console.log('Team IDs to check:', teamIds);

          const { data: registeredTeams, error: teamsError } = await supabase
            .from('teams')
            .select('player1_id, player2_id')
            .in('id', teamIds);

          if (teamsError) {
            console.error('Error fetching registered teams:', teamsError);
            return;
          }

          console.log('Registered teams with players:', registeredTeams);
          
          // Collect all player IDs from registered teams
          registeredTeams?.forEach(team => {
            committedPlayerIds.add(team.player1_id);
            committedPlayerIds.add(team.player2_id);
          });
        }

        console.log('Committed player IDs:', Array.from(committedPlayerIds));

        // Step 5: Filter out players who are already in pending teams
        const pendingPlayerIds = new Set<string>();
        pendingTeams.forEach(team => {
          pendingPlayerIds.add(team.player1.id);
          pendingPlayerIds.add(team.player2.id);
        });

        console.log('Pending player IDs:', Array.from(pendingPlayerIds));

        // Step 6: Filter available players (exclude both committed and pending players)
        const availableFiltered = available.filter(player => 
          !committedPlayerIds.has(player.id) && !pendingPlayerIds.has(player.id)
        );

        // Sort players by first name for easier finding
        availableFiltered.sort((a, b) => a.first_name.localeCompare(b.first_name));

        console.log('Final available players count:', availableFiltered.length);
        console.log('Available players:', availableFiltered.map(p => `${p.first_name} ${p.last_name}`));

        setAvailablePlayers(availableFiltered);
      } catch (error) {
        console.error('Error loading tournament players:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTournamentPlayers();
  }, [activeTournament, pendingTeams]); // Added pendingTeams dependency

  const handleRefreshPlayers = async () => {
    if (!activeTournament) return;
    
    // Trigger the same loading logic
    const loadTournamentPlayers = async () => {
      try {
        setIsLoading(true);
        const { supabase } = await import('../supabaseClient');
        
        console.log('=== Starting to load players for tournament:', activeTournament.id);
        
        // Step 1: Get all players registered for this tournament from player_tournament table
        const { data: playerTournamentData, error: ptError } = await supabase
          .from('player_tournament')
          .select('player_id')
          .eq('tournament_id', activeTournament.id);

        if (ptError) {
          console.error('Error fetching tournament player IDs:', ptError);
          return;
        }

        console.log('Player tournament data:', playerTournamentData);
        console.log('Number of players in player_tournament table:', playerTournamentData?.length || 0);

        if (!playerTournamentData || playerTournamentData.length === 0) {
          console.log('No players registered for this tournament');
          setAvailablePlayers([]);
          return;
        }

        // Step 2: Get full player details for those IDs
        const playerIds = playerTournamentData.map(pt => pt.player_id);
        console.log('Player IDs to fetch:', playerIds);
        
        const { data: tournamentPlayers, error: playersError } = await supabase
          .from('players')
          .select('*')
          .in('id', playerIds);

        if (playersError) {
          console.error('Error fetching tournament players:', playersError);
          return;
        }

        console.log('Tournament players fetched:', tournamentPlayers);
        console.log('Number of players fetched:', tournamentPlayers?.length || 0);

        // For now, just show ALL players from the tournament (no filtering)
        const available = tournamentPlayers || [];

        // Step 3: Get teams registered for this tournament
        const { data: teamRegistrations, error: regError } = await supabase
          .from('team_registrations')
          .select('team_id')
          .eq('tournament_id', activeTournament.id);

        if (regError) {
          console.error('Error fetching team registrations:', regError);
          return;
        }

        console.log('Team registrations for tournament:', teamRegistrations);
        console.log('Number of teams registered:', teamRegistrations?.length || 0);

        // Step 4: Get player IDs from registered teams
        let committedPlayerIds = new Set<string>();
        if (teamRegistrations && teamRegistrations.length > 0) {
          const teamIds = teamRegistrations.map(tr => tr.team_id);
          console.log('Team IDs to check:', teamIds);

          const { data: registeredTeams, error: teamsError } = await supabase
            .from('teams')
            .select('player1_id, player2_id')
            .in('id', teamIds);

          if (teamsError) {
            console.error('Error fetching registered teams:', teamsError);
            return;
          }

          console.log('Registered teams with players:', registeredTeams);
          
          // Collect all player IDs from registered teams
          registeredTeams?.forEach(team => {
            committedPlayerIds.add(team.player1_id);
            committedPlayerIds.add(team.player2_id);
          });
        }

        console.log('Committed player IDs:', Array.from(committedPlayerIds));

        // Step 5: Filter out players who are already in pending teams
        const pendingPlayerIds = new Set<string>();
        pendingTeams.forEach(team => {
          pendingPlayerIds.add(team.player1.id);
          pendingPlayerIds.add(team.player2.id);
        });

        console.log('Pending player IDs:', Array.from(pendingPlayerIds));

        // Step 6: Filter available players (exclude both committed and pending players)
        const availableFiltered = available.filter(player => 
          !committedPlayerIds.has(player.id) && !pendingPlayerIds.has(player.id)
        );

        // Sort players by first name for easier finding
        availableFiltered.sort((a, b) => a.first_name.localeCompare(b.first_name));

        console.log('Final available players count:', availableFiltered.length);
        console.log('Available players:', availableFiltered.map(p => `${p.first_name} ${p.last_name}`));

        setAvailablePlayers(availableFiltered);
      } catch (error) {
        console.error('Error loading tournament players:', error);
      } finally {
        setIsLoading(false);
      }
    };

    await loadTournamentPlayers();
  };

  const handlePlayerClick = (player: Player) => {
    if (!selectedPlayer1) {
      setSelectedPlayer1(player);
    } else if (!selectedPlayer2 && selectedPlayer1.id !== player.id) {
      setSelectedPlayer2(player);
      // Automatically create the team when second player is selected
      handleCreateTeam(player);
    }
  };

  const handleCreateTeam = (player2?: Player) => {
    const player1 = selectedPlayer1;
    const player2Final = player2 || selectedPlayer2;
    
    if (!player1 || !player2Final) return;

    const newTeam: PendingTeam = {
      id: `pending-${Date.now()}`,
      player1: player1,
      player2: player2Final,
      name: `${player1.first_name}/${player2Final.first_name}`
    };

    setPendingTeams(prev => [newTeam, ...prev]);
    
    // Remove players from available list
    setAvailablePlayers(prev => 
      prev.filter(p => p.id !== player1.id && p.id !== player2Final.id)
    );

    // Reset selections
    setSelectedPlayer1(null);
    setSelectedPlayer2(null);
  };

  const handleUndoTeam = (teamId: string) => {
    const teamToUndo = pendingTeams.find(team => team.id === teamId);
    if (!teamToUndo) return;

    // Add players back to available list
    setAvailablePlayers(prev => [...prev, teamToUndo.player1, teamToUndo.player2]);

    // Remove team from pending
    setPendingTeams(prev => prev.filter(team => team.id !== teamId));
  };

  const handleCommitTeam = async (team: PendingTeam) => {
    if (!activeTournament) return;
    
    try {
      const teamId = await createTeamFromPlayers(team.player1, team.player2, activeTournament.id);
      if (teamId) {
        // Remove from pending teams
        setPendingTeams(prev => prev.filter(t => t.id !== team.id));
        
        // Clear localStorage for this team
        const storageKey = `pendingTeams_${activeTournament.id}`;
        const currentPendingTeams = pendingTeams.filter(t => t.id !== team.id);
        localStorage.setItem(storageKey, JSON.stringify(currentPendingTeams));
        
        console.log('Team committed and removed from localStorage');
        
        // Refresh available players to reflect the new committed team
        await handleRefreshPlayers();
      }
    } catch (error) {
      console.error('Failed to commit team:', error);
    }
  };

  const handleCommitAll = async () => {
    if (!activeTournament) return;
    
    try {
      // Commit teams one by one
      for (const team of pendingTeams) {
        await createTeamFromPlayers(team.player1, team.player2, activeTournament.id);
      }
      // Clear all pending teams
      setPendingTeams([]);
      
      // Clear localStorage
      const storageKey = `pendingTeams_${activeTournament.id}`;
      localStorage.removeItem(storageKey);
      
      console.log('All teams committed and localStorage cleared');
      
      // Refresh available players to reflect all new committed teams
      await handleRefreshPlayers();
    } catch (error) {
      console.error('Failed to commit all teams:', error);
    }
  };

  const isPlayerSelected = (player: Player) => {
    return selectedPlayer1?.id === player.id || selectedPlayer2?.id === player.id;
  };

  if (!activeTournament) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="w-96">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Please select an active tournament to build teams.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Team Builder</h1>
        <p className="text-muted-foreground">
          Building teams for: <strong>{activeTournament.name}</strong>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Side - Available Players */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Available Players ({availablePlayers.length})
              </div>
              <Button onClick={handleRefreshPlayers} size="sm" variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">
                Loading players...
              </p>
            ) : availablePlayers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No available players. All players have been assigned to teams.
              </p>
            ) : (
              <div className="space-y-2">
                {availablePlayers.map((player) => (
                  <div
                    key={player.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      isPlayerSelected(player)
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => handlePlayerClick(player)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {player.first_name} {player.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {player.city} • {player.phone_number}
                        </p>
                      </div>
                      {isPlayerSelected(player) && (
                        <Badge variant="secondary">Selected</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

             {/* Team Creation Section - REMOVED - Teams are created automatically */}
          </CardContent>
        </Card>

        {/* Right Side - Pending Teams */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRight className="h-5 w-5" />
                Pending Teams ({pendingTeams.length})
              </div>
              {pendingTeams.length > 0 && (
                <Button onClick={handleCommitAll} size="sm">
                  <Check className="h-4 w-4 mr-2" />
                  Commit All
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingTeams.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No pending teams. Select players from the left to create teams.
              </p>
            ) : (
              <div className="space-y-4">
                {pendingTeams.map((team) => (
                  <Card key={team.id} className="border-dashed">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium">{team.name}</h4>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUndoTeam(team.id)}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Undo
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleCommitTeam(team)}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Commit
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">Player 1</Badge>
                          <span>{team.player1.first_name} {team.player1.last_name}</span>
                          <span className="text-muted-foreground">({team.player1.city})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">Player 2</Badge>
                          <span>{team.player2.first_name} {team.player2.last_name}</span>
                          <span className="text-muted-foreground">({team.player2.city})</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TeamBuilder; 