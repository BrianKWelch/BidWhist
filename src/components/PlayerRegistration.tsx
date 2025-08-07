import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, X, Check, UserPlus, RefreshCw, Search, Users2, Undo2 } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { Player, Team } from '@/contexts/AppContext';

interface RegistrationForm {
  first_name: string;
  last_name: string;
  city: string;
  phone_number: string;
  selectedTournaments: string[];
  bostonPotTournaments: string[]; // New field for Boston Pot selection
}

interface PendingTeam {
  id: string;
  name: string;
  player1: Player;
  player2: Player;
  created_at: string;
}

const PlayerRegistration: React.FC = () => {
  const { tournaments, getActiveTournament, createTeamFromPlayers } = useAppContext();
  const [formData, setFormData] = useState<RegistrationForm>({
    first_name: '',
    last_name: '',
    city: '',
    phone_number: '',
    selectedTournaments: [],
    bostonPotTournaments: [], // Initialize new field
  });
  const [isLoading, setIsLoading] = useState(false);
  const [registeredPlayers, setRegisteredPlayers] = useState<Player[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddExistingPlayer, setShowAddExistingPlayer] = useState(false);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [selectedExistingPlayer, setSelectedExistingPlayer] = useState<Player | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [playerExistingTournaments, setPlayerExistingTournaments] = useState<string[]>([]);
  
  // New state for team creation workflow
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [pendingTeams, setPendingTeams] = useState<PendingTeam[]>([]);
  const [playerSearchTerm, setPlayerSearchTerm] = useState('');
  const [committedTeams, setCommittedTeams] = useState<Team[]>([]);

  const activeTournament = getActiveTournament();

  // Load registered players for the active tournament
  useEffect(() => {
    if (!activeTournament) return;

    const loadRegisteredPlayers = async () => {
      try {
        setIsLoading(true);
        const { supabase } = await import('../supabaseClient');

        // Get player IDs registered for this tournament
        const { data: playerTournamentData, error: ptError } = await supabase
          .from('player_tournament')
          .select('player_id')
          .eq('tournament_id', activeTournament.id);

        if (ptError) {
          console.error('Error fetching tournament player IDs:', ptError);
          return;
        }

        if (!playerTournamentData || playerTournamentData.length === 0) {
          setRegisteredPlayers([]);
          return;
        }

        // Get full player details
        const playerIds = playerTournamentData.map(pt => pt.player_id);
        const { data: players, error: playersError } = await supabase
          .from('players')
          .select('*')
          .in('id', playerIds);

        if (playersError) {
          console.error('Error fetching players:', playersError);
          return;
        }

        // Sort by name
        const sortedPlayers = (players || []).sort((a, b) => 
          a.first_name.localeCompare(b.first_name)
        );

        setRegisteredPlayers(sortedPlayers);
      } catch (error) {
        console.error('Error loading registered players:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadRegisteredPlayers();
  }, [activeTournament]);

  // Load committed teams for the active tournament
  useEffect(() => {
    if (!activeTournament) return;

    const loadCommittedTeams = async () => {
      try {
        const { supabase } = await import('../supabaseClient');

        // Get teams registered for this tournament
        const { data: teamRegistrations, error: regError } = await supabase
          .from('team_registrations')
          .select('team_id')
          .eq('tournament_id', activeTournament.id);

        if (regError) {
          console.error('Error fetching team registrations:', regError);
          return;
        }

        if (!teamRegistrations || teamRegistrations.length === 0) {
          setCommittedTeams([]);
          return;
        }

        // Get full team details with player information
        const teamIds = teamRegistrations.map(tr => tr.team_id);
        const { data: teams, error: teamsError } = await supabase
          .from('teams')
          .select(`
            *,
            player1:players!player1_id(*),
            player2:players!player2_id(*)
          `)
          .in('id', teamIds);

        if (teamsError) {
          console.error('Error fetching teams:', teamsError);
          return;
        }

        setCommittedTeams(teams || []);
      } catch (error) {
        console.error('Error loading committed teams:', error);
      }
    };

    loadCommittedTeams();
  }, [activeTournament]);

  // Load all players for adding existing players to tournaments
  useEffect(() => {
    const loadAllPlayers = async () => {
      try {
        const { supabase } = await import('../supabaseClient');
        const { data: players, error } = await supabase
          .from('players')
          .select('*')
          .order('first_name');

        if (error) {
          console.error('Error fetching all players:', error);
          return;
        }

        setAllPlayers(players || []);
      } catch (error) {
        console.error('Error loading all players:', error);
      }
    };

    loadAllPlayers();
  }, []);

  const handleInputChange = (field: keyof RegistrationForm, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTournamentToggle = (tournamentId: string) => {
    setFormData(prev => {
      const newSelectedTournaments = prev.selectedTournaments.includes(tournamentId)
        ? prev.selectedTournaments.filter(id => id !== tournamentId)
        : [...prev.selectedTournaments, tournamentId];
      
      // If adding a tournament, also add it to Boston Pot (95% opt in)
      const newBostonPotTournaments = prev.selectedTournaments.includes(tournamentId)
        ? prev.bostonPotTournaments.filter(id => id !== tournamentId) // Remove from Boston Pot if removing tournament
        : [...prev.bostonPotTournaments, tournamentId]; // Add to Boston Pot if adding tournament
      
      return {
        ...prev,
        selectedTournaments: newSelectedTournaments,
        bostonPotTournaments: newBostonPotTournaments
      };
    });
  };

  const handleBostonPotToggle = (tournamentId: string) => {
    setFormData(prev => ({
      ...prev,
      bostonPotTournaments: prev.bostonPotTournaments.includes(tournamentId)
        ? prev.bostonPotTournaments.filter(id => id !== tournamentId)
        : [...prev.bostonPotTournaments, tournamentId]
    }));
  };

  const calculateTotalCost = () => {
    return formData.selectedTournaments.reduce((total, tournamentId) => {
      const tournament = tournaments.find(t => t.id === tournamentId);
      return total + (tournament?.cost || 0);
    }, 0);
  };

  const filteredAllPlayers = allPlayers.filter(player => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      player.first_name.toLowerCase().includes(searchLower) ||
      player.last_name.toLowerCase().includes(searchLower) ||
      player.city.toLowerCase().includes(searchLower) ||
      player.phone_number.toLowerCase().includes(searchLower)
    );
  });

  const handleAddExistingPlayerToTournaments = async (player: Player, tournamentIds: string[]) => {
    try {
      setIsSubmitting(true);
      const { supabase } = await import('../supabaseClient');

      // Register the player for all selected tournaments
      const registrationPromises = tournamentIds.map(tournamentId =>
        supabase
          .from('player_tournament')
          .insert([{
            player_id: player.id,
            tournament_id: tournamentId
          }])
      );

      const registrationResults = await Promise.all(registrationPromises);
      const registrationErrors = registrationResults.filter(result => result.error);

      if (registrationErrors.length > 0) {
        console.error('Error registering player for tournaments:', registrationErrors);
        alert('Failed to register player for some tournaments. Please try again.');
        return;
      }

      // Refresh the registered players list if we're on the active tournament
      if (activeTournament && tournamentIds.includes(activeTournament.id)) {
        const updatedPlayers = [...registeredPlayers, player].sort((a, b) => 
          a.first_name.localeCompare(b.first_name)
        );
        setRegisteredPlayers(updatedPlayers);
      }

      // Reset form and close modal
      setFormData({
        first_name: '',
        last_name: '',
        city: '',
        phone_number: '',
        selectedTournaments: [],
        bostonPotTournaments: [],
      });
      setSelectedExistingPlayer(null);
      setShowAddExistingPlayer(false);
      setSearchTerm('');
      setPlayerExistingTournaments([]);

      const tournamentNames = tournaments
        .filter(t => tournamentIds.includes(t.id))
        .map(t => t.name)
        .join(', ');

      alert(`Player ${player.first_name} ${player.last_name} added successfully to: ${tournamentNames}`);
    } catch (error) {
      console.error('Error adding existing player to tournaments:', error);
      alert('Failed to add player to tournaments. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadPlayerExistingTournaments = async (playerId: string) => {
    try {
      const { supabase } = await import('../supabaseClient');
      const { data: existingRegistrations, error } = await supabase
        .from('player_tournament')
        .select('tournament_id')
        .eq('player_id', playerId);

      if (error) {
        console.error('Error fetching player tournament registrations:', error);
        return;
      }

      const existingTournamentIds = existingRegistrations?.map(reg => reg.tournament_id) || [];
      setPlayerExistingTournaments(existingTournamentIds);
    } catch (error) {
      console.error('Error loading player existing tournaments:', error);
    }
  };

  // Filter available players (registered but not in committed teams)
  const availablePlayers = registeredPlayers.filter(player => {
    // Check if player is in any committed team
    const isInCommittedTeam = committedTeams.some(team => 
      team.player1_id === player.id || team.player2_id === player.id
    );
    
    // Check if player is in any pending team
    const isInPendingTeam = pendingTeams.some(team => 
      team.player1.id === player.id || team.player2.id === player.id
    );

    return !isInCommittedTeam && !isInPendingTeam;
  });

  // Filter available players by search term
  const filteredAvailablePlayers = availablePlayers.filter(player => {
    if (!playerSearchTerm) return true;
    const searchLower = playerSearchTerm.toLowerCase();
    return (
      player.first_name.toLowerCase().includes(searchLower) ||
      player.last_name.toLowerCase().includes(searchLower) ||
      player.city.toLowerCase().includes(searchLower) ||
      player.phone_number.toLowerCase().includes(searchLower)
    );
  });

  const handlePlayerSelect = (player: Player) => {
    if (selectedPlayers.find(p => p.id === player.id)) {
      // Deselect player
      setSelectedPlayers(prev => prev.filter(p => p.id !== player.id));
    } else if (selectedPlayers.length < 2) {
      // Select player
      setSelectedPlayers(prev => [...prev, player]);
    }
  };

  const handleCreateTeam = async () => {
    if (!activeTournament || selectedPlayers.length !== 2) return;

    try {
      setIsSubmitting(true);
      
      // Create team using the context function
      const teamId = await createTeamFromPlayers(selectedPlayers[0], selectedPlayers[1], activeTournament.id);
      
      if (teamId) {
        // Add to pending teams
        const newTeam: PendingTeam = {
          id: teamId,
          name: `${selectedPlayers[0].first_name}/${selectedPlayers[1].first_name}`,
          player1: selectedPlayers[0],
          player2: selectedPlayers[1],
          created_at: new Date().toISOString()
        };
        
        setPendingTeams(prev => [newTeam, ...prev]);
        setSelectedPlayers([]);
        
        // Refresh committed teams
        const loadCommittedTeams = async () => {
          try {
            const { supabase } = await import('../supabaseClient');
            const { data: teamRegistrations, error: regError } = await supabase
              .from('team_registrations')
              .select('team_id')
              .eq('tournament_id', activeTournament.id);

            if (regError) return;

            if (teamRegistrations && teamRegistrations.length > 0) {
              const teamIds = teamRegistrations.map(tr => tr.team_id);
              const { data: teams, error: teamsError } = await supabase
                .from('teams')
                .select(`
                  *,
                  player1:players!player1_id(*),
                  player2:players!player2_id(*)
                `)
                .in('id', teamIds);

              if (!teamsError) {
                setCommittedTeams(teams || []);
              }
            }
          } catch (error) {
            console.error('Error refreshing committed teams:', error);
          }
        };
        
        loadCommittedTeams();
      }
    } catch (error) {
      console.error('Error creating team:', error);
      alert('Failed to create team. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUndoTeam = async (team: Team) => {
    if (!activeTournament || !confirm('Are you sure you want to undo this team? This will remove them from the tournament but keep the team record.')) {
      return;
    }

    try {
      const { supabase } = await import('../supabaseClient');
      
      // Remove team from tournament registration (but keep team record)
      const { error } = await supabase
        .from('team_registrations')
        .delete()
        .eq('team_id', team.id)
        .eq('tournament_id', activeTournament.id);

      if (error) {
        console.error('Error removing team from tournament:', error);
        alert('Failed to undo team. Please try again.');
        return;
      }

      // Remove from committed teams
      setCommittedTeams(prev => prev.filter(t => t.id !== team.id));
      
      alert('Team undone successfully! Players are now available for new teams.');
    } catch (error) {
      console.error('Error undoing team:', error);
      alert('Failed to undo team. Please try again.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTournament) return;

    // Basic validation
    if (!formData.first_name.trim() || !formData.last_name.trim() || 
        !formData.city.trim() || !formData.phone_number.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    if (formData.selectedTournaments.length === 0) {
      alert('Please select at least one tournament');
      return;
    }

    try {
      setIsSubmitting(true);
      const { supabase } = await import('../supabaseClient');

      // First, create the player
      const { data: newPlayer, error: playerError } = await supabase
        .from('players')
        .insert([{
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          city: formData.city.trim(),
          phone_number: formData.phone_number.trim(),
        }])
        .select()
        .single();

      if (playerError) {
        console.error('Error creating player:', playerError);
        alert('Failed to create player. Please try again.');
        return;
      }

      // Then, register the player for all selected tournaments
      const registrationPromises = formData.selectedTournaments.map(tournamentId => {
        const isInBostonPot = formData.bostonPotTournaments.includes(tournamentId);
        return supabase
          .from('player_tournament')
          .insert([{
            player_id: newPlayer.id,
            tournament_id: tournamentId,
            paid: false,
            b_paid: false,
            entered_boston_pot: isInBostonPot
          }])
      });

      const registrationResults = await Promise.all(registrationPromises);
      const registrationErrors = registrationResults.filter(result => result.error);

      if (registrationErrors.length > 0) {
        console.error('Error registering player for tournaments:', registrationErrors);
        alert('Player created but failed to register for some tournaments. Please try again.');
        return;
      }

      // Reset form
      setFormData({
        first_name: '',
        last_name: '',
        city: '',
        phone_number: '',
        selectedTournaments: [],
        bostonPotTournaments: [],
      });

      // Refresh the registered players list
      const updatedPlayers = [...registeredPlayers, newPlayer].sort((a, b) => 
        a.first_name.localeCompare(b.first_name)
      );
      setRegisteredPlayers(updatedPlayers);

      const tournamentNames = tournaments
        .filter(t => formData.selectedTournaments.includes(t.id))
        .map(t => t.name)
        .join(', ');

      alert(`Player ${newPlayer.first_name} ${newPlayer.last_name} registered successfully for: ${tournamentNames}`);
    } catch (error) {
      console.error('Error registering player:', error);
      alert('Failed to register player. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemovePlayer = async (playerId: string) => {
    if (!activeTournament) return;

    if (!confirm('Are you sure you want to remove this player from the tournament?')) {
      return;
    }

    try {
      const { supabase } = await import('../supabaseClient');

      // Remove from player_tournament table
      const { error } = await supabase
        .from('player_tournament')
        .delete()
        .eq('player_id', playerId)
        .eq('tournament_id', activeTournament.id);

      if (error) {
        console.error('Error removing player from tournament:', error);
        alert('Failed to remove player. Please try again.');
        return;
      }

      // Update local state
      setRegisteredPlayers(prev => prev.filter(p => p.id !== playerId));
      alert('Player removed from tournament successfully!');
    } catch (error) {
      console.error('Error removing player:', error);
      alert('Failed to remove player. Please try again.');
    }
  };

  if (!activeTournament) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="w-96">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Please select an active tournament to register players.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Player Registration & Team Management</h1>
        <p className="text-muted-foreground">
          Active Tournament: <strong>{activeTournament.name}</strong>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Register New Player */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Register New Player
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddExistingPlayer(true)}
              >
                Add Existing Player
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => handleInputChange('first_name', e.target.value)}
                    placeholder="John"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => handleInputChange('last_name', e.target.value)}
                    placeholder="Doe"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  placeholder="New York"
                  required
                />
              </div>

              <div>
                <Label htmlFor="phone_number">Phone Number *</Label>
                <Input
                  id="phone_number"
                  value={formData.phone_number}
                  onChange={(e) => handleInputChange('phone_number', e.target.value)}
                  placeholder="(555) 123-4567"
                  required
                />
              </div>

              <div>
                <Label>Select Tournaments *</Label>
                <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-3">
                  {tournaments.map((tournament) => (
                    <div key={tournament.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`tournament-${tournament.id}`}
                        checked={formData.selectedTournaments.includes(tournament.id)}
                        onChange={() => handleTournamentToggle(tournament.id)}
                        className="rounded"
                      />
                      <label htmlFor={`tournament-${tournament.id}`} className="flex-1 cursor-pointer">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-sm">{tournament.name}</span>
                          <span className="text-xs text-muted-foreground">${tournament.cost}</span>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
                {formData.selectedTournaments.length > 0 && (
                  <div className="mt-2 p-2 bg-blue-50 rounded-md">
                    <p className="text-sm font-medium">
                      Total Cost: <span className="text-blue-600">${calculateTotalCost()}</span>
                    </p>
                  </div>
                )}
              </div>

              {formData.selectedTournaments.length > 0 && (
                <div>
                  <Label>Boston Pot Selection (95% of players opt in)</Label>
                  <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-3">
                    {tournaments
                      .filter(tournament => formData.selectedTournaments.includes(tournament.id))
                      .map((tournament) => (
                        <div key={tournament.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`boston-${tournament.id}`}
                            checked={formData.bostonPotTournaments.includes(tournament.id)}
                            onChange={() => handleBostonPotToggle(tournament.id)}
                            className="rounded"
                            defaultChecked={true}
                          />
                          <label htmlFor={`boston-${tournament.id}`} className="flex-1 cursor-pointer">
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-sm">{tournament.name}</span>
                              <span className="text-xs text-muted-foreground">${tournament.bostonPotCost || 0}</span>
                            </div>
                          </label>
                        </div>
                      ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Checked = Opt into Boston Pot (default for 95% of players)
                  </p>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Registering...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Register Player
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Column 2: Available Players for Teams */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Available Players ({filteredAvailablePlayers.length})
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search players..."
                value={playerSearchTerm}
                onChange={(e) => setPlayerSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">
                Loading players...
              </p>
            ) : filteredAvailablePlayers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No available players. Register players first.
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredAvailablePlayers.map((player) => {
                  const isSelected = selectedPlayers.find(p => p.id === player.id);
                  return (
                    <div
                      key={player.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-blue-50 border-blue-300' 
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handlePlayerSelect(player)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`font-medium ${isSelected ? 'text-blue-700' : ''}`}>
                            {player.first_name} {player.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {player.city} • {player.phone_number}
                          </p>
                        </div>
                        {isSelected && (
                          <Check className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {selectedPlayers.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium mb-2">
                  Selected Players ({selectedPlayers.length}/2):
                </p>
                <div className="space-y-1">
                  {selectedPlayers.map((player) => (
                    <div key={player.id} className="text-sm">
                      • {player.first_name} {player.last_name}
                    </div>
                  ))}
                </div>
                {selectedPlayers.length === 2 && (
                  <Button
                    onClick={handleCreateTeam}
                    disabled={isSubmitting}
                    className="w-full mt-3"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Creating Team...
                      </>
                    ) : (
                      <>
                        <Users2 className="h-4 w-4 mr-2" />
                        Create Team
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Column 3: Committed Teams */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users2 className="h-5 w-5" />
              Committed Teams ({committedTeams.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {committedTeams.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No teams committed yet. Select players to create teams.
              </p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {committedTeams.map((team) => (
                  <div
                    key={team.id}
                    className="p-3 border rounded-lg bg-green-50 border-green-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-green-800">
                        {team.name}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUndoTeam(team)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Undo2 className="h-3 w-3 mr-1" />
                        Undo
                      </Button>
                    </div>
                    <div className="text-sm text-green-700">
                      <div>• {team.player1?.first_name} {team.player1?.last_name}</div>
                      <div>• {team.player2?.first_name} {team.player2?.last_name}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Existing Player Modal */}
      {showAddExistingPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Add Existing Player to Tournaments</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddExistingPlayer(false);
                  setSelectedExistingPlayer(null);
                  setSearchTerm('');
                  setPlayerExistingTournaments([]);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {!selectedExistingPlayer ? (
              <div className="space-y-4">
                <div>
                  <Label>Search Players</Label>
                  <Input
                    placeholder="Search by name, city, or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredAllPlayers.map((player) => (
                    <div
                      key={player.id}
                      className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        setSelectedExistingPlayer(player);
                        loadPlayerExistingTournaments(player.id);
                        setFormData(prev => ({ ...prev, selectedTournaments: [] }));
                      }}
                    >
                      <div className="font-medium">
                        {player.first_name} {player.last_name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {player.city} • {player.phone_number}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="font-medium">
                    {selectedExistingPlayer.first_name} {selectedExistingPlayer.last_name}
                  </div>
                  <div className="text-sm text-gray-600">
                    {selectedExistingPlayer.city} • {selectedExistingPlayer.phone_number}
                  </div>
                </div>

                <div>
                  <Label>Select Tournaments to Add Player To</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3 mt-2">
                    {tournaments.map((tournament) => {
                      const isAlreadyRegistered = playerExistingTournaments.includes(tournament.id);
                      return (
                        <div key={tournament.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`existing-tournament-${tournament.id}`}
                            checked={formData.selectedTournaments.includes(tournament.id)}
                            onChange={() => handleTournamentToggle(tournament.id)}
                            disabled={isAlreadyRegistered}
                            className="rounded"
                          />
                          <label 
                            htmlFor={`existing-tournament-${tournament.id}`} 
                            className={`flex-1 cursor-pointer ${isAlreadyRegistered ? 'opacity-50' : ''}`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-medium">
                                {tournament.name}
                                {isAlreadyRegistered && (
                                  <Badge variant="secondary" className="ml-2 text-xs">
                                    Already Registered
                                  </Badge>
                                )}
                              </span>
                              <span className="text-sm text-muted-foreground">${tournament.cost}</span>
                            </div>
                            {tournament.description && (
                              <p className="text-xs text-muted-foreground">{tournament.description}</p>
                            )}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                  {formData.selectedTournaments.length > 0 && (
                    <div className="mt-2 p-2 bg-blue-50 rounded-md">
                      <p className="text-sm font-medium">
                        Total Cost: <span className="text-blue-600">${calculateTotalCost()}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Selected: {formData.selectedTournaments.length} tournament(s)
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => handleAddExistingPlayerToTournaments(selectedExistingPlayer, formData.selectedTournaments)}
                    disabled={isSubmitting || formData.selectedTournaments.length === 0}
                    className="flex-1"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add to Tournaments
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedExistingPlayer(null);
                      setPlayerExistingTournaments([]);
                    }}
                    disabled={isSubmitting}
                  >
                    Back to Search
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerRegistration; 