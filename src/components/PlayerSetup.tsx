import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, Play } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';

interface PlayerSetupProps {
  onSetupComplete: () => void;
}

const PlayerSetup: React.FC<PlayerSetupProps> = ({ onSetupComplete }) => {
  const { setCurrentUser, teams } = useAppContext();
  const [playerName, setPlayerName] = useState('');

  const handleStart = () => {
    if (!playerName.trim()) return;
    
    setCurrentUser(playerName.trim());
    onSetupComplete();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleStart();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-0 bg-white/90 backdrop-blur">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <Users className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Whist Scorer
          </CardTitle>
          <p className="text-gray-600">Enter your name to start</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="playerName" className="text-sm font-medium">
              Your Name
            </Label>
            <Input
              id="playerName"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyPress={handleKeyPress}
              className="text-center text-lg"
              autoFocus
            />
          </div>

          <Button
            onClick={handleStart}
            disabled={!playerName.trim()}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-lg shadow-lg transform transition hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
          >
            <Play size={20} />
            Start
          </Button>
          
          {teams.length === 0 && (
            <p className="text-sm text-gray-500 text-center">
              Note: Add teams first in the Teams tab
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PlayerSetup;