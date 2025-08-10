import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PlayerEditorProps {
  player: any;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedPlayer: any) => void;
}

const PlayerEditor: React.FC<PlayerEditorProps> = ({ player, isOpen, onClose, onSave }) => {
  console.log('PlayerEditor mounted. Props:', { player, isOpen });
  const [formData, setFormData] = useState({
    firstName: player.firstName || '',
    lastName: player.lastName || '',
    phone: player.phone || ''
  });

  React.useEffect(() => {
    setFormData({
      firstName: player.firstName || '',
      lastName: player.lastName || '',
      phone: player.phone || ''
    });
  }, [player]);

  const handleSave = () => {
    onSave({ ...player, ...formData });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Player</DialogTitle>
        </DialogHeader>
        <div style={{color: 'red', fontWeight: 'bold'}}>[DEBUG] PlayerEditor rendered. Player: {player && player.playerId ? player.playerId : 'no id'} | {player && player.firstName ? player.firstName : 'no fname'}</div>
        <div className="space-y-4">
          <div>
            <Label>First Name</Label>
            <Input value={formData.firstName} onChange={e => setFormData(f => ({ ...f, firstName: e.target.value }))} />
          </div>
          <div>
            <Label>Last Name</Label>
            <Input value={formData.lastName} onChange={e => setFormData(f => ({ ...f, lastName: e.target.value }))} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={formData.phone} onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PlayerEditor;
