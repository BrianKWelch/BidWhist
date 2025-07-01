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
import { Users, History, RotateCcw, Settings, Calendar, MessageSquare, Award, Target, DollarSign } from 'lucide-react';

const AppLayout: React.FC = () => {
  const { currentUser, setCurrentUser, teams } = useAppContext();
  const [showSetup, setShowSetup] = useState(true);

  const handleSetupComplete = () => {
    setShowSetup(false);
  };

  const resetApp = () => {
    setCurrentUser('');
    setShowSetup(true);
  };

  if (showSetup || !currentUser) {
    return <PlayerSetup onSetupComplete={handleSetupComplete} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <Card className="bg-white/90 backdrop-blur shadow-lg">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-800">Welcome, {currentUser}</h1>
                <p className="text-sm text-gray-600">
                  {teams.length} teams registered
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={resetApp}
                className="flex items-center gap-2"
              >
                <RotateCcw size={16} />
                <span className="hidden sm:inline">Switch User</span>
              </Button>
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
                    <TabsTrigger value="schedule" className="flex items-center gap-2 justify-start text-sm px-3 py-2 h-auto">
                      <Calendar size={16} />
                      <span>Schedule</span>
                    </TabsTrigger>
                    <TabsTrigger value="messaging" className="flex items-center gap-2 justify-start text-sm px-3 py-2 h-auto">
                      <MessageSquare size={16} />
                      <span>Messages</span>
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
                    <TabsTrigger value="admin" className="flex items-center gap-2 justify-start text-sm px-3 py-2 h-auto">
                      <Settings size={16} />
                      <span>Admin</span>
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
              
              <TabsContent value="messaging" className="mt-0">
                <TournamentMessaging />
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
              
              <TabsContent value="history" className="mt-0">
                <GameHistory />
              </TabsContent>
              
              <TabsContent value="admin" className="mt-0">
                <TournamentManagement />
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default AppLayout;