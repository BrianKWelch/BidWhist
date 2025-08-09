import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Plus, Trophy, Star, Edit2, Save, X, MessageSquare } from 'lucide-react';
import CityManager from './CityManager';
import { IntegratedScoreSystem } from './IntegratedScoreSystem';
import MessageManager from './MessageManager';
import { useAppContext } from '@/contexts/AppContext';

const TournamentManagement: React.FC = () => {
  const {
    tournaments,
    setTournaments,
    addTournament,
    updateTournament,
    getActiveTournament,
    setActiveTournament
  } = useAppContext();

  const [activeTab, setActiveTab] = useState('tournaments');
  const [tournamentName, setTournamentName] = useState('');
  const [tournamentCost, setTournamentCost] = useState('');
  const [bostonPotCost, setBostonPotCost] = useState('10');
  const [tournamentDescription, setTournamentDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editBostonCost, setEditBostonCost] = useState('');
  const [editDescription, setEditDescription] = useState('');


  const activeTournament = getActiveTournament();

  const handleAddTournament = async () => {
    if (!tournamentName.trim() || !tournamentCost.trim() || !bostonPotCost.trim()) return;

    const cost = parseFloat(tournamentCost);
    const bostonCost = parseFloat(bostonPotCost);
    if (isNaN(cost) || cost <= 0 || isNaN(bostonCost) || bostonCost <= 0) return;

    await addTournament(
      tournamentName.trim(),
      cost,
      bostonCost,
      tournamentDescription.trim() || undefined
    );

    setTournamentName('');
    setTournamentCost('');
    setBostonPotCost('10');
    setTournamentDescription('');
  };

  const startEdit = (tournament: any) => {
    setEditingId(tournament.id);
    setEditName(tournament.name);
    setEditCost(tournament.cost.toString());
    setEditBostonCost(tournament.bostonPotCost.toString());
    setEditDescription(tournament.description || '');
  };

  const saveEdit = async () => {
    if (!editName.trim() || !editCost.trim() || !editBostonCost.trim() || !editingId) return;

    const cost = parseFloat(editCost);
    const bostonCost = parseFloat(editBostonCost);
    if (isNaN(cost) || cost <= 0 || isNaN(bostonCost) || bostonCost <= 0) return;

    await updateTournament(
      editingId,
      editName.trim(),
      cost,
      bostonCost,
      editDescription.trim() || undefined
    );

    cancelEdit();
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditCost('');
    setEditBostonCost('');
    setEditDescription('');
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="tournaments" className="w-full" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tournaments">Tournament Setup</TabsTrigger>
          <TabsTrigger value="cities">City Management</TabsTrigger>
          <TabsTrigger value="messaging">Messaging</TabsTrigger>
        </TabsList>

        <TabsContent value="tournaments" className="space-y-6">
          {/* Active Tournament Selector */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Active Tournament
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <label htmlFor="active-tournament-select" className="font-medium">Select Active Tournament:</label>
                <select
                  id="active-tournament-select"
                  className="border rounded p-2"
                  value={activeTournament?.id || ''}
                  onChange={e => {
                    const selected = tournaments.find(t => t.id === e.target.value);
                    if (!selected) return;
                    setActiveTournament(selected.id);
                  }}
                >
                  <option value="" disabled>Select a tournament...</option>
                  {tournaments.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {activeTournament && (
                  <Badge variant="default" className="bg-green-500 text-white ml-2">Active</Badge>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Tournament Setup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="tournamentName">Tournament Name</Label>
                <Input
                  id="tournamentName"
                  placeholder="e.g., Friday 3 AM Tournament"
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tournamentCost">Base Cost ($)</Label>
                  <Input
                    id="tournamentCost"
                    type="number"
                    placeholder="30"
                    value={tournamentCost}
                    onChange={(e) => setTournamentCost(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="bostonPotCost">Boston Pot Cost ($)</Label>
                  <Input
                    id="bostonPotCost"
                    type="number"
                    placeholder="10"
                    value={bostonPotCost}
                    onChange={(e) => setBostonPotCost(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="tournamentDescription">Description (Optional)</Label>
                <Textarea
                  id="tournamentDescription"
                  placeholder="Tournament details..."
                  value={tournamentDescription}
                  onChange={(e) => setTournamentDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <Button
                onClick={handleAddTournament}
                disabled={!tournamentName.trim() || !tournamentCost.trim() || !bostonPotCost.trim()}
                className="w-full flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Tournament
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Available Tournaments ({tournaments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {tournaments.map((tournament) => (
                  <div
                    key={tournament.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${tournament.status === 'active' ? 'bg-green-50 border border-green-300' : tournament.status === 'pending' ? 'bg-yellow-50 border border-yellow-300' : 'bg-gray-50'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{tournament.name}</span>
                      <Badge variant={tournament.status === 'active' ? 'default' : tournament.status === 'pending' ? 'secondary' : 'outline'}>
                        {tournament.status === 'active' ? 'Active' : tournament.status === 'pending' ? 'Pending' : 'Finished'}
                      </Badge>
                    </div>
                    {editingId === tournament.id ? (
                      <div className="flex-1 space-y-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Tournament name"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="number"
                            value={editCost}
                            onChange={(e) => setEditCost(e.target.value)}
                            placeholder="Base cost"
                          />
                          <Input
                            type="number"
                            value={editBostonCost}
                            onChange={(e) => setEditBostonCost(e.target.value)}
                            placeholder="Boston cost"
                          />
                        </div>
                        <Textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Description"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEdit}>
                            <Save className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEdit}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold">{tournament.name}</span>
                            {tournament.status === 'active' && (
                              <Badge variant="default" className="bg-green-500 text-white">Active</Badge>
                            )}
                            {tournament.status === 'finished' && (
                              <Badge variant="secondary">Finished</Badge>
                            )}
                          </div>
                          {tournament.description && (
                            <div className="text-sm text-gray-600">
                              {tournament.description}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary">
                              Per Team: ${tournament.cost}
                            </Badge>
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Star className="w-3 h-3" />
                              Boston: ${tournament.bostonPotCost}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="text-sm text-gray-600">Total with Boston:</div>
                            <div className="font-semibold">${(tournament.cost || 0) + (tournament.bostonPotCost || 0)}</div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEdit(tournament)}
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cities">
          <CityManager />
        </TabsContent>

        <TabsContent value="messaging" className="space-y-6">
          <MessageManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TournamentManagement;
