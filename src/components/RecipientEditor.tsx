import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Users } from 'lucide-react';

interface RecipientEditorProps {
  recipients: string[];
  onRecipientsChange: (recipients: string[]) => void;
  title?: string;
}

const RecipientEditor: React.FC<RecipientEditorProps> = ({ 
  recipients, 
  onRecipientsChange, 
  title = 'Recipients' 
}) => {
  const [newRecipient, setNewRecipient] = useState('');

  const addRecipient = () => {
    const trimmedRecipient = newRecipient.trim();
    if (trimmedRecipient && !recipients.includes(trimmedRecipient)) {
      const updatedRecipients = [...recipients, trimmedRecipient];
      onRecipientsChange(updatedRecipients);
      setNewRecipient('');
    }
  };

  const removeRecipient = (phone: string) => {
    const updatedRecipients = recipients.filter(r => r !== phone);
    onRecipientsChange(updatedRecipients);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addRecipient();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          {title} ({recipients.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={newRecipient}
            onChange={(e) => setNewRecipient(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter phone number (e.g., 555-123-4567)"
            className="flex-1"
          />
          <Button 
            type="button"
            onClick={addRecipient} 
            disabled={!newRecipient.trim()}
            size="sm"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="space-y-2">
          <Label>Current Recipients:</Label>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded-md min-h-[60px]">
            {recipients.length === 0 ? (
              <p className="text-sm text-gray-500 w-full text-center py-4">No recipients added</p>
            ) : (
              recipients.map((phone, index) => (
                <Badge key={`${phone}-${index}`} variant="secondary" className="flex items-center gap-1 px-2 py-1">
                  <span>{phone}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-red-100 ml-1"
                    onClick={() => removeRecipient(phone)}
                  >
                    <X className="w-3 h-3 hover:text-red-500" />
                  </Button>
                </Badge>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RecipientEditor;