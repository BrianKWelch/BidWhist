import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Team } from '@/contexts/AppContext';
import { useAppContext } from '@/contexts/AppContext';

interface TeamEditorProps {
  team: Team;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedTeam: Team) => void;
}

const TeamEditor: React.FC<TeamEditorProps> = ({ team, isOpen, onClose, onSave }) => {
  console.log('TeamEditor mounted. Props:', { team, isOpen });
  console.log('TeamEditor team prop:', team);
  const [deleted, setDeleted] = useState(false);
  const { cities, tournaments, deleteTeam } = useAppContext();
  const [editedTeam, setEditedTeam] = useState(team);
  const [formData, setFormData] = useState({
    player1_first_name: team.player1_first_name || '',
    player1_last_name: team.player1_last_name || '',
    player2_first_name: team.player2_first_name || '',
    player2_last_name: team.player2_last_name || '',
    phone_number: team.phone_number || '',
    city: team.city || '',
    registeredTournaments: team.registeredTournaments || team.registered_tournaments || [],
    bostonPotOptOut: team.bostonPotOptOut || team.boston_pot_opt_out || {}
  });
  // Safe to log formData after declaration
  if (typeof window !== 'undefined') {
    console.log('TeamEditor formData state:', formData);
  }

  // Visible debug message for team prop
  const teamDebug = (
    <div style={{fontSize: '10px', color: 'purple', wordBreak: 'break-all'}}>[team prop] {JSON.stringify(team)}</div>
  );

  React.useEffect(() => {
    setFormData({
      player1_first_name: team.player1_first_name || '',
      player1_last_name: team.player1_last_name || '',
      player2_first_name: team.player2_first_name || '',
      player2_last_name: team.player2_last_name || '',
      phone_number: team.phone_number || '',
      city: team.city || '',
      registeredTournaments: team.registeredTournaments || team.registered_tournaments || [],
      bostonPotOptOut: team.bostonPotOptOut || team.boston_pot_opt_out || {}
    });
  }, [team]);

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this team? This action cannot be undone.')) {
      setDeleted(true);
      if (team && team.id && typeof deleteTeam === 'function') {
        deleteTeam(team.id);
      }
      // Disable Save Changes and close modal
      if (typeof onClose === 'function') {
        setTimeout(() => {
          onClose();
        }, 200); // slight delay for UI feedback
      }
    }
  };
  const handleToggleTournament = (tournamentId: string) => {
    setFormData(prev => ({
      ...prev,
      registeredTournaments: prev.registeredTournaments.includes(tournamentId)
        ? prev.registeredTournaments.filter((id: string) => id !== tournamentId)
        : [...prev.registeredTournaments, tournamentId],
      bostonPotOptOut: prev.registeredTournaments.includes(tournamentId)
        ? Object.fromEntries(Object.entries(prev.bostonPotOptOut).filter(([id]) => id !== tournamentId))
        : prev.bostonPotOptOut
    }));
  };

  const handleToggleBostonPot = (tournamentId: string) => {
    setFormData(prev => ({
      ...prev,
      bostonPotOptOut: {
        ...prev.bostonPotOptOut,
        [tournamentId]: !prev.bostonPotOptOut[tournamentId]
      }
    }));
  };

  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return value;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData(prev => ({ ...prev, phone_Number: formatted }));
  };

  const handleSave = () => {
    // Calculate bostonPotTournaments based on opt-out flags
    const bostonPotTournaments = formData.registeredTournaments.filter(tid => !formData.bostonPotOptOut[tid]);
    // Map snake_case form fields to camelCase for backend
    const updatedTeam = {
      ...team,
      player1FirstName: formData.player1_first_name,
      player1LastName: formData.player1_last_name,
      player2FirstName: formData.player2_first_name,
      player2LastName: formData.player2_last_name,
      phoneNumber: formData.phone_number,
      city: formData.city,
      name: `${formData.player1_first_name} ${formData.player1_last_name}/${formData.player2_first_name} ${formData.player2_last_name}`,
      registeredTournaments: formData.registeredTournaments,
      bostonPotOptOut: formData.bostonPotOptOut,
      bostonPotTournaments
    };
    onSave(updatedTeam);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Team</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Edit the details for this team. All fields are required.
        </DialogDescription>
        <div style={{color: 'red', fontWeight: 'bold'}}>[DEBUG] TeamEditor rendered. Team: {team && team.id ? team.id : 'no id'} | {team && team.name ? team.name : 'no name'}</div>
        <div style={{color: 'blue', fontWeight: 'bold'}}>[DEBUG] cities: {Array.isArray(cities) ? cities.length : 'undefined'} | tournaments: {Array.isArray(tournaments) ? tournaments.length : 'undefined'}</div>
        {teamDebug}
        <div className="space-y-4">
          <div style={{color: 'green', fontWeight: 'bold'}}>[DEBUG] Form section rendering. formData: {JSON.stringify(formData)}</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Player 1 First Name</Label>
              <Input
                value={formData.player1_first_name}
                onChange={(e) => setFormData(prev => ({ ...prev, player1_first_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Player 1 Last Name</Label>
              <Input
                value={formData.player1_last_name}
                onChange={(e) => setFormData(prev => ({ ...prev, player1_last_name: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Player 2 First Name</Label>
              <Input
                value={formData.player2_first_name}
                onChange={(e) => setFormData(prev => ({ ...prev, player2_first_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Player 2 Last Name</Label>
              <Input
                value={formData.player2_last_name}
                onChange={(e) => setFormData(prev => ({ ...prev, player2_last_name: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label>Phone Number</Label>
            <Input
                value={formData.phone_number}
                onChange={handlePhoneChange}
            />
          </div>
          <div>
            <Label>City</Label>
            <Select value={formData.city} onValueChange={(value) => setFormData(prev => ({ ...prev, city: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select a city" />
              </SelectTrigger>
              <SelectContent>
                {(Array.isArray(cities) ? cities : []).map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tournaments</Label>
            <div className="flex flex-col gap-2">
              {(Array.isArray(tournaments) ? tournaments : []).map((t) => {
                const isRegistered = formData.registeredTournaments.includes(t.id);
                return (
                  <div key={t.id} className="flex flex-col border rounded p-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isRegistered}
                        onChange={() => handleToggleTournament(t.id)}
                      />
                      <span>{t.name}</span>
                    </label>
                    {isRegistered && (
                      <label className="flex items-center gap-2 ml-6 mt-1">
                        <input
                          type="checkbox"
                          checked={!!formData.bostonPotOptOut[t.id]}
                          onChange={() => handleToggleBostonPot(t.id)}
                        />
                        <span>No Boston Pot</span>
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleted}>Delete Team</Button>
            <Button onClick={handleSave} disabled={deleted}>Save Changes</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TeamEditor;