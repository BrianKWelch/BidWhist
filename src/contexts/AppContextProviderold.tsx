import React, { useState, useEffect, useCallback } from 'react';
import { toast } from '@/components/ui/use-toast';
import { AppContext, Team, Game, Tournament, TournamentSchedule, ScoreText, TournamentResult, ScoreSubmission, Bracket } from './AppContext';
import { createTournamentResultMethods } from './AppContextMethods';
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api';

const DebugDownloadButton: React.FC = () => null; // Remove or keep as needed

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Centralized state
  const [teams, setTeams] = useState<Team[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [scoreSubmissions, setScoreSubmissions] = useState<ScoreSubmission[]>([]);
  const [schedules, setSchedules] = useState<TournamentSchedule[]>([]);
  const [brackets, setBrackets] = useState<{ [tournamentId: string]: Bracket }>({});
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [scoreTexts, setScoreTexts] = useState<ScoreText[]>([]);
  const [tournamentResults, setTournamentResults] = useState<{ [tournamentId: string]: TournamentResult[] }>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState('');

  // Fetch all data on mount
  useEffect(() => {
    (async () => {
      try {
        const [
          teamsData,
          gamesData,
          scoreSubmissionsData,
          schedulesData,
          bracketsData,
          tournamentsData,
        ] = await Promise.all([
          apiGet<Team[]>('/.netlify/functions/get-teams').catch(() => []),
          apiGet<Game[]>('/.netlify/functions/get-games').catch(() => []),
          apiGet<ScoreSubmission[]>('/.netlify/functions/get-score-submissions').catch(() => []),
          apiGet<TournamentSchedule[]>('/.netlify/functions/get-schedules').catch(() => []),
          apiGet<{ [tournamentId: string]: Bracket }>('/.netlify/functions/get-brackets').catch(() => ({})),
          apiGet<Tournament[]>('/.netlify/functions/get-tournaments').catch(() => []),
        ]);
        setTeams(teamsData);
        setGames(gamesData);
        setScoreSubmissions(scoreSubmissionsData);
        setSchedules(schedulesData);
        setBrackets(bracketsData);
        setTournaments(tournamentsData);
        setCities([...new Set(teamsData.map(t => t.city))]);
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    })();
  }, []);

  // --- CRUD helpers for each entity ---

  // Teams
  const addTeam = async (...args) => {
    // ...existing code to build newTeam...
    const [player1First, player1Last, player2First, player2Last, phoneNumber, city, selectedTournaments, bostonPotTournaments] = args;
    const player1Name = player1First + (player1Last ? ` ${player1Last}` : '');
    const player2Name = player2First + (player2Last ? ` ${player2Last}` : '');
    const teamName = `${player1Name}/${player2Name}`;
    const nextTeamNumber = Math.max(0, ...teams.map(t => t.teamNumber || 0)) + 1;
    const newTeam: Team = {
      id: Date.now().toString(),
      teamNumber: nextTeamNumber,
      name: teamName,
      player1FirstName: player1First,
      player1LastName: player1Last,
      player2FirstName: player2First,
      player2LastName: player2Last,
      phoneNumber,
      city,
      registeredTournaments: selectedTournaments,
      bostonPotTournaments,
      paymentStatus: 'pending',
      player1PaymentStatus: 'pending',
      player2PaymentStatus: 'pending'
    };
    try {
      const saved = await apiPost<Team>('/.netlify/functions/add-team', newTeam);
      setTeams(prev => [...prev, saved]);
      toast({ title: `Team ${teamName} registered successfully!` });
      return saved.id;
    } catch (err) {
      console.error('Add team failed:', err);
    }
  };

  const updateTeam = async (updatedTeam: Team) => {
    try {
      const saved = await apiPut<Team>(`/.netlify/functions/update-team?id=${updatedTeam.id}`, updatedTeam);
      setTeams(prev => prev.map(team => team.id === updatedTeam.id ? saved : team));
    } catch (err) {
      console.error('Update team failed:', err);
    }
  };

  // Games
  const addGame = async (game: Game) => {
    try {
      const saved = await apiPost<Game>('/.netlify/functions/add-game', game);
      setGames(prev => [...prev, saved]);
    } catch (err) {
      console.error('Add game failed:', err);
    }
  };

  const updateGame = async (updatedGame: Game) => {
    try {
      const saved = await apiPut<Game>(`/.netlify/functions/update-game?id=${updatedGame.id}`, updatedGame);
      setGames(prev => prev.map(game => game.id === updatedGame.id ? saved : game));
    } catch (err) {
      console.error('Update game failed:', err);
    }
  };

  // Score Submissions
  const addScoreSubmission = async (submission: ScoreSubmission) => {
    try {
      const saved = await apiPost<ScoreSubmission>('/.netlify/functions/add-score-submission', submission);
      setScoreSubmissions(prev => [...prev, saved]);
    } catch (err) {
      console.error('Add score submission failed:', err);
    }
  };

  const updateScoreSubmission = async (updated: ScoreSubmission) => {
    try {
      const saved = await apiPut<ScoreSubmission>(`/.netlify/functions/update-score-submission?id=${updated.id}`, updated);
      setScoreSubmissions(prev => prev.map(s => s.id === updated.id ? saved : s));
    } catch (err) {
      console.error('Update score submission failed:', err);
    }
  };

  // Schedules
  const saveSchedule = async (schedule: TournamentSchedule) => {
    try {
      const saved = await apiPost<TournamentSchedule>('/.netlify/functions/save-schedule', schedule);
      setSchedules(prev => [...prev.filter(s => s.tournamentId !== saved.tournamentId), saved]);
    } catch (err) {
      console.error('Save schedule failed:', err);
    }
  };

  // Brackets
  const saveBracket = async (bracket: Bracket) => {
    try {
      const saved = await apiPost<Bracket>('/.netlify/functions/save-bracket', bracket);
      setBrackets(prev => ({ ...prev, [bracket.tournamentId]: saved }));
    } catch (err) {
      console.error('Save bracket failed:', err);
    }
  };

  // Tournaments
  const addTournament = async (name: string, cost: number, bostonPotCost: number, description?: string) => {
    const newTournament: Tournament = {
      id: Date.now().toString(),
      name,
      cost,
      bostonPotCost,
      description,
      status: 'active'
    };
    try {
      const saved = await apiPost<Tournament>('/.netlify/functions/add-tournament', newTournament);
      setTournaments(prev => [
        ...prev.map(t => ({ ...t, status: 'finished' as 'finished' })),
        { ...saved, status: 'active' as 'active' }
      ]);
      toast({ title: `Tournament "${name}" added and set as active!` });
    } catch (err) {
      console.error('Add tournament failed:', err);
    }
  };

  // ...other methods (confirmGame, updateTournament, etc.) should be similarly updated to use API...

  // Example: getActiveTournament, finishTournament, etc. can remain as before, but update state via API as needed.

  // Tournament results, cities, and other local-only state can remain as is for now.

  // Provide all state and actions via context
  return (
    <AppContext.Provider value={{
      sidebarOpen, toggleSidebar: () => setSidebarOpen(prev => !prev), teams, games, tournaments, setTournaments, schedules, scoreTexts, tournamentResults, brackets, cities, currentUser, setCurrentUser, scoreSubmissions,
      addTeam,
      updateTeam,
      addGame,
      updateGame,
      addScoreSubmission,
      updateScoreSubmission,
      saveSchedule,
      saveBracket,
      addTournament,
      // ...other methods as before, updated to use API...
    }}>
      {children}
      {/* <DebugDownloadButton /> */}
    </AppContext.Provider>
  );
};