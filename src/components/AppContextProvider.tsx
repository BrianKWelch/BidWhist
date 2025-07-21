// This file has been renamed to AppContextProvider.old.tsx to avoid confusion.
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { toast } from '@/components/ui/use-toast';
import { sampleTeams } from './AppContextTeams';
import { AppContext, Team, Game, Tournament, TournamentSchedule, ScoreText, TournamentResult, ScoreSubmission, Bracket } from './AppContext';
import { createTournamentResultMethods } from './AppContextMethods';

export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Confirm provider is mounting and Supabase test query is running
  useEffect(() => {
    // ...removed debug log...
    supabase.from('teams').select('*').limit(1).then(result => {
      // ...removed debug log...
    });
  }, []);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [teams, setTeams] = useState<Team[]>(sampleTeams);
  const [games, setGames] = useState<Game[]>([]);
  const [scoreSubmissions, setScoreSubmissions] = useState<ScoreSubmission[]>([]);
  
  const createScheduleMatches = (currentTeams: Team[]) => {
    const matches = [];
    for (let i = 0; i < currentTeams.length - 1; i += 2) {
      if (currentTeams[i] && currentTeams[i + 1]) {
        matches.push({
          id: `match-${i + 1}`,
          teamA: currentTeams[i].id,
          teamB: currentTeams[i + 1].id,
          round: 1,
          tournamentId: '1'
        });
      }
    }
    return matches;
  };
  
  const [schedules, setSchedules] = useState<TournamentSchedule[]>([
    {
      tournamentId: '1',
      rounds: 4,
      matches: [
        ...createScheduleMatches(sampleTeams),
        { id: 'round2-1', teamA: 'TBD', teamB: 'TBD', round: 2, tournamentId: '1' },
        { id: 'round3-1', teamA: 'TBD', teamB: 'TBD', round: 3, tournamentId: '1' },
        { id: 'round4-1', teamA: 'TBD', teamB: 'TBD', round: 4, tournamentId: '1' }
      ]
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

  // Function to delete a team by ID
  const deleteTeam = (teamId: string) => {
    setTeams(prev => {
      const updated = prev.filter(team => team.id !== teamId);
      localStorage.setItem('teams', JSON.stringify(updated));
      return updated;
    });
  };

  const { updateTournamentResult, getTournamentResults, formatTeamName } = createTournamentResultMethods(
    tournamentResults, setTournamentResults, teams
  );

  const submitGame = (gameData: any) => {
    const matchId = gameData.matchId;
    const teamId = gameData.submittedBy;
    
    const existingSubmissions = scoreSubmissions.filter(s => s.matchId === matchId);
    const mySubmission = existingSubmissions.find(s => s.submittedBy === teamId);
    const opponentSubmission = existingSubmissions.find(s => s.submittedBy !== teamId);
    
    if (mySubmission) {
      setScoreSubmissions(prev => prev.map(s => 
        s.id === mySubmission.id ? {
          ...s,
          scoreA: gameData.scoreA,
          scoreB: gameData.scoreB,
          boston: gameData.boston,
          timestamp: new Date()
        } : s
      ));
    } else {
      const newSubmission: ScoreSubmission = {
        id: Date.now().toString(),
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
      setScoreSubmissions(prev => [...prev, newSubmission]);
    }
    
    if (opponentSubmission) {
      if (opponentSubmission.scoreA === gameData.scoreA && opponentSubmission.scoreB === gameData.scoreB) {
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
        
        // Update tournament results automatically
        const tournamentId = gameData.teamA.registeredTournaments?.[0] || '1';
        const winnerTeam = gameData.scoreA > gameData.scoreB ? gameData.teamA : gameData.teamB;
        const loserTeam = gameData.scoreA > gameData.scoreB ? gameData.teamB : gameData.teamA;
        const winnerScore = Math.max(gameData.scoreA, gameData.scoreB);
        const loserScore = Math.min(gameData.scoreA, gameData.scoreB);
        
        // Update winner
        updateTournamentResult(tournamentId, winnerTeam.id, gameData.round, 'wl', 'W');
        updateTournamentResult(tournamentId, winnerTeam.id, gameData.round, 'points', winnerScore);
        if (gameData.boston === (gameData.scoreA > gameData.scoreB ? 'teamA' : 'teamB')) {
          updateTournamentResult(tournamentId, winnerTeam.id, gameData.round, 'boston', 1);
        }
        
        // Update loser
        updateTournamentResult(tournamentId, loserTeam.id, gameData.round, 'wl', 'L');
        updateTournamentResult(tournamentId, loserTeam.id, gameData.round, 'points', loserScore);
        if (gameData.boston === (gameData.scoreA > gameData.scoreB ? 'teamB' : 'teamA')) {
          updateTournamentResult(tournamentId, loserTeam.id, gameData.round, 'boston', 1);
        }
        
        // Update schedule with next round matches
        if (gameData.round < 4) {
          setSchedules(prev => prev.map(schedule => {
            if (schedule.tournamentId === tournamentId) {
              const updatedMatches = schedule.matches.map(match => {
                if (match.round === gameData.round + 1) {
                  if (match.teamA === 'TBD') {
                    return { ...match, teamA: winnerTeam.id };
                  } else if (match.teamB === 'TBD') {
                    return { ...match, teamB: winnerTeam.id };
                  }
                }
                return match;
              });
              return { ...schedule, matches: updatedMatches };
            }
            return schedule;
          }));
        }
        
        toast({ title: 'Score confirmed! Game added to results.' });
      } else {
        toast({ 
          title: 'Score Conflict!', 
          description: 'Scores don\'t match. Please resolve with your opponent.',
          variant: 'destructive'
        });
      }
    } else {
      toast({ 
        title: 'Score Submitted', 
        description: 'Waiting for opponent to confirm score.' 
      });
    }
  };

  return (
    <AppContext.Provider value={{
      sidebarOpen,
      toggleSidebar: () => setSidebarOpen(prev => !prev),
      teams,
      games,
      tournaments,
      schedules,
      scoreTexts,
      tournamentResults,
      brackets,
      cities,
      currentUser,
      setCurrentUser,
      scoreSubmissions,
      addTeam: (player1First: string, player1Last: string, player2First: string, player2Last: string, phoneNumber: string, city: string, selectedTournaments: string[], bostonPotTournaments: string[]) => {
        const teamName = `${player1First}/${player2First}`;
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
          setSchedules(prevSchedules => [{
            tournamentId: '1',
            rounds: 4,
            matches: [
              ...createScheduleMatches(updated),
              { id: 'round2-1', teamA: 'TBD', teamB: 'TBD', round: 2, tournamentId: '1' },
              { id: 'round3-1', teamA: 'TBD', teamB: 'TBD', round: 3, tournamentId: '1' },
              { id: 'round4-1', teamA: 'TBD', teamB: 'TBD', round: 4, tournamentId: '1' }
            ]
          }]);
          return updated;
        });
        toast({ title: `Team ${teamName} registered successfully!` });
        return newTeam.id;
      },
      updateTeam: async (updatedTeam: Team) => {
        // Always recalculate team name as Player1FirstName/Player2FirstName
        const newName = `${updatedTeam.player1FirstName}/${updatedTeam.player2FirstName}`;
        setTeams(prev => prev.map(team => team.id === updatedTeam.id ? { ...updatedTeam, name: newName } : team));
        // Update in Supabase as well
        const { error } = await supabase
          .from('teams')
          .update({
            name: newName,
            player1FirstName: updatedTeam.player1FirstName,
            player2FirstName: updatedTeam.player2FirstName,
            player1LastName: updatedTeam.player1LastName,
            player2LastName: updatedTeam.player2LastName,
            phoneNumber: updatedTeam.phoneNumber,
            city: updatedTeam.city
          })
          .eq('id', updatedTeam.id);
        if (error) {
          toast({ title: 'Failed to update team in database', description: error.message, variant: 'destructive' });
        }
      },
      deleteTeam, // Added for team deletion
      submitGame,
      confirmGame: (gameId: string, confirmedBy: string) => { setGames(prev => prev.map(game => game.id === gameId ? { ...game, confirmed: true, confirmedBy } : game)); },
      updateGameScore: (matchId: string, teamAScore: number, teamBScore: number) => {},
      saveSchedule: (schedule: TournamentSchedule) => { setSchedules(prev => [...prev.filter(s => s.tournamentId !== schedule.tournamentId), schedule]); },
      addScoreText: (scoreText: ScoreText) => { setScoreTexts(prev => [...prev, scoreText]); },
      updateScoreText: (id: string, updates: any) => { setScoreTexts(prev => prev.map(text => text.id === id ? { ...text, ...updates } : text)); },
      getPendingGames: () => games.filter(game => !game.confirmed),
      getTeamStats: () => ({ wins: 0, losses: 0, totalPoints: 0, bostons: 0 }),
      updateTournamentResult,
      getTournamentResults,
      addTournament: () => {},
      updateTournament: () => {},
      updatePaymentStatus: () => {},
      updatePlayerPaymentStatus: () => {},
      updatePlayerTournamentPayment: () => {},
      updateTeamPayment: () => {},
      sendScoreSheetLinks: async () => {},
      submitScore: async () => {},
      confirmScore: async () => {},
      saveBracket: () => {},
      getBracket: () => null,
      updateBracket: () => {},
      deleteBracket: () => {},
      addCity: () => {},
      removeCity: () => {},
      updateCities: () => {}
    }}>
      {children}
    </AppContext.Provider>
  );
};