import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, Plus, X, Check, ArrowRight, Search, UserPlus, Trash2, Edit, Upload, Download } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { Player, Team, Tournament } from '@/contexts/AppContext';
import { toast } from '@/hooks/use-toast';

interface NewPlayerForm {
  first_name: string;
  last_name: string;
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

interface CSVRow {
  player1_first_name: string;
  player1_last_name: string;
  player1_phone: string;
  player2_first_name: string;
  player2_last_name: string;
  player2_phone: string;
  team_name: string;
  team_city: string;
  team_phone: string;
  tournament_name: string;
}

// New interfaces for multi-step CSV upload
interface PlayerUploadResult {
  success: Player[];
  alreadyExists: Player[];
  failed: Array<{ player: { first_name: string; last_name: string; phone_number: string }; reason: string }>;
}

interface TeamUploadResult {
  success: Team[];
  alreadyExists: Team[];
  failed: Array<{ team: { name: string; player1: string; player2: string }; reason: string }>;
}

interface TournamentAssignmentResult {
  success: Array<{ team: Team; tournament: Tournament }>;
  failed: Array<{ team: string; tournament: string; reason: string }>;
}

interface CSVUploadStep {
  step: 'players' | 'teams' | 'tournaments';
  completed: boolean;
  result?: PlayerUploadResult | TeamUploadResult | TournamentAssignmentResult;
}

const TeamBuilder: React.FC = () => {
  const { teams, tournaments, players, createTeamFromPlayers, updateTeam, refreshPlayers, refreshTeams, createTournament, updateTournamentStatus, deleteTournament, addPlayer, addTeamToTournament, refreshTournaments, addTeam } = useAppContext();
  
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

  // CSV Import
  const [showCSVImportDialog, setShowCSVImportDialog] = useState(false);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [csvProcessing, setCsvProcessing] = useState(false);
  const [csvPreview, setCsvPreview] = useState<CSVRow[]>([]);

  // Multi-step CSV upload state
  const [csvUploadStep, setCsvUploadStep] = useState<'players' | 'teams' | 'tournaments' | null>(null);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  const [currentStepResult, setCurrentStepResult] = useState<PlayerUploadResult | TeamUploadResult | TournamentAssignmentResult | null>(null);
  const [processedPlayers, setProcessedPlayers] = useState<Player[]>([]);
  const [processedTeams, setProcessedTeams] = useState<Team[]>([]);

  // Confirmation dialog state
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteConfirmationType, setDeleteConfirmationType] = useState<'player' | 'team' | 'tournament' | null>(null);
  const [deleteConfirmationItem, setDeleteConfirmationItem] = useState<Player | Team | Tournament | null>(null);

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
        player.last_name.toLowerCase().includes(searchLower)
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
    if (!newPlayerForm.first_name || !newPlayerForm.last_name) {
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
          phone_number: newPlayerForm.phone_number || null
        }])
        .select()
        .single();

      if (error) throw error;

      setNewPlayerForm({
        first_name: '',
        last_name: '',
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
    if (!editingPlayer || !editingPlayer.first_name || !editingPlayer.last_name) {
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

  // Confirmation handlers for delete actions
  const handleDeletePlayerConfirmation = (player: Player) => {
    setDeleteConfirmationType('player');
    setDeleteConfirmationItem(player);
    setShowDeleteConfirmation(true);
  };

  const handleDeleteTeamConfirmation = (team: Team) => {
    setDeleteConfirmationType('team');
    setDeleteConfirmationItem(team);
    setShowDeleteConfirmation(true);
  };

  const handleDeleteTournamentConfirmation = (tournament: Tournament) => {
    setDeleteConfirmationType('tournament');
    setDeleteConfirmationItem(tournament);
    setShowDeleteConfirmation(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmationItem || !deleteConfirmationType) return;

    try {
      switch (deleteConfirmationType) {
        case 'player':
          await handleDeletePlayer(deleteConfirmationItem.id);
          break;
        case 'team':
          await handleDeleteTeam(deleteConfirmationItem.id);
          break;
        case 'tournament':
          await handleDeleteTournament(deleteConfirmationItem.id);
          break;
      }
    } catch (error) {
      // Error handling is already done in the individual delete functions
    } finally {
      setShowDeleteConfirmation(false);
      setDeleteConfirmationType(null);
      setDeleteConfirmationItem(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirmation(false);
    setDeleteConfirmationType(null);
    setDeleteConfirmationItem(null);
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

  // CSV Import handlers
  const handleCSVFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = text.split('\n').filter(row => row.trim());
      const headers = rows[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
      
      const parsedData: CSVRow[] = [];
      for (let i = 1; i < rows.length; i++) {
        const values = rows[i].split(',').map(v => v.trim());
        if (values.length >= headers.length) {
          const row: any = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          parsedData.push(row as CSVRow);
        }
      }
      
      setCsvData(parsedData);
      setCsvPreview(parsedData.slice(0, 5)); // Show first 5 rows as preview
    };
    reader.readAsText(file);
  };

  // Step 1: Process Players
  const processPlayersStep = async (): Promise<PlayerUploadResult> => {
    const result: PlayerUploadResult = {
      success: [],
      alreadyExists: [],
      failed: []
    };

    // Get unique players from CSV data
    const uniquePlayers = new Map<string, { first_name: string; last_name: string; phone_number: string }>();
    
    for (const row of csvData) {
      // Add player 1
      const player1Key = `${row.player1_first_name}-${row.player1_last_name}-${row.player1_phone}`;
      uniquePlayers.set(player1Key, {
        first_name: row.player1_first_name,
        last_name: row.player1_last_name,
        phone_number: row.player1_phone
      });

      // Add player 2
      const player2Key = `${row.player2_first_name}-${row.player2_last_name}-${row.player2_phone}`;
      uniquePlayers.set(player2Key, {
        first_name: row.player2_first_name,
        last_name: row.player2_last_name,
        phone_number: row.player2_phone
      });
    }

    for (const [key, playerData] of uniquePlayers) {
      try {
        // Check if player already exists
        const existingPlayer = players.find(p => 
          p.phone_number === playerData.phone_number ||
          (p.first_name.toLowerCase() === playerData.first_name.toLowerCase() && 
           p.last_name.toLowerCase() === playerData.last_name.toLowerCase())
        );

        if (existingPlayer) {
          result.alreadyExists.push(existingPlayer);
          continue;
        }

        // Try to create new player
        await addPlayer(playerData);
        result.success.push({
          id: '', // Will be populated after refresh
          first_name: playerData.first_name,
          last_name: playerData.last_name,
          phone_number: playerData.phone_number,
          city: '',
          created_at: new Date().toISOString()
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.failed.push({
          player: playerData,
          reason: errorMessage
        });
      }
    }

    // Refresh players to get the actual IDs
    if (result.success.length > 0) {
      try {
        await refreshPlayers();
        // Update the success array with actual player objects
        const refreshedPlayers = await import('../supabaseClient').then(async ({ supabase }) => {
          const { data } = await supabase.from('players').select('*');
          return data || [];
        });
        
        result.success = result.success.map(successPlayer => {
          const actualPlayer = refreshedPlayers.find(p => 
            p.phone_number === successPlayer.phone_number &&
            p.first_name === successPlayer.first_name &&
            p.last_name === successPlayer.last_name
          );
          return actualPlayer || successPlayer;
        });
      } catch (error) {
        console.error('Failed to refresh players:', error);
      }
    }

    return result;
  };

  // Step 2: Process Teams
  const processTeamsStep = async (): Promise<TeamUploadResult> => {
    const result: TeamUploadResult = {
      success: [],
      alreadyExists: [],
      failed: []
    };

    // Refresh players to ensure we have the latest data
    await refreshPlayers();

    for (const row of csvData) {
      try {
        // Find the players for this team
        const player1 = players.find(p => 
          p.phone_number === row.player1_phone ||
          (p.first_name.toLowerCase() === row.player1_first_name.toLowerCase() && 
           p.last_name.toLowerCase() === row.player1_last_name.toLowerCase())
        );

        const player2 = players.find(p => 
          p.phone_number === row.player2_phone ||
          (p.first_name.toLowerCase() === row.player2_first_name.toLowerCase() && 
           p.last_name.toLowerCase() === row.player2_last_name.toLowerCase())
        );

        if (!player1 || !player2) {
          result.failed.push({
            team: { name: row.team_name, player1: row.player1_first_name, player2: row.player2_first_name },
            reason: `Players not found: ${!player1 ? row.player1_first_name : ''} ${!player2 ? row.player2_first_name : ''}`
          });
          continue;
        }

        // Check if team already exists
        const existingTeam = teams.find(t => t.name.toLowerCase() === row.team_name.toLowerCase());
        if (existingTeam) {
          result.alreadyExists.push(existingTeam);
          continue;
        }

        // Create team
        const { supabase } = await import('../supabaseClient');
        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .insert([{
            name: row.team_name,
            player1_id: player1.id,
            player2_id: player2.id
          }])
          .select()
          .single();

        if (teamError) {
          result.failed.push({
            team: { name: row.team_name, player1: row.player1_first_name, player2: row.player2_first_name },
            reason: teamError.message
          });
          continue;
        }

        // Construct team object
        const newTeam: Team = {
          id: String(teamData.id),
          name: teamData.name,
          player1_id: teamData.player1_id,
          player2_id: teamData.player2_id,
          created_at: teamData.created_at,
          player1: player1,
          player2: player2,
          player1FirstName: player1.first_name,
          player1LastName: player1.last_name,
          player2FirstName: player2.first_name,
          player2LastName: player2.last_name,
          phoneNumber: player1.phone_number || player2.phone_number,
          player1_phone: player1.phone_number,
          player2_phone: player2.phone_number,
          city: player1.city || player2.city,
          registeredTournaments: []
        };

        result.success.push(newTeam);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.failed.push({
          team: { name: row.team_name, player1: row.player1_first_name, player2: row.player2_first_name },
          reason: errorMessage
        });
      }
    }

    return result;
  };

  // Step 3: Assign Teams to Tournaments
  const processTournamentsStep = async (): Promise<TournamentAssignmentResult> => {
    const result: TournamentAssignmentResult = {
      success: [],
      failed: []
    };

    // Refresh teams and tournaments to ensure we have the latest data
    await refreshTeams();
    await refreshTournaments();

    for (const row of csvData) {
      try {
        // Find the team
        const team = teams.find(t => t.name.toLowerCase() === row.team_name.toLowerCase());
        if (!team) {
          result.failed.push({
            team: row.team_name,
            tournament: row.tournament_name,
            reason: 'Team not found'
          });
          continue;
        }

        // Find or create tournament
        let tournament = tournaments.find(t => t.name.toLowerCase() === row.tournament_name.toLowerCase());
        if (!tournament) {
          try {
            await createTournament(row.tournament_name, 'pending');
            await refreshTournaments();
            tournament = tournaments.find(t => t.name.toLowerCase() === row.tournament_name.toLowerCase());
          } catch (error) {
            result.failed.push({
              team: row.team_name,
              tournament: row.tournament_name,
              reason: `Failed to create tournament: ${error instanceof Error ? error.message : String(error)}`
            });
            continue;
          }
        }

        if (!tournament) {
          result.failed.push({
            team: row.team_name,
            tournament: row.tournament_name,
            reason: 'Tournament not found after creation'
          });
          continue;
        }

        // Check if team is already in tournament
        const isAlreadyRegistered = team.registeredTournaments?.includes(tournament.id);
        if (isAlreadyRegistered) {
          if (team && tournament) {
            result.success.push({ team, tournament });
          }
          continue;
        }

        // Add team to tournament
        try {
          await addTeamToTournament(team.id, tournament.id);
          
          // Also assign players to tournament (player_tournament table)
          try {
            const { supabase } = await import('../supabaseClient');
            
            // Check if players are already assigned to this tournament
            const { data: existingPlayerTournaments } = await supabase
              .from('player_tournament')
              .select('*')
              .eq('tournament_id', tournament.id)
              .in('player_id', [team.player1_id, team.player2_id]);
            
            const existingPlayerIds = existingPlayerTournaments?.map(pt => pt.player_id) || [];
            const playersToAssign = [team.player1_id, team.player2_id].filter(id => !existingPlayerIds.includes(id));
            
            if (playersToAssign.length > 0) {
              const playerTournamentEntries = playersToAssign.map(playerId => ({
                player_id: playerId,
                tournament_id: tournament.id,
                created_at: new Date().toISOString()
              }));
              
              const { error: playerTournamentError } = await supabase
                .from('player_tournament')
                .insert(playerTournamentEntries);
              
              if (playerTournamentError) {
                console.warn(`Failed to assign players to tournament: ${playerTournamentError.message}`);
              }
            }
          } catch (playerError) {
            console.warn(`Error assigning players to tournament: ${playerError}`);
          }
          
          if (team && tournament) {
            result.success.push({ team, tournament });
          }
        } catch (error) {
          result.failed.push({
            team: row.team_name,
            tournament: row.tournament_name,
            reason: `Failed to add team to tournament: ${error instanceof Error ? error.message : String(error)}`
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.failed.push({
          team: row.team_name,
          tournament: row.tournament_name,
          reason: errorMessage
        });
      }
    }

    return result;
  };

  // Start the multi-step CSV upload process
  const startCSVUpload = async () => {
    if (csvData.length === 0) {
      toast({ title: 'Error', description: 'No CSV data to process', variant: 'destructive' });
      return;
    }

    setCsvProcessing(true);
    setCsvUploadStep('players');

    try {
      // Step 1: Process Players
      const playerResult = await processPlayersStep();
      setCurrentStepResult(playerResult);
      setShowResultsDialog(true);
      setProcessedPlayers([...playerResult.success, ...playerResult.alreadyExists]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({ 
        title: 'Player Upload Failed', 
        description: `Unexpected error during player processing: ${errorMessage}`, 
        variant: 'destructive' 
      });
      setCsvProcessing(false);
      setCsvUploadStep(null);
    }
  };

  // Handle user response to step results
  const handleStepResponse = async (action: 'reload' | 'continue') => {
    setShowResultsDialog(false);

    if (action === 'reload') {
      // User wants to reload the current step
      setCsvProcessing(true);
      try {
        if (csvUploadStep === 'players') {
          const playerResult = await processPlayersStep();
          setCurrentStepResult(playerResult);
          setShowResultsDialog(true);
          setProcessedPlayers([...playerResult.success, ...playerResult.alreadyExists]);
        } else if (csvUploadStep === 'teams') {
          const teamResult = await processTeamsStep();
          setCurrentStepResult(teamResult);
          setShowResultsDialog(true);
          setProcessedTeams([...teamResult.success, ...teamResult.alreadyExists]);
        } else if (csvUploadStep === 'tournaments') {
          const tournamentResult = await processTournamentsStep();
          setCurrentStepResult(tournamentResult);
          setShowResultsDialog(true);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        toast({ 
          title: 'Step Reload Failed', 
          description: `Unexpected error during reload: ${errorMessage}`, 
          variant: 'destructive' 
        });
        setCsvProcessing(false);
        setCsvUploadStep(null);
      }
      return;
    }

    // User wants to continue to next step
    if (csvUploadStep === 'players') {
      setCsvUploadStep('teams');
      setCsvProcessing(true);
      try {
        const teamResult = await processTeamsStep();
        setCurrentStepResult(teamResult);
        setShowResultsDialog(true);
        setProcessedTeams([...teamResult.success, ...teamResult.alreadyExists]);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        toast({ 
          title: 'Team Upload Failed', 
          description: `Unexpected error during team processing: ${errorMessage}`, 
          variant: 'destructive' 
        });
        setCsvProcessing(false);
        setCsvUploadStep(null);
      }
    } else if (csvUploadStep === 'teams') {
      setCsvUploadStep('tournaments');
      setCsvProcessing(true);
      try {
        const tournamentResult = await processTournamentsStep();
        setCurrentStepResult(tournamentResult);
        setShowResultsDialog(true);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        toast({ 
          title: 'Tournament Assignment Failed', 
          description: `Unexpected error during tournament assignment: ${errorMessage}`, 
          variant: 'destructive' 
        });
        setCsvProcessing(false);
        setCsvUploadStep(null);
      }
    } else if (csvUploadStep === 'tournaments') {
      // All steps completed
      toast({ 
        title: 'CSV Upload Complete', 
        description: 'All steps completed successfully'
      });
      setCsvData([]);
      setCsvPreview([]);
      setShowCSVImportDialog(false);
      setCsvProcessing(false);
      setCsvUploadStep(null);
      setCurrentStepResult(null);
      setProcessedPlayers([]);
      setProcessedTeams([]);
    }
  };

  const processCSVData = async () => {
    
    if (csvData.length === 0) {
      toast({ title: 'Error', description: 'No CSV data to process', variant: 'destructive' });
      return;
    }

    setCsvProcessing(true);
    let processedCount = 0;
    let errors: string[] = [];

          try {
        for (const row of csvData) {
                  try {
            // Step 1: Create or find Player 1
            let player1 = players.find(p => 
              p.phone_number === row.player1_phone ||
              (p.first_name.toLowerCase() === row.player1_first_name.toLowerCase() && 
               p.last_name.toLowerCase() === row.player1_last_name.toLowerCase())
            );

            if (!player1) {
            try {
              await addPlayer({
                first_name: row.player1_first_name,
                last_name: row.player1_last_name,
                phone_number: row.player1_phone
              });
            } catch (addError) {
              errors.push(`Failed to create player1 for team ${row.team_name}: ${addError}`);
              continue;
            }
            try {
              await refreshPlayers();
            } catch (refreshError) {
              errors.push(`Failed to refresh players after creating player1 for team ${row.team_name}: ${refreshError}`);
              continue;
            }
            player1 = players.find(p => p.phone_number === row.player1_phone);
          }

                      // Step 2: Create or find Player 2
            let player2 = players.find(p => 
              p.phone_number === row.player2_phone ||
              (p.first_name.toLowerCase() === row.player2_first_name.toLowerCase() && 
               p.last_name.toLowerCase() === row.player2_last_name.toLowerCase())
            );

            if (!player2) {
            try {
              await addPlayer({
                first_name: row.player2_first_name,
                last_name: row.player2_last_name,
                phone_number: row.player2_phone
              });
            } catch (addError) {
              errors.push(`Failed to create player2 for team ${row.team_name}: ${addError}`);
              continue;
            }
            try {
              await refreshPlayers();
            } catch (refreshError) {
              errors.push(`Failed to refresh players after creating player2 for team ${row.team_name}: ${refreshError}`);
              continue;
            }
            player2 = players.find(p => p.phone_number === row.player2_phone);
          }

          if (!player1 || !player2) {
            errors.push(`Failed to create players for team ${row.team_name}`);
            continue;
          }

                      // Step 3: Create or find Team
            let team = teams.find(t => t.name.toLowerCase() === row.team_name.toLowerCase());
          
          if (!team) {
            // Create team directly in Supabase to use custom team name
            const { supabase } = await import('../supabaseClient');
            
            const { data: teamData, error: teamError } = await supabase
              .from('teams')
              .insert([{
                name: row.team_name,
                player1_id: player1.id,
                player2_id: player2.id
              }])
              .select()
              .single();

            if (teamError) {
              console.error(`Team creation error for ${row.team_name}:`, teamError);
              errors.push(`Failed to create team ${row.team_name}: ${teamError.message}`);
              continue;
            }

            // Use the team data returned from the database instead of relying on state refresh
            team = {
              id: String(teamData.id),
              name: teamData.name,
              player1_id: teamData.player1_id,
              player2_id: teamData.player2_id,
              created_at: teamData.created_at,
              player1: player1,
              player2: player2,
              player1FirstName: player1.first_name,
              player1LastName: player1.last_name,
              player2FirstName: player2.first_name,
              player2LastName: player2.last_name,
              phoneNumber: player1.phone_number || player2.phone_number,
              city: player1.city || player2.city,
              registeredTournaments: []
            };
          }

          if (!team) {
            errors.push(`Failed to load team ${row.team_name} - team was created but not found after refresh`);
            continue;
          }

          // Step 4: Create or find Tournament and assign team
          let tournament = tournaments.find(t => t.name.toLowerCase() === row.tournament_name.toLowerCase());
          
          if (!tournament) {
            try {
              await createTournament(row.tournament_name, 'pending');
            } catch (createError) {
              errors.push(`Failed to create tournament ${row.tournament_name}: ${createError}`);
              continue;
            }
            try {
              await refreshTournaments();
            } catch (refreshError) {
              errors.push(`Failed to refresh tournaments after creating tournament ${row.tournament_name}: ${refreshError}`);
              continue;
            }
            tournament = tournaments.find(t => t.name.toLowerCase() === row.tournament_name.toLowerCase());
          }

          if (tournament) {
            // Add team to tournament
            try {
              await addTeamToTournament(team.id, tournament.id);
            } catch (addError) {
              errors.push(`Failed to add team ${row.team_name} to tournament ${row.tournament_name}: ${addError}`);
              continue;
            }
          }

          processedCount++;
        } catch (error) {
          errors.push(`Error processing row for team ${row.team_name}: ${error}`);
        }
      }

      if (errors.length > 0) {
        const errorDetails = errors.length > 3 ? 
          `${errors.slice(0, 3).join(', ')}... and ${errors.length - 3} more errors` : 
          errors.join(', ');
        
        toast({ 
          title: `CSV Upload: ${processedCount} teams processed with ${errors.length} errors`, 
          description: errorDetails,
          variant: 'destructive' 
        });
      } else {
        toast({ 
          title: `CSV Upload Complete`, 
          description: `Successfully processed ${processedCount} teams`
        });
      }

      setCsvData([]);
      setCsvPreview([]);
      setShowCSVImportDialog(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({ 
        title: 'CSV Upload Failed', 
        description: `Unexpected error during CSV processing: ${errorMessage}`, 
        variant: 'destructive' 
      });
    } finally {
      setCsvProcessing(false);
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
            <div className="flex gap-2">
              <Dialog open={showCSVImportDialog} onOpenChange={setShowCSVImportDialog}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Import CSV
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Import Teams from CSV</DialogTitle>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="csv-file">Upload CSV File</Label>
                      <Input
                        id="csv-file"
                        type="file"
                        accept=".csv"
                        onChange={handleCSVFileUpload}
                        className="mt-1"
                      />
                      <p className="text-sm text-gray-600 mt-1">
                        CSV should have columns: player1_first_name, player1_last_name, player1_phone, 
                        player2_first_name, player2_last_name, player2_phone, team_name, team_city, 
                        team_phone, tournament_name
                      </p>
                    </div>

                    {csvPreview.length > 0 && (
                      <div>
                        <Label>Preview (first 5 rows):</Label>
                        <div className="mt-2 border rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left">Team</th>
                                <th className="px-3 py-2 text-left">Player 1</th>
                                <th className="px-3 py-2 text-left">Player 2</th>
                                <th className="px-3 py-2 text-left">City</th>
                                <th className="px-3 py-2 text-left">Tournament</th>
                              </tr>
                            </thead>
                            <tbody>
                              {csvPreview.map((row, index) => (
                                <tr key={index} className="border-t">
                                  <td className="px-3 py-2">{row.team_name}</td>
                                  <td className="px-3 py-2">{row.player1_first_name} {row.player1_last_name}</td>
                                  <td className="px-3 py-2">{row.player2_first_name} {row.player2_last_name}</td>
                                  <td className="px-3 py-2">{row.team_city}</td>
                                  <td className="px-3 py-2">{row.tournament_name}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        onClick={startCSVUpload}
                        disabled={csvData.length === 0 || csvProcessing}
                        className="flex-1"
                      >
                        {csvProcessing ? 'Processing...' : `Start Multi-Step Upload (${csvData.length} Teams)`}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setCsvData([]);
                          setCsvPreview([]);
                          setShowCSVImportDialog(false);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Results Dialog for Multi-Step CSV Upload */}
              <Dialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {csvUploadStep === 'players' && 'Player Upload Results'}
                      {csvUploadStep === 'teams' && 'Team Upload Results'}
                      {csvUploadStep === 'tournaments' && 'Tournament Assignment Results'}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6">
                    {currentStepResult && (
                      <>
                        {/* Success Section */}
                        {csvUploadStep === 'players' && (currentStepResult as PlayerUploadResult).success.length > 0 && (
                          <div className="space-y-2">
                            <h3 className="text-lg font-semibold text-green-600 flex items-center gap-2">
                              <Check className="h-5 w-5" />
                              Successfully Created ({(currentStepResult as PlayerUploadResult).success.length})
                            </h3>
                            <div className="bg-green-50 p-3 rounded-md max-h-40 overflow-y-auto">
                              {(currentStepResult as PlayerUploadResult).success.map((player, index) => (
                                <div key={index} className="text-sm text-green-800">
                                  {player.first_name} {player.last_name} ({player.phone_number})
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {csvUploadStep === 'teams' && (currentStepResult as TeamUploadResult).success.length > 0 && (
                          <div className="space-y-2">
                            <h3 className="text-lg font-semibold text-green-600 flex items-center gap-2">
                              <Check className="h-5 w-5" />
                              Successfully Created ({(currentStepResult as TeamUploadResult).success.length})
                            </h3>
                            <div className="bg-green-50 p-3 rounded-md max-h-40 overflow-y-auto">
                              {(currentStepResult as TeamUploadResult).success.map((team, index) => (
                                <div key={index} className="text-sm text-green-800">
                                  {team.name} - {team.player1FirstName} {team.player1LastName} & {team.player2FirstName} {team.player2LastName}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {csvUploadStep === 'tournaments' && (currentStepResult as TournamentAssignmentResult).success.length > 0 && (
                          <div className="space-y-2">
                            <h3 className="text-lg font-semibold text-green-600 flex items-center gap-2">
                              <Check className="h-5 w-5" />
                              Successfully Assigned ({(currentStepResult as TournamentAssignmentResult).success.length})
                            </h3>
                            <div className="bg-green-50 p-3 rounded-md max-h-40 overflow-y-auto">
                              {(currentStepResult as TournamentAssignmentResult).success.map((item, index) => (
                                <div key={index} className="text-sm text-green-800">
                                  {item.team?.name || 'Unknown Team'} → {item.tournament?.name || 'Unknown Tournament'}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Already Exists Section */}
                        {csvUploadStep === 'players' && (currentStepResult as PlayerUploadResult).alreadyExists.length > 0 && (
                          <div className="space-y-2">
                            <h3 className="text-lg font-semibold text-blue-600 flex items-center gap-2">
                              <Check className="h-5 w-5" />
                              Already Exists ({(currentStepResult as PlayerUploadResult).alreadyExists.length})
                            </h3>
                            <div className="bg-blue-50 p-3 rounded-md max-h-40 overflow-y-auto">
                              {(currentStepResult as PlayerUploadResult).alreadyExists.map((player, index) => (
                                <div key={index} className="text-sm text-blue-800">
                                  {player?.first_name || 'Unknown'} {player?.last_name || 'Player'} ({player?.phone_number || 'No Phone'})
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {csvUploadStep === 'teams' && (currentStepResult as TeamUploadResult).alreadyExists.length > 0 && (
                          <div className="space-y-2">
                            <h3 className="text-lg font-semibold text-blue-600 flex items-center gap-2">
                              <Check className="h-5 w-5" />
                              Already Exists ({(currentStepResult as TeamUploadResult).alreadyExists.length})
                            </h3>
                            <div className="bg-blue-50 p-3 rounded-md max-h-40 overflow-y-auto">
                              {(currentStepResult as TeamUploadResult).alreadyExists.map((team, index) => (
                                <div key={index} className="text-sm text-blue-800">
                                  {team?.name || 'Unknown Team'} - {team?.player1FirstName || 'Unknown'} {team?.player1LastName || 'Player'} & {team?.player2FirstName || 'Unknown'} {team?.player2LastName || 'Player'}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Failed Section */}
                        {csvUploadStep === 'players' && (currentStepResult as PlayerUploadResult).failed.length > 0 && (
                          <div className="space-y-2">
                            <h3 className="text-lg font-semibold text-red-600 flex items-center gap-2">
                              <X className="h-5 w-5" />
                              Failed ({(currentStepResult as PlayerUploadResult).failed.length})
                            </h3>
                            <div className="bg-red-50 p-3 rounded-md max-h-40 overflow-y-auto">
                              {(currentStepResult as PlayerUploadResult).failed.map((item, index) => (
                                <div key={index} className="text-sm text-red-800">
                                  <div className="font-medium">{item.player?.first_name || 'Unknown'} {item.player?.last_name || 'Player'} ({item.player?.phone_number || 'No Phone'})</div>
                                  <div className="text-xs text-red-600">Reason: {item.reason}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {csvUploadStep === 'teams' && (currentStepResult as TeamUploadResult).failed.length > 0 && (
                          <div className="space-y-2">
                            <h3 className="text-lg font-semibold text-red-600 flex items-center gap-2">
                              <X className="h-5 w-5" />
                              Failed ({(currentStepResult as TeamUploadResult).failed.length})
                            </h3>
                            <div className="bg-red-50 p-3 rounded-md max-h-40 overflow-y-auto">
                              {(currentStepResult as TeamUploadResult).failed.map((item, index) => (
                                <div key={index} className="text-sm text-red-800">
                                  <div className="font-medium">{item.team?.name || 'Unknown Team'} - {item.team?.player1 || 'Unknown'} & {item.team?.player2 || 'Unknown'}</div>
                                  <div className="text-xs text-red-600">Reason: {item.reason}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {csvUploadStep === 'tournaments' && (currentStepResult as TournamentAssignmentResult).failed.length > 0 && (
                          <div className="space-y-2">
                            <h3 className="text-lg font-semibold text-red-600 flex items-center gap-2">
                              <X className="h-5 w-5" />
                              Failed ({(currentStepResult as TournamentAssignmentResult).failed.length})
                            </h3>
                            <div className="bg-red-50 p-3 rounded-md max-h-40 overflow-y-auto">
                              {(currentStepResult as TournamentAssignmentResult).failed.map((item, index) => (
                                <div key={index} className="text-sm text-red-800">
                                  <div className="font-medium">{item.team} → {item.tournament}</div>
                                  <div className="text-xs text-red-600">Reason: {item.reason}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-4 border-t">
                      <Button
                        onClick={() => handleStepResponse('reload')}
                        variant="outline"
                        className="flex-1"
                      >
                        Reload Step
                      </Button>
                      <Button
                        onClick={() => handleStepResponse('continue')}
                        className="flex-1"
                      >
                        {csvUploadStep === 'tournaments' ? 'Complete' : 'Continue to Next Step'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

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
                              handleDeletePlayerConfirmation(player);
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
                                    {player.first_name} {player.last_name}
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
                                    {player.first_name} {player.last_name}
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
                              handleDeleteTeamConfirmation(team);
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
                          handleDeleteTournamentConfirmation(tournament);
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
                <Label htmlFor="edit_team_phone">Team Phone Number (Read-only)</Label>
                <Input
                  id="edit_team_phone"
                  value={editingTeam.phoneNumber || ''}
                  disabled
                  placeholder="Phone number derived from players"
                />
              </div>
              <div>
                <Label htmlFor="edit_player1_phone">Player 1 Phone Number (Read-only)</Label>
                <Input
                  id="edit_player1_phone"
                  value={editingTeam.player1_phone || ''}
                  disabled
                  placeholder="Phone number derived from player 1"
                />
              </div>
              <div>
                <Label htmlFor="edit_player2_phone">Player 2 Phone Number (Read-only)</Label>
                <Input
                  id="edit_player2_phone"
                  value={editingTeam.player2_phone || ''}
                  disabled
                  placeholder="Phone number derived from player 2"
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
                        {player.first_name} {player.last_name}
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
                        {player.first_name} {player.last_name}
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-lg">
                Are you sure you want to delete this {deleteConfirmationType}?
              </p>
              {deleteConfirmationItem && (
                <div className="mt-2 p-3 bg-gray-50 rounded-md">
                  {deleteConfirmationType === 'player' && (
                    <div className="font-medium">
                      {(deleteConfirmationItem as Player).first_name} {(deleteConfirmationItem as Player).last_name}
                    </div>
                  )}
                  {deleteConfirmationType === 'team' && (
                    <div className="font-medium">
                      {(deleteConfirmationItem as Team).name}
                    </div>
                  )}
                  {deleteConfirmationType === 'tournament' && (
                    <div className="font-medium">
                      {(deleteConfirmationItem as Tournament).name}
                    </div>
                  )}
                </div>
              )}
              <p className="text-sm text-gray-600 mt-2">
                This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleConfirmDelete}
                variant="destructive"
                className="flex-1"
              >
                Delete
              </Button>
              <Button
                onClick={handleCancelDelete}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamBuilder; 