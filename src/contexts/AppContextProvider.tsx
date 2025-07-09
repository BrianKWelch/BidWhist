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

const DebugDownloadButton: React.FC = () => {
  if (typeof window === 'undefined' || !window.location.hash.includes('debug=1')) return null;
  const handleDownload = () => {
    const data: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        try {
          data[key] = JSON.parse(localStorage.getItem(key)!);
        } catch {
          data[key] = localStorage.getItem(key);
        }
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'local-storage-dump.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };
  return (
    <button
      onClick={handleDownload}
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        padding: '8px 16px',
        background: '#222',
        color: '#fff',
        border: '1px solid #888',
        borderRadius: 4,
        fontSize: 14,
        opacity: 0.8,
        cursor: 'pointer',
      }}
    >
      Download LocalStorage
    </button>
  );
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // On first load, add 50 dummy teams for winter tournament if not present
  const [teams, setTeams] = useState<Team[]>(() => {
    const saved = localStorage.getItem('teams');
    let base = saved ? JSON.parse(saved) : sampleTeams;
    const winterId = '2';
    const dummyCount = base.filter(t => t.id && t.id.startsWith('dummy-') && t.registeredTournaments?.includes(winterId)).length;
    if (dummyCount < 50) {
      const dummyTeams = generateDummyTeams(50 - dummyCount, ['Columbus', 'Cincinnati', 'Chicago', 'Detroit', 'Atlanta', 'DC/Maryland', 'Other'], winterId);
      base = [...base, ...dummyTeams];
    }
    return base;
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
      sidebarOpen, toggleSidebar: () => setSidebarOpen(prev => !prev), teams, games, tournaments, setTournaments, schedules, scoreTexts, tournamentResults, brackets, cities, currentUser, setCurrentUser, scoreSubmissions,
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
        const newTournament: Tournament = {
          id: Date.now().toString(),
          name,
          cost,
          bostonPotCost,
          description,
          status: 'active'
        };
        // Mark all other tournaments as finished
        setTournaments(prev => [
          ...prev.map(t => ({ ...t, status: 'finished' as 'finished' })),
          { ...newTournament, status: 'active' as 'active' }
        ]);
        toast({ title: `Tournament "${name}" added and set as active!` });
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
      <DebugDownloadButton />
    </AppContext.Provider>
  );
};