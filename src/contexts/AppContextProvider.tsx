import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api';
import { AppContext, Team, Game, Tournament, TournamentSchedule, ScoreText, TournamentResult, ScoreSubmission, Bracket } from './AppContext';
// ... import your API helpers and any needed UI

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  // Fetch data from backend
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

  // --- Helper functions your app expects! ---
  const getActiveTournament = useCallback(
    () => tournaments.find(t => t.status === 'active'),
    [tournaments]
  );

  const getCurrentTeam = useCallback(
    () => teams.find(t => t.id === currentUser || t.phoneNumber === currentUser),
    [teams, currentUser]
  );

  // --- Team CRUD ---
  const addTeam = async (team: Omit<Team, 'id'>): Promise<Team | null> => {
    try {
      const newTeam = await apiPost<Team>('/.netlify/functions/get-teams', team);
      setTeams(prev => [...prev, newTeam]);
      return newTeam;
    } catch (err) {
      console.error('Failed to add team:', err);
      return null;
    }
  };

  const updateTeam = async (team: Team): Promise<Team | null> => {
    try {
      const updated = await apiPut<Team>(`/.netlify/functions/get-teams/${team.id}`, team);
      setTeams(prev => prev.map(t => t.id === team.id ? updated : t));
      return updated;
    } catch (err) {
      console.error('Failed to update team:', err);
      return null;
    }
  };

  const removeTeam = async (teamId: string): Promise<boolean> => {
    try {
      await apiDelete(`/.netlify/functions/get-teams/${teamId}`);
      setTeams(prev => prev.filter(t => t.id !== teamId));
      return true;
    } catch (err) {
      console.error('Failed to remove team:', err);
      return false;
    }
  };

  // --- City Management ---
  const addCity = (city: string) => {
    if (!city.trim()) return;
    if (!cities.includes(city)) {
      setCities(prev => [...prev, city]);
    }
  };

  const removeCity = (city: string) => {
    setCities(prev => prev.filter(c => c !== city));
  };

  const updateCities = (newCities: string[]) => {
    setCities(newCities);
  };

  return (
    <AppContext.Provider value={{
      sidebarOpen,
      toggleSidebar: () => setSidebarOpen(prev => !prev),
      teams,
      games,
      tournaments,
      setTournaments,
      schedules,
      scoreTexts,
      tournamentResults,
      brackets,
      cities,
      currentUser,
      setCurrentUser,
      scoreSubmissions,
      getActiveTournament,
      getCurrentTeam,
      addTeam,
      updateTeam,
      removeTeam,
      addCity,
      removeCity,
      updateCities,
    }}>
      {children}
    </AppContext.Provider>
  );
};
