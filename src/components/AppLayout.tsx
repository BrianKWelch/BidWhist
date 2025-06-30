import React, { useState } from 'react';
import PlayerSetup from './PlayerSetup';
import TeamSetup from './TeamSetup';
import GameHistory from './GameHistory';
import TournamentManagement from './TournamentManagement';
import { TournamentScheduler } from './TournamentScheduler';
import TournamentMessaging from './TournamentMessaging';
import CombinedResultsPage from './CombinedResultsPage';
import { BracketGenerator } from './BracketGenerator';
import { GameFlowManager } from './GameFlowManager';
import FinanceManager from './FinanceManager';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppContext } from '@/contexts/AppContext';
import { Users, History, RotateCcw, Settings, Calendar, MessageSquare, Award, Target, Monitor, DollarSign } from 'lucide-react';

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
      <div className="max-w-6xl mx-auto space-y-6">
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

        <Tabs defaultValue="game-flow" className="w-full">
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-9 gap-1">
            <TabsTrigger value="game-flow" className="flex items-center gap-1 text-xs md:text-sm px-1 md:px-3">
              <Monitor size={14} className="md:size-4" />
              <span className="hidden sm:inline">Game Flow</span>
              <span className="sm:hidden">Game</span>
            </TabsTrigger>
            <TabsTrigger value="teams" className="flex items-center gap-1 text-xs md:text-sm px-1 md:px-3">
              <Users size={14} className="md:size-4" />
              <span className="hidden sm:inline">Teams</span>
              <span className="sm:hidden">Team</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-1 text-xs md:text-sm px-1 md:px-3">
              <Calendar size={14} className="md:size-4" />
              <span className="hidden sm:inline">Schedule</span>
              <span className="sm:hidden">Sched</span>
            </TabsTrigger>
            <TabsTrigger value="messaging" className="flex items-center gap-1 text-xs md:text-sm px-1 md:px-3 md:block hidden">
              <MessageSquare size={14} className="md:size-4" />
              <span className="hidden sm:inline">Messages</span>
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-1 text-xs md:text-sm px-1 md:px-3 md:block hidden">
              <Award size={14} className="md:size-4" />
              <span className="hidden sm:inline">Results</span>
            </TabsTrigger>
            <TabsTrigger value="bracket" className="flex items-center gap-1 text-xs md:text-sm px-1 md:px-3 md:block hidden">
              <Target size={14} className="md:size-4" />
              <span className="hidden sm:inline">Bracket</span>
            </TabsTrigger>
            <TabsTrigger value="finance" className="flex items-center gap-1 text-xs md:text-sm px-1 md:px-3 md:block hidden">
              <DollarSign size={14} className="md:size-4" />
              <span className="hidden sm:inline">Finance</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1 text-xs md:text-sm px-1 md:px-3 md:block hidden">
              <History size={14} className="md:size-4" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
            <TabsTrigger value="admin" className="flex items-center gap-1 text-xs md:text-sm px-1 md:px-3 md:block hidden">
              <Settings size={14} className="md:size-4" />
              <span className="hidden sm:inline">Admin</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="game-flow" className="mt-6">
            <GameFlowManager />
          </TabsContent>
          
          <TabsContent value="teams" className="mt-6">
            <TeamSetup />
          </TabsContent>
          
          <TabsContent value="schedule" className="mt-6">
            <TournamentScheduler />
          </TabsContent>
          
          <TabsContent value="messaging" className="mt-6">
            <TournamentMessaging />
          </TabsContent>
          
          <TabsContent value="results" className="mt-6">
            <CombinedResultsPage />
          </TabsContent>
          
          <TabsContent value="bracket" className="mt-6">
            <BracketGenerator />
          </TabsContent>
          
          <TabsContent value="finance" className="mt-6">
            <FinanceManager />
          </TabsContent>
          
          <TabsContent value="history" className="mt-6">
            <GameHistory />
          </TabsContent>
          
          <TabsContent value="admin" className="mt-6">
            <TournamentManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AppLayout;