import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Play } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';

interface PlayerSetupProps {
  onSetupComplete: () => void;
}

const PlayerSetup: React.FC<PlayerSetupProps> = ({ onSetupComplete }) => {
  const { setCurrentUser, teams, fetchError } = useAppContext();
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleStart = () => {
    if (!playerName.trim()) return;
    // ...removed debug log...
    setCurrentUser(playerName.trim());
    // ...removed debug log...
    onSetupComplete();
    // ...removed debug log...
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleStart();
    }
  };

  // ...removed debug log...
  if (!teams) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4" />
          <div>Loading teams...</div>
          {fetchError && (
            <div className="mt-4 bg-red-100 border border-red-300 text-red-800 rounded p-3 text-center">
              {fetchError}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-between items-center bg-gradient-to-br from-black via-red-900 to-black p-4 relative">
      {/* Card suit background pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none select-none bg-[url('https://upload.wikimedia.org/wikipedia/commons/5/5a/Spades.svg')] bg-center bg-repeat" style={{zIndex:0}} />
      <Card className="w-full max-w-md shadow-2xl border-4 border-black rounded-2xl bg-gradient-to-br from-black via-gray-900 to-red-900/80 backdrop-blur relative z-10">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-20 h-28 flex items-center justify-center bg-gradient-to-br from-black to-red-800 rounded-xl shadow-lg border-2 border-white relative">
            {/* Ace of Spades SVG */}
            <svg width="48" height="64" viewBox="0 0 48 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="48" height="64" rx="8" fill="#fff" stroke="#000" strokeWidth="2"/>
              <text x="24" y="40" textAnchor="middle" fontSize="36" fontWeight="bold" fill="#000">🂡</text>
            </svg>
            <span className="absolute top-1 left-2 text-black text-lg font-bold">A</span>
            <span className="absolute bottom-1 right-2 text-black text-lg font-bold rotate-180">A</span>
            <span className="absolute top-5 left-3 text-black text-2xl">♠</span>
            <span className="absolute bottom-5 right-3 text-black text-2xl rotate-180">♠</span>
          </div>
          <CardTitle className="text-4xl font-extrabold bg-gradient-to-r from-red-600 to-black bg-clip-text text-transparent drop-shadow-lg tracking-wide">
            My Tournaments
          </CardTitle>
          <p className="text-red-200 text-lg font-semibold drop-shadow">Welcome Brian</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-800 rounded p-3 mb-2 text-center">
              {error}
            </div>
          )}
          {fetchError && (
            <div className="bg-red-100 border border-red-300 text-red-800 rounded p-3 mb-2 text-center">
              {fetchError}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="playerName" className="text-base font-semibold text-red-100 drop-shadow">
              Please enter your pin to access the admin portal
            </Label>
            <Input
              id="playerName"
              placeholder="Enter pin"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyPress={handleKeyPress}
              className="text-center text-lg bg-black/80 text-white border-red-500 focus:border-red-700 focus:ring-red-700"
              autoFocus
            />
          </div>

          <Button
            onClick={handleStart}
            disabled={!playerName.trim() || loading}
            className="w-full bg-gradient-to-r from-black via-red-700 to-black hover:from-red-800 hover:to-black text-white font-bold py-3 px-4 rounded-xl shadow-xl transform transition hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 border-2 border-red-700"
          >
            {loading && <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />}
            <Play size={20} />
            Enter My Tournaments Admin portal
          </Button>
          
          {teams?.length === 0 && (
            <p className="text-sm text-red-300 text-center italic">
              Note: Add teams first in the Teams tab
            </p>
          )}
        </CardContent>
        {/* Credit */}
        <div className="mt-6 text-xs text-center text-red-200 font-mono tracking-wide">
          Built and Managed by Brian Welch
        </div>
      </Card>
      {/* Footer credit for extra visibility on mobile */}
      <div className="w-full text-center text-xs text-red-300 mt-4 z-10">
        Built and Managed by Brian Welch
      </div>
    </div>
  );
};

export default PlayerSetup;