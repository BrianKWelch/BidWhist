import React, { useState } from 'react';
import { toast } from '@/components/ui/use-toast';
import { sampleTeams } from './AppContextTeams';
import { AppContext, Team, Game, Tournament, TournamentSchedule, ScoreText, TournamentResult, ScoreSubmission, Bracket } from './AppContext';
import { createTournamentResultMethods } from './AppContextMethods';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [teams, setTeams] = useState<Team[]>(sampleTeams);
  const [games, setGames] = useState<Game[]>([]);
  const [scoreSubmissions, setScoreSubmissions] = useState<ScoreSubmission[]>([]);
  
  const createFullTournamentSchedule = (currentTeams: Team[]) => {
    const matches = [];
    const numTeams = currentTeams.length;
    
    // Round 1 - pair up all teams
    for (let i = 0; i < numTeams - 1; i += 2) {
      if (currentTeams[i] && currentTeams[i + 1]) {
        matches.push({
          id: `round1-match-${Math.floor(i/2) + 1}`,
          teamA: currentTeams[i].id,
          teamB: currentTeams[i + 1].id,
          round: 1,
          tournamentId: '1'
        });
      }
    }
    
    // Create placeholder matches for rounds 2-4
    const round1Matches = Math.floor(numTeams / 2);
    for (let round = 2; round <= 4; round++) {
      const matchesInRound = Math.max(1, Math.floor(round1Matches / Math.pow(2, round - 1)));
      for (let i = 0; i < matchesInRound; i++) {
        matches.push({
          id: `round${round}-match-${i + 1}`,
          teamA: 'TBD',
          teamB: 'TBD',
          round,
          tournamentId: '1'
        });
      }
    }
    
    return { matches, rounds: 4 };
  };
  
  const initialSchedule = createFullTournamentSchedule(sampleTeams);
  const [schedules, setSchedules] = useState<TournamentSchedule[]>([
    {
      tournamentId: '1',
      rounds: initialSchedule.rounds,
      matches: initialSchedule.matches
    }
  ]);
  
  const [scoreTexts, setScoreTexts] = useState<ScoreText[]>([]);
  const [tournamentResults, setTournamentResults] = useState<{ [tournamentId: string]: TournamentResult[] }>({});
  const [brackets, setBrackets] = useState<{ [tournamentId: string]: Bracket }>({});
  const [cities, setCities] = useState<string[]>(['Columbus', 'Cincinnati', 'Chicago', 'Detroit', 'Atlanta', 'DC/Maryland', 'Other']);
  const [tournaments, setTournaments] = useState<Tournament[]>([
    { id: '1', name: '2025 New Year Classic', cost: 30, bostonPotCost: 10 },
    { id: '2', name: '2025 Winter Championship', cost: 40, bostonPotCost: 10 }
  ]);
  const [currentUser, setCurrentUser] = useState('');

  const { updateTournamentResult, getTournamentResults, formatTeamName } = createTournamentResultMethods(
    tournamentResults, setTournamentResults, teams
  );

  const submitGame = (gameData: any) => {
    const matchId = gameData.matchId;
    const teamId = gameData.submittedBy;
    
    const existingSubmissions = scoreSubmissions.filter(s => s.matchId === matchId);
    const mySubmission = existingSubmissions.find(s => s.submittedBy === teamId);
    const opponentSubmission = existingSubmissions.find(s => s.submittedBy !== teamId);
    
    const newSubmission: ScoreSubmission = {
      id: mySubmission?.id || Date.now().toString(),
      matchId,
      teamA: gameData.teamA,
      teamB: gameData.teamB,
      scoreA: gameData.scoreA,
      scoreB: gameData.scoreB,
      boston: gameData.boston,
      submittedBy: teamId,
      timestamp: new Date(),
      round: gameData.round
    };
    
    if (mySubmission) {
      setScoreSubmissions(prev => prev.map(s => 
        s.id === mySubmission.id ? newSubmission : s
      ));
    } else {
      setScoreSubmissions(prev => [...prev, newSubmission]);
    }
    
    if (opponentSubmission && 
        opponentSubmission.scoreA === gameData.scoreA && 
        opponentSubmission.scoreB === gameData.scoreB) {
      
      const confirmedGame: Game = {
        id: Date.now().toString(),
        teamA: gameData.teamA,
        teamB: gameData.teamB,
        scoreA: gameData.scoreA,
        scoreB: gameData.scoreB,
        teamAScore: gameData.scoreA,
        teamBScore: gameData.scoreB,
        boston: gameData.boston,
        winner: gameData.scoreA > gameData.scoreB ? 'teamA' : 'teamB',
        submittedBy: 'Both Teams',
        confirmed: true,
        timestamp: new Date(),
        matchId,
        round: gameData.round
      };
      
      setGames(prev => [...prev.filter(g => g.matchId !== matchId), confirmedGame]);
      setScoreSubmissions(prev => prev.filter(s => s.matchId !== matchId));
      
      const tournamentId = '1';
      const winnerTeam = gameData.scoreA > gameData.scoreB ? gameData.teamA : gameData.teamB;
      const loserTeam = gameData.scoreA > gameData.scoreB ? gameData.teamB : gameData.teamA;
      const winnerScore = Math.max(gameData.scoreA, gameData.scoreB);
      const loserScore = Math.min(gameData.scoreA, gameData.scoreB);
      
      updateTournamentResult(tournamentId, winnerTeam.id, gameData.round, 'wl', 'W');
      updateTournamentResult(tournamentId, winnerTeam.id, gameData.round, 'points', winnerScore);
      updateTournamentResult(tournamentId, loserTeam.id, gameData.round, 'wl', 'L');
      updateTournamentResult(tournamentId, loserTeam.id, gameData.round, 'points', loserScore);
      
      if (gameData.boston === (gameData.scoreA > gameData.scoreB ? 'teamA' : 'teamB')) {
        updateTournamentResult(tournamentId, winnerTeam.id, gameData.round, 'boston', 1);
      }
      if (gameData.boston === (gameData.scoreA > gameData.scoreB ? 'teamB' : 'teamA')) {
        updateTournamentResult(tournamentId, loserTeam.id, gameData.round, 'boston', 1);
      }
      
      if (gameData.round < 4) {
        setSchedules(prev => prev.map(schedule => {
          if (schedule.tournamentId === tournamentId) {
            const updatedMatches = schedule.matches.map(match => {
              if (match.round === gameData.round + 1) {
                const currentRoundMatches = schedule.matches.filter(m => m.round === gameData.round);
                const currentMatchIndex = currentRoundMatches.findIndex(m => m.id === matchId);
                const nextRoundMatches = schedule.matches.filter(m => m.round === gameData.round + 1);
                const targetMatchIndex = Math.floor(currentMatchIndex / 2);
                const targetMatch = nextRoundMatches[targetMatchIndex];
                
                if (match.id === targetMatch?.id) {
                  if (currentMatchIndex % 2 === 0) {
                    return { ...match, teamA: winnerTeam.id };
                  } else {
                    return { ...match, teamB: winnerTeam.id };
                  }
                }
              }
              return match;
            });
            return { ...schedule, matches: updatedMatches };
          }
          return schedule;
        }));
      }
      
      toast({ title: 'Score confirmed! Results updated.' });
    } else {
      if (opponentSubmission) {
        toast({ 
          title: 'Score Conflict', 
          description: 'Scores dont match. Please resolve with opponent.',
          variant: 'destructive'
        });
      } else {
        toast({ 
          title: 'Score Submitted', 
          description: 'Waiting for opponent to confirm.' 
        });
      }
    }
  };

  return (
    <AppContext.Provider value={{
      sidebarOpen, toggleSidebar: () => setSidebarOpen(prev => !prev), teams, games, tournaments, schedules, scoreTexts, tournamentResults, brackets, cities, currentUser, setCurrentUser, scoreSubmissions,
      addTeam: (player1First: string, player1Last: string, player2First: string, player2Last: string, phoneNumber: string, city: string, selectedTournaments: string[], bostonPotTournaments: string[]) => {
        const player1Name = formatTeamName(player1First, player1Last);
        const player2Name = formatTeamName(player2First, player2Last);
        const teamName = `${player1Name}/${player2Name}`;
        const nextTeamNumber = Math.max(...teams.map(t => t.teamNumber || 0)) + 1;
        
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
        
        setTeams(prev => {
          const updated = [...prev, newTeam];
          const newSchedule = createFullTournamentSchedule(updated);
          setSchedules([{
            tournamentId: '1',
            rounds: newSchedule.rounds,
            matches: newSchedule.matches
          }]);
          return updated;
        });
        
        toast({ title: `Team ${teamName} registered successfully!` });
        return newTeam.id;
      },
      updateTeam: (updatedTeam: Team) => { setTeams(prev => prev.map(team => team.id === updatedTeam.id ? updatedTeam : team)); },
      submitGame,
      confirmGame: (gameId: string, confirmedBy: string) => { setGames(prev => prev.map(game => game.id === gameId ? { ...game, confirmed: true, confirmedBy } : game)); },
      updateGameScore: (matchId: string, teamAScore: number, teamBScore: number) => {},
      saveSchedule: (schedule: TournamentSchedule) => { setSchedules(prev => [...prev.filter(s => s.tournamentId !== schedule.tournamentId), schedule]); },
      addScoreText: (scoreText: ScoreText) => { setScoreTexts(prev => [...prev, scoreText]); },
      updateScoreText: (id: string, updates: any) => { setScoreTexts(prev => prev.map(text => text.id === id ? { ...text, ...updates } : text)); },
      getPendingGames: () => games.filter(game => !game.confirmed),
      getTeamStats: () => ({ wins: 0, losses: 0, totalPoints: 0, bostons: 0 }),
      updateTournamentResult, getTournamentResults,
      addTournament: () => {}, updateTournament: () => {}, updatePaymentStatus: () => {}, updatePlayerPaymentStatus: () => {}, updatePlayerTournamentPayment: () => {}, updateTeamPayment: () => {}, sendScoreSheetLinks: async () => {}, submitScore: async () => {}, confirmScore: async () => {}, saveBracket: () => {}, getBracket: () => null, updateBracket: () => {}, deleteBracket: () => {}, addCity: () => {}, removeCity: () => {}, updateCities: () => {}
    }}>
      {children}
    </AppContext.Provider>
  );
};