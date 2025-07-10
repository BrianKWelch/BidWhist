import React, { useState, useEffect, useCallback } from 'react';
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

  // Example: getCurrentTeam (if needed elsewhere)
  const getCurrentTeam = useCallback(
    () => teams.find(t => t.id === currentUser || t.phoneNumber === currentUser),
    [teams, currentUser]
  );

  // All your other CRUD methods go here (addTeam, updateTeam, etc) ...
  // See previous code block for examples!

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
      // CRUD helpers...
      // e.g., addTeam, updateTeam, addGame, etc.
      getActiveTournament,  // <-- THE IMPORTANT PART
      getCurrentTeam,       // <-- if you want this helper
    }}>
      {children}
    </AppContext.Provider>
  );
};
