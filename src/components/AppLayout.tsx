import React, { useState } from 'react';
import PlayerSetup from './PlayerSetup';
import TeamBuilder from './TeamBuilder';
import PlayerRegistration from './PlayerRegistration';
import TeamsByTournament from './TeamsByTournament';
import TeamPayments from './TeamPayments';
import TeamPaymentDetails from './TeamPaymentDetails';
import IndividualPlayerPaymentsPage from './IndividualPlayerPaymentsPage';
import GameHistory from './GameHistory';
import TournamentManagement from './TournamentManagement';
import CityManager from './CityManager';
import MessageManager from './MessageManager';
import { TournamentScheduler } from './TournamentScheduler';
import CombinedResultsPage from './CombinedResultsPage';
import { BracketGenerator } from './BracketGenerator';
import FinanceManager from './FinanceManager';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppContext } from '@/contexts/AppContext';
import {
  Users, History, RotateCcw, Settings, Calendar,
  MessageSquare, Award, CalendarClock, DollarSign, Search,
  UserPlus, Trophy
} from 'lucide-react';
import { BracketIcon, CommandCenterIcon, ResultsIcon, CityIcon, GoIcon, RefreshIcon, MessageIcon, ScheduleIcon, DollarIcon } from './icons/CustomIcons';
import { toast } from '@/hooks/use-toast';
import PlayerTracking from './PlayerTracking';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, info: any) {
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

const AppLayout = () => {
  const {
    currentUser, getActiveTournament, setActiveTournament,
    tournaments, setTournaments, refreshGamesFromSupabase,
    refreshSchedules, refreshTeams
  } = useAppContext();

  const [showSetup, setShowSetup] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTeamForPayments, setSelectedTeamForPayments] = useState<string | null>(null);
  const [selectedPlayerForPayments, setSelectedPlayerForPayments] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("teams");

  const handleAdminRefresh = async () => {
    try {
      setRefreshing(true);
      await Promise.all([
        refreshGamesFromSupabase(),
        refreshSchedules(),
        refreshTeams(),
        (async () => {
          const { supabase } = await import('../supabaseClient');
          const { data: tournamentsData, error } = await supabase.from('tournaments').select('*');
          if (!error && tournamentsData) {
            // Map boston_pot_cost to bostonPotCost and tracks_hands to tracksHands for frontend use
            const mappedTournaments = tournamentsData.map(t => ({
              ...t,
              bostonPotCost: t.boston_pot_cost,
              tracksHands: t.tracks_hands !== false
            }));
            setTournaments(mappedTournaments);
          }
        })()
      ]);
      toast({
        title: "Data refreshed successfully",
        description: "All tournament data, teams, payments, and schedules have been updated",
        variant: "default"
      });
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast({
        title: "Refresh failed",
        description: "Some data may not have been updated",
        variant: "destructive"
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleSetupComplete = () => setShowSetup(false);

  const handleSetActiveTournament = (tournamentId: string) => {
    setActiveTournament(tournamentId);
  };

  if (showSetup || !currentUser) {
    return <PlayerSetup onSetupComplete={handleSetupComplete} />;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-100">
        {/* Top + Sidebar Logo Cell */}
        <div className="flex">
          {/* Top-left cell: Logo block */}
          <div className="w-20 h-20 bg-red-200 flex items-center justify-center shadow-md">
            <img src={import.meta.env.BASE_URL + 'SetPlay_Logo.png'} alt="SetPlay Logo" className="w-20 h-20" />
          </div>

          {/* Header */}
          <div className="flex-1 bg-white shadow-md sticky top-0 z-10 px-6 py-3 flex items-center justify-between">
            {/* Title */}
            <h1 className="text-2xl font-bold text-gray-800">Admin Panel</h1>

            {/* Dropdowns */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700 font-medium">Manage:</label>
                <select
                  className="border border-gray-300 rounded px-3 py-1 text-sm text-gray-800 bg-white"
                  value={getActiveTournament()?.id || ''}
                  onChange={e => handleSetActiveTournament(e.target.value)}
                >
                  <option value="" disabled>Select tournament...</option>
                  {tournaments.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700 font-medium">Active:</label>
                <select
                  className="border border-gray-300 rounded px-3 py-1 text-sm text-gray-800 bg-white"
                  value={getActiveTournament()?.id || ''}
                  onChange={e => handleSetActiveTournament(e.target.value)}
                >
                  <option value="" disabled>Select tournament...</option>
                  {tournaments.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAdminRefresh}
                disabled={refreshing}
                className="text-gray-600 hover:text-red-600"
              >
                <RefreshIcon />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open('#/portal?admin=1', '_blank')}
                className="text-gray-600 hover:text-red-600"
              >
                <GoIcon />
              </Button>
            </div>
          </div>
        </div>

        {/* Main Layout */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full">
          <div className="flex">
            {/* Sidebar */}
            <div className="w-20 flex-shrink-0 bg-white shadow-md pt-2 h-screen">
              <TabsList className="flex flex-col gap-1 w-full items-center p-2 mt-64">
                                 {[
                   ['teams', <CommandCenterIcon />],
                   ['schedule', <ScheduleIcon />],
                   ['results', <ResultsIcon />],
                   ['bracket', <BracketIcon />],
                   ['finance', <DollarIcon />],
                   ['cities', <CityIcon />],
                   ['messaging', <MessageIcon />],
                 ].map(([val, icon]) => (
                  <TabsTrigger
                    key={val as string}
                    value={val as string}
                    className="text-red-600 hover:text-red-600 hover:bg-gray-200 data-[state=active]:bg-gray-100 data-[state=active]:text-black w-full p-3 flex justify-center"
                  >
                    {icon}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* Tabs Content */}
            <div className="flex-1 p-4">
              <TabsContent value="teams"><TeamBuilder 
                onTeamPaymentClick={(teamId) => {
                  setSelectedTeamForPayments(teamId);
                  setActiveTab("team-payment-details");
                }}
                onIndividualPlayerPaymentClick={(playerId) => {
                  setSelectedPlayerForPayments(playerId);
                  setActiveTab("individual-player-payments");
                }}
              /></TabsContent>
              <TabsContent value="teams-by-tournament"><TeamsByTournament /></TabsContent>
              <TabsContent value="team-payments"><TeamPayments /></TabsContent>
              <TabsContent value="team-payment-details"><TeamPaymentDetails teamId={selectedTeamForPayments} onBackToCommandCenter={() => setActiveTab("teams")} /></TabsContent>
              <TabsContent value="individual-player-payments"><IndividualPlayerPaymentsPage playerId={selectedPlayerForPayments} onBackToCommandCenter={() => setActiveTab("teams")} /></TabsContent>

              <TabsContent value="registration"><PlayerRegistration /></TabsContent>
              <TabsContent value="schedule"><TournamentScheduler /></TabsContent>
              <TabsContent value="results"><CombinedResultsPage /></TabsContent>
              <TabsContent value="bracket"><BracketGenerator /></TabsContent>
              <TabsContent value="finance"><FinanceManager /></TabsContent>
              <TabsContent value="player-tracking"><PlayerTracking /></TabsContent>
              <TabsContent value="history"><GameHistory /></TabsContent>
              <TabsContent value="cities"><CityManager /></TabsContent>
              <TabsContent value="messaging"><MessageManager /></TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
    </ErrorBoundary>
  );
};

export default AppLayout;
