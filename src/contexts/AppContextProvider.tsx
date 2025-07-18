import React, { useState, useEffect } from 'react';
import { toast } from '@/components/ui/use-toast';
import { sampleTeams } from './AppContextTeams';

// --- DUMMY DATA GENERATION FOR TESTING ---
function generateDummyTeams(num: number, cities: string[], tournamentId: string): Team[] {
  const teams: Team[] = [];
  for (let i = 0; i < num; i++) {
    const city = cities[i % cities.length];
    const teamNumber = 1000 + i;
    teams.push({
      id: `dummy-${teamNumber}`,
      teamNumber,
      name: `TestTeam${teamNumber}`,
      player1FirstName: `P1F${teamNumber}`,
      player1LastName: `P1L${teamNumber}`,
      player2FirstName: `P2F${teamNumber}`,
      player2LastName: `P2L${teamNumber}`,
      phoneNumber: `555${(1000000 + i).toString().slice(0,7)}`,
      city,
      registeredTournaments: [tournamentId],
      bostonPotTournaments: [],
      paymentStatus: 'pending',
      player1PaymentStatus: 'pending',
      player2PaymentStatus: 'pending',
      player1TournamentPayments: { [tournamentId]: false },
      player2TournamentPayments: { [tournamentId]: false },
      tournamentPayments: { [tournamentId]: false },
      totalOwed: 0
    });
  }
  return teams;
}
import { AppContext, Team, Game, Tournament, TournamentSchedule, ScoreText, TournamentResult, ScoreSubmission, Bracket } from './AppContext';
import { createTournamentResultMethods } from './AppContextMethods';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Reset all tournament data except teams
  /**
   * Reset all tournament data for a specific tournamentId (except teams).
   * If no tournamentId is provided, clears all tournaments' data.
   */
  const resetAllTournamentData = (tournamentId?: string) => {
    // Games
    if (tournamentId) {
      // Find all matchIds for this tournament
      const schedule = schedules.find(s => s.tournamentId === tournamentId);
      const matchIds = schedule ? schedule.matches.map(m => m.id) : [];
      setGames(prev => prev.filter(g => !g.matchId || !matchIds.includes(g.matchId)));
      localStorage.setItem('games', JSON.stringify(
        JSON.parse(localStorage.getItem('games') || '[]').filter((g: any) => !g.matchId || !matchIds.includes(g.matchId))
      ));
      // Score Submissions
      setScoreSubmissions(prev => prev.filter(s => !s.matchId || !matchIds.includes(s.matchId)));
      localStorage.setItem('scoreSubmissions', JSON.stringify(
        JSON.parse(localStorage.getItem('scoreSubmissions') || '[]').filter((s: any) => !s.matchId || !matchIds.includes(s.matchId))
      ));
    } else {
      setGames([]);
      localStorage.setItem('games', JSON.stringify([]));
      setScoreSubmissions([]);
      localStorage.setItem('scoreSubmissions', JSON.stringify([]));
    }

    // Tournament Results
    setTournamentResults(prev => {
      if (!tournamentId) return {};
      const copy = { ...prev };
      delete copy[tournamentId];
      return copy;
    });
    const trRaw = localStorage.getItem('tournamentResults');
    let tr = trRaw ? JSON.parse(trRaw) : {};
    if (tournamentId && typeof tr === 'object' && tr !== null) {
      delete tr[tournamentId];
      localStorage.setItem('tournamentResults', JSON.stringify(tr));
    } else if (!tournamentId) {
      localStorage.setItem('tournamentResults', JSON.stringify({}));
    }

    // Results Overrides
    const overridesRaw = localStorage.getItem('resultsOverrides');
    let overrides = overridesRaw ? JSON.parse(overridesRaw) : {};
    if (tournamentId && typeof overrides === 'object' && overrides !== null) {
      // Remove all overrides for this tournament's teams
      // (Assume keys are like teamId_round_field, so filter by teamId in this tournament)
      // This is a best effort, as teamId is not directly linked to tournamentId
      // For a full reset, just clear all overrides
      localStorage.setItem('resultsOverrides', JSON.stringify({}));
    } else if (!tournamentId) {
      localStorage.setItem('resultsOverrides', JSON.stringify({}));
    }

    // Schedules
    setSchedules(prev => tournamentId ? prev.filter(s => s.tournamentId !== tournamentId) : []);
    localStorage.setItem('schedules', JSON.stringify(
      tournamentId ? (JSON.parse(localStorage.getItem('schedules') || '[]').filter((s: any) => s.tournamentId !== tournamentId)) : []
    ));

    // Brackets
    setBrackets(prev => {
      if (!tournamentId) return {};
      const copy = { ...prev };
      delete copy[tournamentId];
      return copy;
    });
    const bracketsRaw = localStorage.getItem('brackets');
    let brackets = bracketsRaw ? JSON.parse(bracketsRaw) : {};
    if (tournamentId && typeof brackets === 'object' && brackets !== null) {
      delete brackets[tournamentId];
      localStorage.setItem('brackets', JSON.stringify(brackets));
    } else if (!tournamentId) {
      localStorage.setItem('brackets', JSON.stringify({}));
    }
  };
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Only load teams from localStorage or sampleTeams, never auto-generate dummy teams
  const [teams, setTeams] = useState<Team[]>(() => {
    const saved = localStorage.getItem('teams');
    return saved ? JSON.parse(saved) : sampleTeams;
  });

  // Save teams to localStorage on every change
  useEffect(() => {
    localStorage.setItem('teams', JSON.stringify(teams));
  }, [teams]);

  // Listen for localStorage changes in other tabs and update teams state
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'teams' && e.newValue) {
        setTeams(JSON.parse(e.newValue));
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);
  const [games, setGames] = useState<Game[]>(() => {
    const saved = localStorage.getItem('games');
    return saved ? JSON.parse(saved) : [];
  });
  const [scoreSubmissions, setScoreSubmissions] = useState<ScoreSubmission[]>(() => {
    const saved = localStorage.getItem('scoreSubmissions');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [schedules, setSchedules] = useState<TournamentSchedule[]>(() => {
    const saved = localStorage.getItem('schedules');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('schedules', JSON.stringify(schedules));
  }, [schedules]);
  
  useEffect(() => {
    localStorage.setItem('games', JSON.stringify(games));
  }, [games]);

  // Listen for localStorage changes in other tabs and update games state
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'games' && e.newValue) {
        setGames(JSON.parse(e.newValue));
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);
  
  useEffect(() => {
    localStorage.setItem('scoreSubmissions', JSON.stringify(scoreSubmissions));
  }, [scoreSubmissions]);
  
  const [scoreTexts, setScoreTexts] = useState<ScoreText[]>([]);
  const [tournamentResults, setTournamentResults] = useState<{ [tournamentId: string]: TournamentResult[] }>({});
  const [brackets, setBrackets] = useState<{ [tournamentId: string]: Bracket }>(() => {
    const saved = localStorage.getItem('brackets');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('brackets', JSON.stringify(brackets));
  }, [brackets]);
  const [cities, setCities] = useState<string[]>(['Columbus', 'Cincinnati', 'Chicago', 'Detroit', 'Atlanta', 'DC/Maryland', 'Other']);
  const [tournaments, setTournaments] = useState<Tournament[]>(() => {
    const saved = localStorage.getItem('tournaments');
    if (saved) return JSON.parse(saved);
    return [
      { id: '1', name: '2025 New Year Classic', cost: 30, bostonPotCost: 10, status: 'finished' },
      { id: '2', name: '2025 Winter Championship', cost: 40, bostonPotCost: 10, status: 'active' }
    ];
  });

  // Persist tournaments to localStorage and sync across tabs
  useEffect(() => {
    localStorage.setItem('tournaments', JSON.stringify(tournaments));
  }, [tournaments]);

  // Listen for localStorage changes in other tabs and update tournaments state
  React.useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'tournaments' && e.newValue) {
        setTournaments(JSON.parse(e.newValue));
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);
  // Returns the currently active tournament, or null if none
  const getActiveTournament = () => tournaments.find(t => t.status === 'active') || null;

  // Mark a tournament as finished and clear its schedule/results
  const finishTournament = (tournamentId: string) => {
    setTournaments(prev => prev.map(t => t.id === tournamentId ? { ...t, status: 'finished' } : t));
    // Optionally clear schedule/results for this tournament
    setSchedules(prev => prev.filter(s => s.tournamentId !== tournamentId));
    clearTournamentResults(tournamentId);
    clearGames(tournamentId);
    clearScoreSubmissions(tournamentId);
    toast({ title: 'Tournament finished and cleared.' });
  };
  const [currentUser, setCurrentUser] = useState('');

  const { updateTournamentResult, getTournamentResults, formatTeamName } = createTournamentResultMethods(
    tournamentResults, setTournamentResults, teams
  );
  const updatePlayerTournamentPayment = (
  teamId: string,
  player: 'player1' | 'player2',
  tournamentId: string,
  paid: boolean
) => {
  setTeams(prev =>
    prev.map(team => {
      if (team.id !== teamId) return team;
      const field =
        player === 'player1' ? 'player1TournamentPayments' : 'player2TournamentPayments';
      return {
        ...team,
        [field]: {
          ...team[field],
          [tournamentId]: paid,
        },
      };
    })
  );
};

  // Automatically update tournamentResults when a new confirmed game is added
  useEffect(() => {
    games.forEach(game => {
      if (!game.confirmed) return;
      // Try to get tournamentId from the schedule using matchId
      let tournamentId = '1';
      if (game.matchId) {
        const matchSchedule = schedules.find(sch => sch.matches.some(m => m.id === game.matchId));
        if (matchSchedule) {
          tournamentId = matchSchedule.tournamentId;
        }
      }
      const round = game.round;
      const teamAId = typeof game.teamA === 'object' ? game.teamA.id : game.teamA;
      const teamBId = typeof game.teamB === 'object' ? game.teamB.id : game.teamB;
      const teamAWin = game.scoreA > game.scoreB;
      const teamBWin = game.scoreB > game.scoreA;
      const bostonA = game.boston === 'teamA' ? 1 : 0;
      const bostonB = game.boston === 'teamB' ? 1 : 0;

      setTournamentResults(prev => {
        const results = prev[tournamentId] || [];
        // Update teamA
        let updatedResults = results.map(result => {
          if (result.teamId === teamAId) {
            const updatedRounds = { ...result.rounds };
            updatedRounds[round] = {
              points: game.scoreA,
              wl: teamAWin ? 'W' : 'L',
              boston: bostonA
            };
            // Recalculate totals
            const totalPoints = Object.values(updatedRounds).reduce((sum, r) => sum + (r.points || 0), 0);
            const totalWins = Object.values(updatedRounds).filter(r => r.wl === 'W').length;
            const totalBoston = Object.values(updatedRounds).reduce((sum, r) => sum + (r.boston || 0), 0);
            return { ...result, rounds: updatedRounds, totalPoints, totalWins, totalBoston };
          }
          return result;
        });
        // Update teamB
        updatedResults = updatedResults.map(result => {
          if (result.teamId === teamBId) {
            const updatedRounds = { ...result.rounds };
            updatedRounds[round] = {
              points: game.scoreB,
              wl: teamBWin ? 'W' : 'L',
              boston: bostonB
            };
            // Recalculate totals
            const totalPoints = Object.values(updatedRounds).reduce((sum, r) => sum + (r.points || 0), 0);
            const totalWins = Object.values(updatedRounds).filter(r => r.wl === 'W').length;
            const totalBoston = Object.values(updatedRounds).reduce((sum, r) => sum + (r.boston || 0), 0);
            return { ...result, rounds: updatedRounds, totalPoints, totalWins, totalBoston };
          }
          return result;
        });
        return { ...prev, [tournamentId]: updatedResults };
      });
    });
  }, [games, schedules]);

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
        opponentSubmission.scoreB === gameData.scoreB &&
        opponentSubmission.boston === gameData.boston) {
      
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
        if (
          opponentSubmission.scoreA === gameData.scoreA &&
          opponentSubmission.scoreB === gameData.scoreB &&
          opponentSubmission.boston !== gameData.boston
        ) {
          toast({
            title: 'Score Conflict',
            description: 'Boston values do not match. Please resolve with opponent.',
            variant: 'destructive'
          });
        } else {
          toast({ 
            title: 'Score Conflict', 
            description: 'Scores dont match. Please resolve with opponent.',
            variant: 'destructive'
          });
        }
      } else {
        toast({ 
          title: 'Score Submitted', 
          description: 'Waiting for opponent to confirm.' 
        });
      }
    }
  };

  // Add clearing methods for tournament data
  const clearTournamentResults = (tournamentId: string) => {
    setTournamentResults(prev => {
      const updated = { ...prev };
      delete updated[tournamentId];
      return updated;
    });
  };

  const clearGames = (tournamentId: string) => {
    setGames(prev => {
      // Remove games that belong to matches in this tournament
      const schedule = schedules.find(s => s.tournamentId === tournamentId);
      if (!schedule) return prev;
      
      const matchIds = schedule.matches.map(m => m.id);
      return prev.filter(game => !game.matchId || !matchIds.includes(game.matchId));
    });
  };

  const clearScoreSubmissions = (tournamentId: string) => {
    setScoreSubmissions(prev => {
      // Remove score submissions that belong to matches in this tournament
      const schedule = schedules.find(s => s.tournamentId === tournamentId);
      if (!schedule) return prev;
      
      const matchIds = schedule.matches.map(m => m.id);
      return prev.filter(submission => !matchIds.includes(submission.matchId));
    });
  };

  return (
    <AppContext.Provider value={{
      sidebarOpen, toggleSidebar: () => setSidebarOpen(prev => !prev), teams, games, setGames, tournaments, setTournaments, schedules, scoreTexts, tournamentResults, setTournamentResults, brackets, cities, currentUser, setCurrentUser, scoreSubmissions, setScoreSubmissions, resetAllTournamentData,
      deleteTeam: (teamId: string) => {
        setTeams(prev => {
          const updated = prev.filter(team => team.id !== teamId);
          localStorage.setItem('teams', JSON.stringify(updated));
          return updated;
        });
        toast({ title: 'Team deleted successfully.' });
      },
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
          localStorage.setItem('teams', JSON.stringify(updated));
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
      addTournament: (name: string, cost: number, bostonPotCost: number, description?: string) => {
        if (!name || typeof name !== 'string' || name.trim() === '') {
          toast({ title: 'Tournament name is required.', variant: 'destructive' });
          return;
        }
        if (typeof cost !== 'number' || cost <= 0) {
          toast({ title: 'Tournament cost must be greater than 0.', variant: 'destructive' });
          return;
        }
        if (typeof bostonPotCost !== 'number' || bostonPotCost < 0) {
          toast({ title: 'Boston Pot cost must be 0 or greater.', variant: 'destructive' });
          return;
        }
        // Always match seed structure
        const newTournament = {
          id: Date.now().toString(),
          name: name.trim(),
          cost: Number(cost),
          bostonPotCost: Number(bostonPotCost),
          description: typeof description === 'string' ? description : '',
          status: 'active'
        };
        setTournaments(prev => {
          // Only keep tournaments with correct structure
          const validPrev = prev.filter(t =>
            t && typeof t.id === 'string' &&
            typeof t.name === 'string' &&
            typeof t.cost === 'number' &&
            typeof t.bostonPotCost === 'number' &&
            (t.status === 'active' || t.status === 'finished')
          );
          const updated = [
            ...validPrev.map(t => ({
              id: t.id,
              name: t.name,
              cost: Number(t.cost),
              bostonPotCost: Number(t.bostonPotCost),
              description: typeof t.description === 'string' ? t.description : '',
              status: t.status
            })),
            newTournament
          ];
          localStorage.setItem('tournaments', JSON.stringify(updated));
          return updated;
        });
        toast({ title: `Tournament "${newTournament.name}" added and set as active!` });
      },
      finishTournament,
      getActiveTournament,
      updateTournament: (id: string, name: string, cost: number, bostonPotCost: number, description?: string) => {
        setTournaments(prev => prev.map(tournament => 
          tournament.id === id 
            ? { ...tournament, name, cost, bostonPotCost, description }
            : tournament
        ));
        toast({ title: `Tournament "${name}" updated successfully!` });
      },
      updatePaymentStatus: () => {}, 
      updatePlayerPaymentStatus: () => {}, 
      updatePlayerTournamentPayment, 
      updateTeamPayment: () => {}, 
      sendScoreSheetLinks: async () => {}, 
      submitScore: async () => {}, 
      confirmScore: async () => {}, 
      saveBracket: (bracket: Bracket) => {
        setBrackets(prev => ({ ...prev, [bracket.tournamentId]: bracket }));
      },
      getBracket: (tournamentId: string) => {
        return brackets[tournamentId] || null;
      },
      updateBracket: (tournamentId: string, updates: Partial<Bracket>) => {
        setBrackets(prev => {
          const existing = prev[tournamentId];
          if (!existing) return prev;
          return { ...prev, [tournamentId]: { ...existing, ...updates } };
        });
      },
      deleteBracket: (tournamentId: string) => {
        setBrackets(prev => {
          const updated = { ...prev };
          delete updated[tournamentId];
          return updated;
        });
      },
      addCity: (city: string) => {
        if (!cities.includes(city)) {
          setCities(prev => [...prev, city]);
          toast({ title: `City "${city}" added successfully!` });
        } else {
          toast({ 
            title: "City already exists", 
            description: `"${city}" is already in the list.`,
            variant: "destructive"
          });
        }
      },
      removeCity: (city: string) => {
        // Check if any teams are using this city
        const teamsUsingCity = teams.filter(team => team.city === city);
        if (teamsUsingCity.length > 0) {
          toast({ 
            title: "Cannot remove city", 
            description: `${teamsUsingCity.length} team(s) are using "${city}". Remove or update teams first.`,
            variant: "destructive"
          });
          return;
        }
        
        setCities(prev => prev.filter(c => c !== city));
        toast({ title: `City "${city}" removed successfully!` });
      },
      updateCities: (cities: string[]) => {
        setCities(cities);
        toast({ title: "Cities updated successfully!" });
      },
      clearTournamentResults,
      clearGames,
      clearScoreSubmissions
    }}>
      {children}
    </AppContext.Provider>
  );
};