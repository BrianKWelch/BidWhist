import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Users, Plus, Edit2, Save, X, Search, Phone, MapPin } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { Team } from '@/contexts/AppContext';

const TeamManager: React.FC = () => {
  const { teams, tournaments, cities, updateTeam, addTeam } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Add form state
  const [addFormData, setAddFormData] = useState({
    player1FirstName: '',
    player1LastName: '',
    player2FirstName: '',
    player2LastName: '',
    phoneNumber: '',
    city: '',
    selectedTournaments: [] as string[],
    bostonPotTournaments: [] as string[]
  });

  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return value;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setAddFormData(prev => ({ ...prev, phoneNumber: formatted }));
  };

  const handleAddPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setAddFormData(prev => ({ ...prev, phoneNumber: formatted }));
  };

  const handleTournamentChange = (tournamentId: string, checked: boolean) => {
    setAddFormData(prev => ({
      ...prev,
      selectedTournaments: checked 
        ? [...prev.selectedTournaments, tournamentId]
        : prev.selectedTournaments.filter(id => id !== tournamentId)
    }));
    if (!checked) {
      setAddFormData(prev => ({
        ...prev,
        bostonPotTournaments: prev.bostonPotTournaments.filter(id => id !== tournamentId)
      }));
    }
  };

  const handleBostonPotChange = (tournamentId: string, checked: boolean) => {
    setAddFormData(prev => ({
      ...prev,
      bostonPotTournaments: checked 
        ? [...prev.bostonPotTournaments, tournamentId]
        : prev.bostonPotTournaments.filter(id => id !== tournamentId)
    }));
  };

  const handleAddTeam = () => {
    if (!addFormData.player1FirstName.trim() || !addFormData.player1LastName.trim() || 
        !addFormData.player2FirstName.trim() || !addFormData.player2LastName.trim() || 
        !addFormData.phoneNumber.trim() || !addFormData.city.trim() || 
        addFormData.selectedTournaments.length === 0) return;
    
    addTeam(
      addFormData.player1FirstName.trim(),
      addFormData.player1LastName.trim(),
      addFormData.player2FirstName.trim(),
      addFormData.player2LastName.trim(),
      addFormData.phoneNumber.trim(),
      addFormData.city.trim(),
      addFormData.selectedTournaments,
      addFormData.bostonPotTournaments
    );
    
    // Reset form
    setAddFormData({
      player1FirstName: '',
      player1LastName: '',
      player2FirstName: '',
      player2LastName: '',
      phoneNumber: '',
      city: '',
      selectedTournaments: [],
      bostonPotTournaments: []
    });
    setShowAddForm(false);
  };

  const handleSaveEdit = () => {
    if (editingTeam) {
      updateTeam(editingTeam);
      setEditingTeam(null);
    }
  };

  const filteredTeams = teams.filter(team => {
    if (!searchTerm) return true;
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

  return (
    <div className="space-y-6">
      {/* Add Team Form */}
      {showAddForm && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Add New Team
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Player 1 First Name</Label>
                <Input
                  value={addFormData.player1FirstName}
                  onChange={(e) => setAddFormData(prev => ({ ...prev, player1FirstName: e.target.value }))}
                  placeholder="John"
                />
              </div>
              <div>
                <Label>Player 1 Last Name</Label>
                <Input
                  value={addFormData.player1LastName}
                  onChange={(e) => setAddFormData(prev => ({ ...prev, player1LastName: e.target.value }))}
                  placeholder="Smith"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Player 2 First Name</Label>
                <Input
                  value={addFormData.player2FirstName}
                  onChange={(e) => setAddFormData(prev => ({ ...prev, player2FirstName: e.target.value }))}
                  placeholder="Mike"
                />
              </div>
              <div>
                <Label>Player 2 Last Name</Label>
                <Input
                  value={addFormData.player2LastName}
                  onChange={(e) => setAddFormData(prev => ({ ...prev, player2LastName: e.target.value }))}
                  placeholder="Johnson"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Phone Number</Label>
                <Input
                  value={addFormData.phoneNumber}
                  onChange={handleAddPhoneChange}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <Label>City</Label>
                <Select value={addFormData.city} onValueChange={(value) => setAddFormData(prev => ({ ...prev, city: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a city" />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label>Tournament Registrations</Label>
              <div className="space-y-2 mt-2">
                {tournaments.map((tournament) => (
                  <div key={tournament.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`tournament-${tournament.id}`}
                      checked={addFormData.selectedTournaments.includes(tournament.id)}
                      onCheckedChange={(checked) => handleTournamentChange(tournament.id, checked as boolean)}
                    />
                    <label htmlFor={`tournament-${tournament.id}`} className="text-sm">
                      {tournament.name} (${tournament.cost})
                    </label>
                    {addFormData.selectedTournaments.includes(tournament.id) && (
                      <div className="flex items-center space-x-2 ml-4">
                        <Checkbox
                          id={`boston-${tournament.id}`}
                          checked={addFormData.bostonPotTournaments.includes(tournament.id)}
                          onCheckedChange={(checked) => handleBostonPotChange(tournament.id, checked as boolean)}
                        />
                        <label htmlFor={`boston-${tournament.id}`} className="text-sm text-blue-600">
                          Boston Pot (+${tournament.bostonPotCost})
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={handleAddTeam} disabled={
                !addFormData.player1FirstName.trim() || !addFormData.player1LastName.trim() || 
                !addFormData.player2FirstName.trim() || !addFormData.player2LastName.trim() || 
                !addFormData.phoneNumber.trim() || !addFormData.city.trim() || 
                addFormData.selectedTournaments.length === 0
              }>
                <Plus className="w-4 h-4 mr-2" />
                Add Team
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team List */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Team Management ({teams.length} teams)
            </CardTitle>
            <Button onClick={() => setShowAddForm(true)} disabled={showAddForm}>
              <Plus className="w-4 h-4 mr-2" />
              Add Team
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search teams by name, city, or player..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredTeams.map((team) => (
              <div key={team.id} className="p-4 bg-gray-50 rounded-lg space-y-3">
                {editingTeam?.id === team.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Player 1 First Name</Label>
                        <Input
                          value={editingTeam.player1FirstName}
                          onChange={(e) => setEditingTeam(prev => prev ? { ...prev, player1FirstName: e.target.value } : null)}
                        />
                      </div>
                      <div>
                        <Label>Player 1 Last Name</Label>
                        <Input
                          value={editingTeam.player1LastName}
                          onChange={(e) => setEditingTeam(prev => prev ? { ...prev, player1LastName: e.target.value } : null)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Player 2 First Name</Label>
                        <Input
                          value={editingTeam.player2FirstName}
                          onChange={(e) => setEditingTeam(prev => prev ? { ...prev, player2FirstName: e.target.value } : null)}
                        />
                      </div>
                      <div>
                        <Label>Player 2 Last Name</Label>
                        <Input
                          value={editingTeam.player2LastName}
                          onChange={(e) => setEditingTeam(prev => prev ? { ...prev, player2LastName: e.target.value } : null)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Phone Number</Label>
                        <Input
                          value={editingTeam.phoneNumber}
                          onChange={(e) => setEditingTeam(prev => prev ? { ...prev, phoneNumber: formatPhoneNumber(e.target.value) } : null)}
                        />
                      </div>
                      <div>
                        <Label>City</Label>
                        <Select 
                          value={editingTeam.city} 
                          onValueChange={(value) => setEditingTeam(prev => prev ? { ...prev, city: value } : null)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {cities.map((city) => (
                              <SelectItem key={city} value={city}>
                                {city}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveEdit}>
                        <Save className="w-3 h-3 mr-1" />
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingTeam(null)}>
                        <X className="w-3 h-3 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">Team {team.teamNumber}: {team.name}</div>
                        <div className="text-sm text-gray-600">
                          {team.player1FirstName} {team.player1LastName} & {team.player2FirstName} {team.player2LastName}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingTeam(team)}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        <span>{team.phoneNumber}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>{team.city}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-1">
                      {team.registeredTournaments?.map(tournamentId => {
                        const tournament = tournaments.find(t => t.id === tournamentId);
                        const isBostonPot = team.bostonPotTournaments?.includes(tournamentId);
                        return (
                          <Badge key={tournamentId} variant="outline" className="text-xs">
                            {tournament?.name}
                            {isBostonPot && <span className="ml-1">★</span>}
                          </Badge>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamManager; 