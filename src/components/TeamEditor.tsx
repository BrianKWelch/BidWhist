import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  const { cities } = useAppContext();
  const [formData, setFormData] = useState({
    player1FirstName: team.player1FirstName,
    player1LastName: team.player1LastName,
    player2FirstName: team.player2FirstName,
    player2LastName: team.player2LastName,
    phoneNumber: team.phoneNumber,
    city: team.city
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
    setFormData(prev => ({ ...prev, phoneNumber: formatted }));
  };

  const handleSave = () => {
    const updatedTeam = {
      ...team,
      ...formData,
      name: `${formData.player1FirstName} ${formData.player1LastName}/${formData.player2FirstName} ${formData.player2LastName}`
    };
    onSave(updatedTeam);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Team</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Player 1 First Name</Label>
              <Input
                value={formData.player1FirstName}
                onChange={(e) => setFormData(prev => ({ ...prev, player1FirstName: e.target.value }))}
              />
            </div>
            <div>
              <Label>Player 1 Last Name</Label>
              <Input
                value={formData.player1LastName}
                onChange={(e) => setFormData(prev => ({ ...prev, player1LastName: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Player 2 First Name</Label>
              <Input
                value={formData.player2FirstName}
                onChange={(e) => setFormData(prev => ({ ...prev, player2FirstName: e.target.value }))}
              />
            </div>
            <div>
              <Label>Player 2 Last Name</Label>
              <Input
                value={formData.player2LastName}
                onChange={(e) => setFormData(prev => ({ ...prev, player2LastName: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label>Phone Number</Label>
            <Input
              value={formData.phoneNumber}
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
                {cities.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TeamEditor;