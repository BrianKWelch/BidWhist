import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, Plus, X, Check, ArrowRight, Search, UserPlus, Trash2, Edit } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { Player, Team, Tournament } from '@/contexts/AppContext';
import { toast } from '@/hooks/use-toast';

interface NewPlayerForm {
  first_name: string;
  last_name: string;
  city: string;
  phone_number: string;
}

interface EditPlayerForm extends NewPlayerForm {
  id: string;
}

interface NewTeamForm {
  name: string;
  city: string;
  player1_id: string;
  player2_id: string;
}

interface EditTeamForm extends NewTeamForm {
  id: string;
}

interface NewTournamentForm {
  name: string;
  status: 'pending' | 'active' | 'finished';
}

interface EditTournamentForm extends NewTournamentForm {
  id: string;
}

const TeamBuilder: React.FC = () => {
  const { teams, tournaments, players, createTeamFromPlayers, updateTeam, refreshPlayers, refreshTeams, createTournament, updateTournamentStatus, deleteTournament } = useAppContext();
  
  // Column 1 - Players
  const [selectedPlayerTournament, setSelectedPlayerTournament] = useState<string>('all');
  const [playerSearchTerm, setPlayerSearchTerm] = useState('');
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [showAddPlayerDialog, setShowAddPlayerDialog] = useState(false);
  const [showEditPlayerDialog, setShowEditPlayerDialog] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [newPlayerForm, setNewPlayerForm] = useState<NewPlayerForm>({
    first_name: '',
    last_name: '',
    city: '',
    phone_number: ''
  });

  // Column 2 - Teams
  const [selectedTeamTournament, setSelectedTeamTournament] = useState<string>('all');
  const [teamSearchTerm, setTeamSearchTerm] = useState('');
  const [selectedTeams, setSelectedTeams] = useState<Team[]>([]);
  const [showAddTeamDialog, setShowAddTeamDialog] = useState(false);
  const [showEditTeamDialog, setShowEditTeamDialog] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [newTeamForm, setNewTeamForm] = useState<NewTeamForm>({
    name: '',
    city: '',
    player1_id: '',
    player2_id: ''
  });

  // Column 3 - Tournaments
  const [selectedTournaments, setSelectedTournaments] = useState<string[]>([]);
  const [selectedTournamentFilter, setSelectedTournamentFilter] = useState<string>('all');
  const [tournamentSearchTerm, setTournamentSearchTerm] = useState('');
  const [showAddTournamentDialog, setShowAddTournamentDialog] = useState(false);
  const [showEditTournamentDialog, setShowEditTournamentDialog] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [newTournamentForm, setNewTournamentForm] = useState<NewTournamentForm>({
    name: '',
    status: 'pending'
  });

  // Filter players based on tournament selection and search
  const filteredPlayers = players.filter(player => {
    // Filter by tournament
    if (selectedPlayerTournament === 'all') {
      // Show all players
    } else if (selectedPlayerTournament === 'unassigned') {
      // Show players not in any tournament
      const isInAnyTournament = teams.some(team => 
        (team.player1_id === player.id || team.player2_id === player.id) &&
        team.registeredTournaments && team.registeredTournaments.length > 0
      );
      if (isInAnyTournament) return false;
    } else {
      // Show players in specific tournament
      const isInSelectedTournament = teams.some(team => 
        (team.player1_id === player.id || team.player2_id === player.id) &&
        team.registeredTournaments?.includes(selectedPlayerTournament)
      );
      if (!isInSelectedTournament) return false;
    }

    // Filter by search term
    if (playerSearchTerm) {
      const searchLower = playerSearchTerm.toLowerCase();
      return (
        player.first_name.toLowerCase().includes(searchLower) ||
        player.last_name.toLowerCase().includes(searchLower) ||
        player.city.toLowerCase().includes(searchLower)
      );
    }

    return true;
  });

  // Filter teams based on tournament selection and search
  const filteredTeams = teams.filter(team => {
    // Filter by tournament
    if (selectedTeamTournament === 'all') {
      // Show all teams
    } else if (selectedTeamTournament === 'unassigned') {
      // Show teams not in any tournament
      if (team.registeredTournaments && team.registeredTournaments.length > 0) {
        return false;
      }
    } else {
      // Show teams in specific tournament
      if (!team.registeredTournaments?.includes(selectedTeamTournament)) {
        return false;
      }
    }

    // Filter by search term
    if (teamSearchTerm) {
      const searchLower = teamSearchTerm.toLowerCase();
      return (
        team.name.toLowerCase().includes(searchLower) ||
        team.city.toLowerCase().includes(searchLower)
      );
    }

    return true;
  });

  // Filter tournaments based on selection and search
  const filteredTournaments = tournaments.filter(tournament => {
    // Filter by selection
    if (selectedTournamentFilter === 'all') {
      // Show all tournaments
    } else if (selectedTournamentFilter === 'active') {
      // Show only active tournaments
      if (tournament.status !== 'active') return false;
    } else if (selectedTournamentFilter === 'pending') {
      // Show only pending tournaments
      if (tournament.status !== 'pending') return false;
    } else if (selectedTournamentFilter === 'finished') {
      // Show only finished tournaments
      if (tournament.status !== 'finished') return false;
    } else {
      // Show tournaments for specific team
      const team = teams.find(t => t.id === selectedTournamentFilter);
      if (!team || !team.registeredTournaments?.includes(tournament.id)) {
        return false;
      }
    }

    // Filter by search term
    if (tournamentSearchTerm) {
      const searchLower = tournamentSearchTerm.toLowerCase();
      return tournament.name.toLowerCase().includes(searchLower);
    }

    return true;
  });

  // Get player names for display
  const getPlayerDisplayName = (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    return player ? `${player.first_name} ${player.last_name}` : 'Unknown Player';
  };

  // Handle player selection for team creation
  const handlePlayerSelect = (player: Player) => {
    if (selectedPlayers.find(p => p.id === player.id)) {
      setSelectedPlayers(selectedPlayers.filter(p => p.id !== player.id));
    } else if (selectedPlayers.length < 2) {
      setSelectedPlayers([...selectedPlayers, player]);
    } else {
      toast({
        title: 'Maximum players selected',
        description: 'You can only select 2 players to create a team.',
        variant: 'destructive'
      });
    }
  };

  // Create team from selected players
  const handleCreateTeam = async () => {
    if (selectedPlayers.length !== 2) {
      toast({
        title: 'Invalid selection',
        description: 'Please select exactly 2 players to create a team.',
        variant: 'destructive'
      });
      return;
    }

    const player1 = selectedPlayers[0];
    const player2 = selectedPlayers[1];

    // Check if a team with these two players already exists
    const existingTeam = teams.find(team => 
      (team.player1_id === player1.id && team.player2_id === player2.id) ||
      (team.player1_id === player2.id && team.player2_id === player1.id)
    );

    if (existingTeam) {
      toast({
        title: 'Team already exists',
        description: `A team with ${player1.first_name} ${player1.last_name} and ${player2.first_name} ${player2.last_name} already exists.`,
        variant: 'destructive'
      });
      return;
    }

    try {
      const teamName = `${player1.first_name}/${player2.first_name}`;
      
      await createTeamFromPlayers(player1, player2, teamName);
      
      setSelectedPlayers([]);
      
      // Refresh teams list
      await refreshTeams();
      
      toast({
        title: 'Team created successfully',
        description: `Team "${teamName}" has been created.`,
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error creating team',
        description: 'Failed to create team. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Add team to selected tournaments
  const handleAddTeamToTournaments = async () => {
    if (selectedTeams.length === 0) {
      toast({
        title: 'No teams selected',
        description: 'Please select at least one team.',
        variant: 'destructive'
      });
      return;
    }

    if (selectedTournaments.length === 0) {
      toast({
        title: 'No tournaments selected',
        description: 'Please select at least one tournament.',
        variant: 'destructive'
      });
      return;
    }

    // Check for teams already registered in selected tournaments
    const teamsAlreadyRegistered: { team: Team; tournaments: string[] }[] = [];
    
    for (const team of selectedTeams) {
      const alreadyRegistered = selectedTournaments.filter(t => 
        team.registeredTournaments?.includes(t)
      );
      
      if (alreadyRegistered.length > 0) {
        teamsAlreadyRegistered.push({ team, tournaments: alreadyRegistered });
      }
    }

    if (teamsAlreadyRegistered.length > 0) {
      const teamNames = teamsAlreadyRegistered.map(({ team, tournaments }) => 
        `${team.name} (${tournaments.join(', ')})`
      ).join(', ');
      
      toast({
        title: 'Teams already registered',
        description: `The following teams are already registered for some selected tournaments: ${teamNames}`,
        variant: 'destructive'
      });
      return;
    }

    try {
      for (const team of selectedTeams) {
        const updatedRegisteredTournaments = [
          ...(team.registeredTournaments || []),
          ...selectedTournaments
        ];
        
        await updateTeam({
          ...team,
          registeredTournaments: updatedRegisteredTournaments
        });
      }

      setSelectedTeams([]);
      setSelectedTournaments([]);
      
      // Refresh teams list
      await refreshTeams();
      
      toast({
        title: 'Teams added to tournaments',
        description: `${selectedTeams.length} team(s) added to ${selectedTournaments.length} tournament(s).`,
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error adding teams',
        description: 'Failed to add teams to tournaments. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Remove team from tournament
  const handleRemoveTeamFromTournament = async (team: Team, tournamentId: string) => {
    try {
      const updatedRegisteredTournaments = team.registeredTournaments?.filter(t => t !== tournamentId) || [];
      
      await updateTeam({
        ...team,
        registeredTournaments: updatedRegisteredTournaments
      });

      // Refresh teams list
      await refreshTeams();

      toast({
        title: 'Team removed',
        description: `Team "${team.name}" removed from tournament.`,
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error removing team',
        description: 'Failed to remove team from tournament. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Add new player
  const handleAddPlayer = async () => {
    if (!newPlayerForm.first_name || !newPlayerForm.last_name || !newPlayerForm.city) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { supabase } = await import('../supabaseClient');
      
      const { data, error } = await supabase
        .from('players')
        .insert([{
          first_name: newPlayerForm.first_name,
          last_name: newPlayerForm.last_name,
          city: newPlayerForm.city,
          phone_number: newPlayerForm.phone_number || null
        }])
        .select()
        .single();

      if (error) throw error;

      setNewPlayerForm({
        first_name: '',
        last_name: '',
        city: '',
        phone_number: ''
      });
      setShowAddPlayerDialog(false);

      // Refresh players list
      await refreshPlayers();

      toast({
        title: 'Player added successfully',
        description: `${newPlayerForm.first_name} ${newPlayerForm.last_name} has been added.`,
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error adding player',
        description: 'Failed to add player. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Edit player
  const handleEditPlayer = async () => {
    if (!editingPlayer || !editingPlayer.first_name || !editingPlayer.last_name || !editingPlayer.city) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { supabase } = await import('../supabaseClient');
      
      const { error } = await supabase
        .from('players')
        .update({
          first_name: editingPlayer.first_name,
          last_name: editingPlayer.last_name,
          city: editingPlayer.city,
          phone_number: editingPlayer.phone_number || null
        })
        .eq('id', editingPlayer.id);

      if (error) throw error;

      setEditingPlayer(null);
      setShowEditPlayerDialog(false);

      // Refresh players list
      await refreshPlayers();

      toast({
        title: 'Player updated successfully',
        description: `${editingPlayer.first_name} ${editingPlayer.last_name} has been updated.`,
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error updating player',
        description: 'Failed to update player. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Delete player
  const handleDeletePlayer = async (playerId: string) => {
    try {
      const { supabase } = await import('../supabaseClient');
      
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', playerId);

      if (error) throw error;

      // Refresh players list
      await refreshPlayers();

      toast({
        title: 'Player deleted successfully',
        description: 'Player has been removed.',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error deleting player',
        description: 'Failed to delete player. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Add new team
  const handleAddTeam = async () => {
    if (!newTeamForm.name || !newTeamForm.city || !newTeamForm.player1_id || !newTeamForm.player2_id) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields.',
        variant: 'destructive'
      });
      return;
    }

    if (newTeamForm.player1_id === newTeamForm.player2_id) {
      toast({
        title: 'Invalid selection',
        description: 'Please select two different players.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { supabase } = await import('../supabaseClient');
      
      const { data, error } = await supabase
        .from('teams')
        .insert([{
          name: newTeamForm.name,
          city: newTeamForm.city,
          player1_id: newTeamForm.player1_id,
          player2_id: newTeamForm.player2_id,
          registeredTournaments: []
        }])
        .select()
        .single();

      if (error) throw error;

      setNewTeamForm({
        name: '',
        city: '',
        player1_id: '',
        player2_id: ''
      });
      setShowAddTeamDialog(false);

      // Refresh teams list
      await refreshTeams();

      toast({
        title: 'Team added successfully',
        description: `Team "${newTeamForm.name}" has been created.`,
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error adding team',
        description: 'Failed to add team. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Edit team
  const handleEditTeam = async () => {
    if (!editingTeam || !editingTeam.name || !editingTeam.city || !editingTeam.player1_id || !editingTeam.player2_id) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields.',
        variant: 'destructive'
      });
      return;
    }

    if (editingTeam.player1_id === editingTeam.player2_id) {
      toast({
        title: 'Invalid selection',
        description: 'Please select two different players.',
        variant: 'destructive'
      });
      return;
    }

    try {
      await updateTeam(editingTeam);

      setEditingTeam(null);
      setShowEditTeamDialog(false);

      // Refresh teams list
      await refreshTeams();

      toast({
        title: 'Team updated successfully',
        description: `Team "${editingTeam.name}" has been updated.`,
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error updating team',
        description: 'Failed to update team. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Delete team
  const handleDeleteTeam = async (teamId: string) => {
    try {
      const { supabase } = await import('../supabaseClient');
      
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (error) throw error;

      // Refresh teams list
      await refreshTeams();

      toast({
        title: 'Team deleted successfully',
        description: 'Team has been removed.',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error deleting team',
        description: 'Failed to delete team. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Add new tournament
  const handleAddTournament = async () => {
    if (!newTournamentForm.name) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields.',
        variant: 'destructive'
      });
      return;
    }

    try {
      await createTournament(newTournamentForm.name, newTournamentForm.status);

      setNewTournamentForm({
        name: '',
        status: 'pending'
      });
      setShowAddTournamentDialog(false);

      toast({
        title: 'Tournament added successfully',
        description: `Tournament "${newTournamentForm.name}" has been created.`,
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error adding tournament',
        description: 'Failed to add tournament. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Edit tournament
  const handleEditTournament = async () => {
    if (!editingTournament || !editingTournament.name) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields.',
        variant: 'destructive'
      });
      return;
    }

    try {
      await updateTournamentStatus(editingTournament);

      setEditingTournament(null);
      setShowEditTournamentDialog(false);

      toast({
        title: 'Tournament updated successfully',
        description: `Tournament "${editingTournament.name}" has been updated.`,
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error updating tournament',
        description: 'Failed to update tournament. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Delete tournament
  const handleDeleteTournament = async (tournamentId: string) => {
    try {
      await deleteTournament(tournamentId);

      toast({
        title: 'Tournament deleted successfully',
        description: 'Tournament has been removed.',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Error deleting tournament',
        description: 'Failed to delete tournament. Please try again.',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Builder
            </CardTitle>
            <Dialog open={showAddPlayerDialog} onOpenChange={setShowAddPlayerDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add New Player
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Player</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input
                      id="first_name"
                      value={newPlayerForm.first_name}
                      onChange={(e) => setNewPlayerForm({...newPlayerForm, first_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="last_name">Last Name *</Label>
                    <Input
                      id="last_name"
                      value={newPlayerForm.last_name}
                      onChange={(e) => setNewPlayerForm({...newPlayerForm, last_name: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      value={newPlayerForm.city}
                      onChange={(e) => setNewPlayerForm({...newPlayerForm, city: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone_number">Phone Number</Label>
                    <Input
                      id="phone_number"
                      value={newPlayerForm.phone_number}
                      onChange={(e) => setNewPlayerForm({...newPlayerForm, phone_number: e.target.value})}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleAddPlayer} className="flex-1">
                      Add Player
                    </Button>
                    <Button variant="outline" onClick={() => setShowAddPlayerDialog(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1 - Players */}
            <Card className="border-2 border-red-500">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-center">Players</CardTitle>
                  <div className="flex gap-1">
                    <Dialog open={showAddPlayerDialog} onOpenChange={setShowAddPlayerDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add New Player</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="first_name">First Name *</Label>
                            <Input
                              id="first_name"
                              value={newPlayerForm.first_name}
                              onChange={(e) => setNewPlayerForm({...newPlayerForm, first_name: e.target.value})}
                            />
                          </div>
                          <div>
                            <Label htmlFor="last_name">Last Name *</Label>
                            <Input
                              id="last_name"
                              value={newPlayerForm.last_name}
                              onChange={(e) => setNewPlayerForm({...newPlayerForm, last_name: e.target.value})}
                            />
                          </div>
                          <div>
                            <Label htmlFor="city">City *</Label>
                            <Input
                              id="city"
                              value={newPlayerForm.city}
                              onChange={(e) => setNewPlayerForm({...newPlayerForm, city: e.target.value})}
                            />
                          </div>
                          <div>
                            <Label htmlFor="phone_number">Phone Number</Label>
                            <Input
                              id="phone_number"
                              value={newPlayerForm.phone_number}
                              onChange={(e) => setNewPlayerForm({...newPlayerForm, phone_number: e.target.value})}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={handleAddPlayer} className="flex-1">
                              Add Player
                            </Button>
                            <Button variant="outline" onClick={() => setShowAddPlayerDialog(false)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                <div className="space-y-2">
                  <Select value={selectedPlayerTournament} onValueChange={setSelectedPlayerTournament}>
                    <SelectTrigger className="border-2 border-black">
                      <SelectValue placeholder="Filter by tournament" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Players</SelectItem>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {tournaments.map(tournament => (
                        <SelectItem key={tournament.id} value={tournament.id}>
                          {tournament.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search players..."
                      value={playerSearchTerm}
                      onChange={(e) => setPlayerSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  {filteredPlayers.length} player(s) found
                </div>
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {filteredPlayers.map(player => (
                    <div
                      key={player.id}
                      className={`p-2 rounded border cursor-pointer transition-colors ${
                        selectedPlayers.find(p => p.id === player.id)
                          ? 'bg-blue-50 border-blue-200'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handlePlayerSelect(player)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{player.first_name} {player.last_name}</div>
                          <div className="text-sm text-muted-foreground">{player.city}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingPlayer(player);
                              setShowEditPlayerDialog(true);
                            }}
                            className="h-6 w-6 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePlayer(player.id);
                            }}
                            className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          {selectedPlayers.find(p => p.id === player.id) && (
                            <Check className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {selectedPlayers.length > 0 && (
                  <Button onClick={handleCreateTeam} className="w-full" disabled={selectedPlayers.length !== 2}>
                    Create Team ({selectedPlayers.length}/2)
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Column 2 - Teams */}
            <Card className="border-2 border-red-500">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-center">Teams</CardTitle>
                  <div className="flex gap-1">
                    <Dialog open={showAddTeamDialog} onOpenChange={setShowAddTeamDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add New Team</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="team_name">Team Name *</Label>
                            <Input
                              id="team_name"
                              value={newTeamForm.name}
                              onChange={(e) => setNewTeamForm({...newTeamForm, name: e.target.value})}
                            />
                          </div>
                          <div>
                            <Label htmlFor="team_city">City *</Label>
                            <Input
                              id="team_city"
                              value={newTeamForm.city}
                              onChange={(e) => setNewTeamForm({...newTeamForm, city: e.target.value})}
                            />
                          </div>
                          <div>
                            <Label htmlFor="player1">Player 1 *</Label>
                            <Select value={newTeamForm.player1_id} onValueChange={(value) => setNewTeamForm({...newTeamForm, player1_id: value})}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select player 1" />
                              </SelectTrigger>
                              <SelectContent>
                                {players.map(player => (
                                  <SelectItem key={player.id} value={player.id}>
                                    {player.first_name} {player.last_name} ({player.city})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="player2">Player 2 *</Label>
                            <Select value={newTeamForm.player2_id} onValueChange={(value) => setNewTeamForm({...newTeamForm, player2_id: value})}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select player 2" />
                              </SelectTrigger>
                              <SelectContent>
                                {players.map(player => (
                                  <SelectItem key={player.id} value={player.id}>
                                    {player.first_name} {player.last_name} ({player.city})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={handleAddTeam} className="flex-1">
                              Add Team
                            </Button>
                            <Button variant="outline" onClick={() => setShowAddTeamDialog(false)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                <div className="space-y-2">
                  <Select value={selectedTeamTournament} onValueChange={setSelectedTeamTournament}>
                    <SelectTrigger className="border-2 border-black">
                      <SelectValue placeholder="Filter by tournament" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Teams</SelectItem>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {tournaments.map(tournament => (
                        <SelectItem key={tournament.id} value={tournament.id}>
                          {tournament.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search teams..."
                      value={teamSearchTerm}
                      onChange={(e) => setTeamSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  {filteredTeams.length} team(s) found
                </div>
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {filteredTeams.map(team => (
                    <div
                      key={team.id}
                      className={`p-2 rounded border cursor-pointer transition-colors ${
                        selectedTeams.find(t => t.id === team.id)
                          ? 'bg-blue-50 border-blue-200'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => {
                        if (selectedTeams.find(t => t.id === team.id)) {
                          setSelectedTeams(selectedTeams.filter(t => t.id !== team.id));
                        } else {
                          setSelectedTeams([...selectedTeams, team]);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{team.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {getPlayerDisplayName(team.player1_id)} & {getPlayerDisplayName(team.player2_id)}
                          </div>
                          <div className="text-xs text-muted-foreground">{team.city}</div>
                          {team.registeredTournaments && team.registeredTournaments.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {team.registeredTournaments.map(tournamentId => {
                                const tournament = tournaments.find(t => t.id === tournamentId);
                                return (
                                  <Badge key={tournamentId} variant="secondary" className="text-xs">
                                    {tournament?.name || tournamentId}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveTeamFromTournament(team, tournamentId);
                                      }}
                                      className="ml-1 hover:text-red-600"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTeam(team);
                              setShowEditTeamDialog(true);
                            }}
                            className="h-6 w-6 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTeam(team.id);
                            }}
                            className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          {selectedTeams.find(t => t.id === team.id) && (
                            <Check className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Column 3 - Tournaments */}
            <Card className="border-2 border-red-500">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-center">Tournaments</CardTitle>
                  <div className="flex gap-1">
                    <Dialog open={showAddTournamentDialog} onOpenChange={setShowAddTournamentDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add New Tournament</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="tournament_name">Tournament Name *</Label>
                            <Input
                              id="tournament_name"
                              value={newTournamentForm.name}
                              onChange={(e) => setNewTournamentForm({...newTournamentForm, name: e.target.value})}
                            />
                          </div>
                          <div>
                            <Label htmlFor="tournament_status">Status *</Label>
                            <Select value={newTournamentForm.status} onValueChange={(value: 'pending' | 'active' | 'finished') => setNewTournamentForm({...newTournamentForm, status: value})}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="finished">Finished</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={handleAddTournament} className="flex-1">
                              Add Tournament
                            </Button>
                            <Button variant="outline" onClick={() => setShowAddTournamentDialog(false)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                <div className="space-y-2">
                  <Select value={selectedTournamentFilter} onValueChange={setSelectedTournamentFilter}>
                    <SelectTrigger className="border-2 border-black">
                      <SelectValue placeholder="Filter tournaments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tournaments</SelectItem>
                      <SelectItem value="active">Active Only</SelectItem>
                      <SelectItem value="pending">Pending Only</SelectItem>
                      <SelectItem value="finished">Finished Only</SelectItem>
                      <SelectItem value="divider" disabled>──────────</SelectItem>
                      {teams.map(team => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name} - Tournaments
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search tournaments..."
                      value={tournamentSearchTerm}
                      onChange={(e) => setTournamentSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  {filteredTournaments.length} tournament(s) found
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {filteredTournaments.map(tournament => (
                    <div key={tournament.id} className="flex items-center space-x-3 p-2 rounded border hover:bg-gray-50 transition-colors">
                      <Checkbox
                        id={tournament.id}
                        checked={selectedTournaments.includes(tournament.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedTournaments([...selectedTournaments, tournament.id]);
                          } else {
                            setSelectedTournaments(selectedTournaments.filter(t => t !== tournament.id));
                          }
                        }}
                      />
                      <Label 
                        htmlFor={tournament.id} 
                        className={`flex-1 cursor-pointer font-medium ${
                          tournament.status === 'active' ? 'text-red-600' : ''
                        }`}
                      >
                        {tournament.name}
                      </Label>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTournament(tournament);
                          setShowEditTournamentDialog(true);
                        }}
                        className="h-6 w-6 p-0"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTournament(tournament.id);
                        }}
                        className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                {selectedTeams.length > 0 && selectedTournaments.length > 0 && (
                  <Button onClick={handleAddTeamToTournaments} className="w-full">
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Add {selectedTeams.length} Team(s) to {selectedTournaments.length} Tournament(s)
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Edit Player Dialog */}
      <Dialog open={showEditPlayerDialog && editingPlayer !== null} onOpenChange={setShowEditPlayerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Player</DialogTitle>
          </DialogHeader>
          {editingPlayer && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit_first_name">First Name *</Label>
                <Input
                  id="edit_first_name"
                  value={editingPlayer.first_name}
                  onChange={(e) => setEditingPlayer({...editingPlayer, first_name: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="edit_last_name">Last Name *</Label>
                <Input
                  id="edit_last_name"
                  value={editingPlayer.last_name}
                  onChange={(e) => setEditingPlayer({...editingPlayer, last_name: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="edit_city">City *</Label>
                <Input
                  id="edit_city"
                  value={editingPlayer.city}
                  onChange={(e) => setEditingPlayer({...editingPlayer, city: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="edit_phone_number">Phone Number</Label>
                <Input
                  id="edit_phone_number"
                  value={editingPlayer.phone_number || ''}
                  onChange={(e) => setEditingPlayer({...editingPlayer, phone_number: e.target.value})}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleEditPlayer} className="flex-1">
                  Update Player
                </Button>
                <Button variant="outline" onClick={() => setShowEditPlayerDialog(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Team Dialog */}
      <Dialog open={showEditTeamDialog && editingTeam !== null} onOpenChange={setShowEditTeamDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
          </DialogHeader>
          {editingTeam && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit_team_name">Team Name *</Label>
                <Input
                  id="edit_team_name"
                  value={editingTeam.name}
                  onChange={(e) => setEditingTeam({...editingTeam, name: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="edit_team_city">City *</Label>
                <Input
                  id="edit_team_city"
                  value={editingTeam.city}
                  onChange={(e) => setEditingTeam({...editingTeam, city: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="edit_player1">Player 1 *</Label>
                <Select value={editingTeam.player1_id} onValueChange={(value) => setEditingTeam({...editingTeam, player1_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select player 1" />
                  </SelectTrigger>
                  <SelectContent>
                    {players.map(player => (
                      <SelectItem key={player.id} value={player.id}>
                        {player.first_name} {player.last_name} ({player.city})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit_player2">Player 2 *</Label>
                <Select value={editingTeam.player2_id} onValueChange={(value) => setEditingTeam({...editingTeam, player2_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select player 2" />
                  </SelectTrigger>
                  <SelectContent>
                    {players.map(player => (
                      <SelectItem key={player.id} value={player.id}>
                        {player.first_name} {player.last_name} ({player.city})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleEditTeam} className="flex-1">
                  Update Team
                </Button>
                <Button variant="outline" onClick={() => setShowEditTeamDialog(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Tournament Dialog */}
      <Dialog open={showEditTournamentDialog && editingTournament !== null} onOpenChange={setShowEditTournamentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tournament</DialogTitle>
          </DialogHeader>
          {editingTournament && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit_tournament_name">Tournament Name *</Label>
                <Input
                  id="edit_tournament_name"
                  value={editingTournament.name}
                  onChange={(e) => setEditingTournament({...editingTournament, name: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="edit_tournament_status">Status *</Label>
                <Select value={editingTournament.status} onValueChange={(value: 'pending' | 'active' | 'finished') => setEditingTournament({...editingTournament, status: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="finished">Finished</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleEditTournament} className="flex-1">
                  Update Tournament
                </Button>
                <Button variant="outline" onClick={() => setShowEditTournamentDialog(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamBuilder; 