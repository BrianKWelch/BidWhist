import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MapPin, Plus, X, AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { supabase } from '../supabaseClient';
import { toast } from '@/hooks/use-toast';

// ── helpers ───────────────────────────────────────────────────────────────────
function ageLabel(timestamp: string): string {
  const ms = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 min ago';
  return `${mins} min ago`;
}

function ageBadgeClass(timestamp: string): string {
  const mins = (Date.now() - new Date(timestamp).getTime()) / 60000;
  if (mins < 2)  return 'bg-gray-100 text-gray-600 border-gray-300';
  if (mins < 5)  return 'bg-yellow-100 text-yellow-800 border-yellow-400';
  return 'bg-red-100 text-red-800 border-red-400';
}

// ── component ─────────────────────────────────────────────────────────────────
const CityManager: React.FC = () => {
  const { cities, addCity, removeCity, teams, schedules } = useAppContext();
  const [newCity, setNewCity] = useState('');

  // Stuck score entries
  const [stuckGames, setStuckGames] = useState<any[]>([]);
  const [loadingStuck, setLoadingStuck] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchStuck = useCallback(async () => {
    setLoadingStuck(true);
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'entering')
      .order('timestamp', { ascending: true });
    setLoadingStuck(false);
    if (error) {
      toast({ title: 'Could not load stuck records', description: error.message, variant: 'destructive' });
      return;
    }
    setStuckGames(data || []);
  }, []);

  useEffect(() => {
    fetchStuck();
    const interval = setInterval(fetchStuck, 10000); // re-check every 10 seconds
    return () => clearInterval(interval);
  }, [fetchStuck]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from('games').delete().eq('id', id);
    setDeletingId(null);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Record cleared — teams can re-enter score' });
    setStuckGames(prev => prev.filter(g => g.id !== id));
  };

  // City handlers
  const handleAddCity = () => {
    if (!newCity.trim()) return;
    addCity(newCity.trim());
    setNewCity('');
  };
  const handleRemoveCity = (city: string) => removeCity(city);
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAddCity();
  };

  // Lookup helpers for display
  const teamName = (id: string) => {
    const t = teams.find(t => String(t.id) === String(id));
    return t ? `#${t.id} ${t.name}` : `Team ${id}`;
  };
  const matchInfo = (matchId: string, round: number) => {
    for (const s of schedules) {
      const m = s.matches.find(m => m.id === matchId);
      if (m) return `Rd ${m.round} · Table ${m.table}`;
    }
    return `Round ${round}`;
  };

  return (
    <div className="space-y-6">
      {/* ── City management ── */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            City Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="newCity">Add New City</Label>
            <div className="flex gap-2">
              <Input
                id="newCity"
                placeholder="Enter city name"
                value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1"
              />
              <Button onClick={handleAddCity} disabled={!newCity.trim()} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Current Cities ({cities.length})</Label>
            <div className="flex flex-wrap gap-2">
              {cities.map((city) => (
                <Badge key={city} variant="secondary" className="flex items-center gap-2 px-3 py-1">
                  {city}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveCity(city)}
                    className="h-4 w-4 p-0 hover:bg-red-100"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </Badge>
              ))}
            </div>
            {cities.length === 0 && (
              <p className="text-gray-500 text-sm">No cities added yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Stuck score entries ── */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              Stuck Score Entries
              {stuckGames.length > 0 && (
                <Badge className="bg-red-100 text-red-700 border-red-300 ml-1">
                  {stuckGames.length}
                </Badge>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStuck}
              disabled={loadingStuck}
              className="flex items-center gap-1 text-xs"
            >
              <RefreshCw className={`w-3 h-3 ${loadingStuck ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stuckGames.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">
              {loadingStuck ? 'Loading…' : '✓ No stuck records — all clear.'}
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 mb-3">
                Gray = probably still active &nbsp;·&nbsp; Yellow = possibly stuck &nbsp;·&nbsp; Red = definitely stuck
              </p>
              {stuckGames.map(g => (
                <div
                  key={g.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-white"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Age badge */}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded border whitespace-nowrap ${ageBadgeClass(g.timestamp)}`}>
                      {ageLabel(g.timestamp)}
                    </span>

                    {/* Match + teams */}
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {matchInfo(g.matchId, g.round)}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        Lock held by {teamName(g.entered_by_team_id)}
                        &nbsp;·&nbsp;
                        {teamName(g.teamA)} vs {teamName(g.teamB)}
                      </div>
                    </div>
                  </div>

                  {/* Delete button */}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(g.id)}
                    disabled={deletingId === g.id}
                    className="flex items-center gap-1 shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                    {deletingId === g.id ? 'Clearing…' : 'Clear'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CityManager;
