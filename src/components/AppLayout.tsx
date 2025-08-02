import React, { useState } from 'react';
import PlayerSetup from './PlayerSetup';
import TeamSetup from './TeamSetup';
import GameHistory from './GameHistory';
import TournamentManagement from './TournamentManagement';
import { TournamentScheduler } from './TournamentScheduler';
import TournamentMessaging from './TournamentMessaging';
import CombinedResultsPage from './CombinedResultsPage';
import { BracketGenerator } from './BracketGenerator';
import FinanceManager from './FinanceManager';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppContext } from '@/contexts/AppContext';
import { Users, History, RotateCcw, Settings, Calendar, MessageSquare, Award, Target, DollarSign, Search } from 'lucide-react';
import PlayerTracking from './PlayerTracking';
import AdminTables from '@/pages/AdminTables';


// --- Error Boundary Component ---
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, info: any) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'red', padding: 32 }}>
          <h2>Something went wrong in AppLayout.</h2>
          <pre>{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const AppLayout: React.FC = () => {
  const { currentUser, teams, getActiveTournament, setActiveTournament, tournaments, refreshGamesFromSupabase, refreshSchedules } = useAppContext();
  const [showSetup, setShowSetup] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const handleAdminRefresh = async () => {
    try {
      setRefreshing(true);
      await refreshGamesFromSupabase();
      await refreshSchedules();
    } finally {
      setRefreshing(false);
    }
  };

  const handleSetupComplete = () => {
    console.log('AppLayout handleSetupComplete called');
    setShowSetup(false);
  };


  // Handler to set a tournament as active
  const handleSetActiveTournament = (tournamentId: string) => {
    setActiveTournament(tournamentId);
  };

  if (showSetup || !currentUser) {
    return <PlayerSetup onSetupComplete={handleSetupComplete} />;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          <Card className="bg-white/90 backdrop-blur shadow-lg">
            <CardContent className="p-4">
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="flex justify-between items-center w-full">
                  <div>
                    <h1 className="text-xl md:text-2xl font-bold text-gray-800">Welcome, {currentUser}</h1>
                    <p className="text-sm text-gray-600">
                      {teams.length} teams registered
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAdminRefresh}
                      disabled={refreshing}
                      className="text-green-700 border-green-600 hover:bg-green-600 hover:text-white"
                    >
                      {refreshing ? 'Refreshing...' : 'Refresh'}
                    </Button>
                    <label htmlFor="active-tournament-select" className="font-medium text-sm">Active Tournament:</label>
                    <select
                      id="active-tournament-select"
                      className="border rounded p-2 text-sm"
                      value={getActiveTournament()?.id || ''}
                      onChange={e => handleSetActiveTournament(e.target.value)}
                    >
                      <option value="" disabled>Select a tournament...</option>
                      {tournaments.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="teams" className="w-full">
            <div className="flex gap-6">
              {/* Left Sidebar with Tabs */}
              <div className="w-64 flex-shrink-0">
                <Card className="bg-white/90 backdrop-blur shadow-lg">
                  <CardContent className="p-4">
                    <TabsList className="grid w-full grid-cols-1 gap-2 h-auto">
                      <TabsTrigger value="teams" className="flex items-center gap-2 justify-start text-sm px-3 py-2 h-auto">
                        <Users size={16} />
                        <span>Teams</span>
                      </TabsTrigger>
                      <TabsTrigger value="player-tracking" className="flex items-center gap-2 justify-start text-sm px-3 py-2 h-auto">
                        <Search size={16} />
                        <span>Players</span>
                      </TabsTrigger>
                      <TabsTrigger value="schedule" className="flex items-center gap-2 justify-start text-sm px-3 py-2 h-auto">
                        <Calendar size={16} />
                        <span>Schedule</span>
                      </TabsTrigger>
                      <TabsTrigger value="results" className="flex items-center gap-2 justify-start text-sm px-3 py-2 h-auto">
                        <Award size={16} />
                        <span>Results</span>
                      </TabsTrigger>
                      <TabsTrigger value="bracket" className="flex items-center gap-2 justify-start text-sm px-3 py-2 h-auto">
                        <Target size={16} />
                        <span>Bracket</span>
                      </TabsTrigger>
                      <TabsTrigger value="finance" className="flex items-center gap-2 justify-start text-sm px-3 py-2 h-auto">
                        <DollarSign size={16} />
                        <span>Finance</span>
                      </TabsTrigger>
                      <TabsTrigger value="history" className="flex items-center gap-2 justify-start text-sm px-3 py-2 h-auto">
                        <History size={16} />
                        <span>History</span>
                      </TabsTrigger>
                      <TabsTrigger value="admin-tables" className="flex items-center gap-2 justify-start text-sm px-3 py-2 h-auto">
                        <Settings size={16} />
                        <span>Admin Tables</span>
                      </TabsTrigger>
                      <TabsTrigger value="admin" className="flex items-center gap-2 justify-start text-sm px-3 py-2 h-auto">
                        <span className="ml-1">Admin</span>
                      </TabsTrigger>
                    </TabsList>
                  </CardContent>
                </Card>
              </div>

              {/* Right Content Area */}
              <div className="flex-1">
                <TabsContent value="teams" className="mt-0">
                  <TeamSetup />
                </TabsContent>
                
                <TabsContent value="schedule" className="mt-0">
                  <TournamentScheduler />
                </TabsContent>
                
                
                <TabsContent value="results" className="mt-0">
                  <CombinedResultsPage />
                </TabsContent>
                
                <TabsContent value="bracket" className="mt-0">
                  <BracketGenerator />
                </TabsContent>
                
                <TabsContent value="finance" className="mt-0">
                  <FinanceManager />
                </TabsContent>
                <TabsContent value="player-tracking" className="mt-0">
                  <PlayerTracking />
                </TabsContent>
                
                <TabsContent value="history" className="mt-0">
                  <GameHistory />
                </TabsContent>
                
                <TabsContent value="admin-tables" className="mt-0">
                  <AdminTables />
                </TabsContent>
                <TabsContent value="admin" className="mt-0">
                  <TournamentManagement />
                </TabsContent>
              </div>
            </div>
          </Tabs>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default AppLayout;