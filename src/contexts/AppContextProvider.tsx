import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
// Helper: fetch active tournament id from app_config table
async function fetchActiveTournamentId() {
  const { data, error } = await supabase.from('app_config').select('active_tournament_id').eq('id', 1).single();
  if (error) return null;
  return data?.active_tournament_id || null;
}

// Helper: subscribe to changes in app_config.active_tournament_id
function subscribeToActiveTournamentId(callback: (id: string | null) => void) {
  const channel = supabase
    .channel('public:app_config')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_config' }, payload => {
      callback(payload.new.active_tournament_id || null);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
import { toast } from '@/components/ui/use-toast';
// import { sampleTeams } from './AppContextTeams';

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

export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Debug: Confirm provider mount and test Supabase connection
  React.useEffect(() => {
    // ...removed debug log...
    import('../supabaseClient').then(({ supabase }) => {
      supabase.from('teams').select('*').limit(1)
        .then(result => {
          // ...removed debug log...
        })
        .catch(error => {
          // ...removed debug log...
        });
    });
  }, []);
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
  const [teams, setTeams] = useState<Team[]>([]);
  useEffect(() => {
    import('../supabaseClient').then(async ({ supabase }) => {
      // Fetch all teams
      const { data: teamsData, error: teamsError } = await supabase.from('teams').select('*');
      // ...removed debug log...
      if (teamsError) {
        // ...removed debug log...
        setTeams([]);
        return;
      }
      // Fetch team_registrations join table
      const { data: registrations, error: regError } = await supabase.from('team_registrations').select('*');
      // ...removed debug log...
      if (regError) {
        // ...removed debug log...
        setTeams(teamsData || []);
        return;
      }
      // Map registeredTournaments onto each team
      const teamsWithTournaments = (teamsData || []).map(team => {
        const regs = registrations.filter(r => String(r.team_id) === String(team.id));
        const regTournaments = regs.map(r => r.tournament_id);
        // ...removed debug log...
        return {
          ...team,
          registeredTournaments: regTournaments
        };
      });
      setTeams(teamsWithTournaments);
    });
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
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  useEffect(() => {
    import('../supabaseClient').then(({ supabase }) => {
      supabase.from('tournaments').select('*').then(result => {
        if (result.error) {
          // ...removed debug log...
        } else {
          setTournaments(result.data || []);
        }
      });
    });
  }, []);
  // Returns the currently active tournament, or null if none
  const getActiveTournament = useCallback(() => {
    return tournaments.find(t => t.status === 'active') || null;
  }, [tournaments]);

  // Admin: set active tournament by updating status field
  const setActiveTournament = async (tournamentId: string) => {
    // Only error logs for setActiveTournament
    // Only two statuses: 'active' and 'not_active'.
    const idValue: string = String(tournamentId);
    // Set all tournaments to 'not_active'
    const { error: error1 } = await supabase
      .from('tournaments')
      .update({ status: 'not_active' })
      .neq('id', idValue);
    if (error1) {
      console.error('[setActiveTournament] Error setting all to not_active:', error1);
    }
    // Set the selected tournament to 'active'
    const { error: error2 } = await supabase
      .from('tournaments')
      .update({ status: 'active' })
      .eq('id', idValue)
      .select();
    if (error2) {
      console.error('[setActiveTournament] Error setting selected to active:', error2);
    }
    // Refresh tournaments from DB
    const { data, error } = await supabase.from('tournaments').select('*');
    if (!error) {
      setTournaments(data || []);
    } else {
      console.error('[setActiveTournament] Error refreshing tournaments:', error);
    }
    if (error1 || error2) {
      toast({ title: 'Failed to set active tournament', description: (error1?.message || '') + (error2?.message || ''), variant: 'destructive' });
    }
  };

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
      addTeam: async (player1First: string, player1Last: string, player2First: string, player2Last: string, phoneNumber: string, city: string, selectedTournaments: string[], bostonPotTournaments: string[]) => {
        const player1Name = formatTeamName(player1First, player1Last);
        const player2Name = formatTeamName(player2First, player2Last);
        const teamName = `${player1Name}/${player2Name}`;
        const nextTeamNumber = Math.max(...teams.map(t => t.teamNumber || 0)) + 1;
        // Prepare new team object (snake_case for DB)
        const newTeam = {
          name: teamName,
          player1_first_name: player1First,
          player1_last_name: player1Last,
          player2_first_name: player2First,
          player2_last_name: player2Last,
          phone_number: phoneNumber,
          city
        };
        const { supabase } = await import('../supabaseClient');
        // Insert team into DB
        const { data, error } = await supabase.from('teams').insert([newTeam]).select();
        if (error || !data || !data[0]) {
          toast({ title: 'Failed to register team in database.', description: error?.message || 'Unknown error', variant: 'destructive' });
          return null;
        }
        const teamId = data[0].id;
        // Insert into team_registrations join table
        if (selectedTournaments && selectedTournaments.length > 0) {
          const regs = selectedTournaments.map(tournament_id => ({ team_id: teamId, tournament_id }));
          await supabase.from('team_registrations').insert(regs);
        }
        // Refetch teams from DB
        const { data: teamsData, error: teamsError } = await supabase.from('teams').select('*');
        if (teamsError) {
          toast({ title: 'Error reloading teams from Supabase.', description: teamsError.message, variant: 'destructive' });
        }
        // Refetch team_registrations
        const { data: registrations, error: regError } = await supabase.from('team_registrations').select('*');
        if (!teamsError && !regError) {
          // Map registeredTournaments onto each team
          const teamsWithTournaments = (teamsData || []).map(team => {
            const regs = registrations.filter(r => String(r.team_id) === String(team.id));
            const regTournaments = regs.map(r => r.tournament_id);
            return {
              ...team,
              registeredTournaments: regTournaments
            };
          });
          setTeams(teamsWithTournaments);
        } else if (teamsData) {
          setTeams(teamsData);
        }
        toast({ title: `Team ${teamName} registered successfully!` });
        return teamId;
      },
      updateTeam: async (updatedTeam: Team) => {
        const { supabase } = await import('../supabaseClient');
        // Prepare update payload: only include DB columns
        const { id, registeredTournaments, ...teamFields } = updatedTeam;
        // Map camelCase fields to snake_case for DB
        const fieldMap = {
          teamNumber: 'team_number',
          name: 'name',
          player1FirstName: 'player1_first_name',
          player1LastName: 'player1_last_name',
          player2FirstName: 'player2_first_name',
          player2LastName: 'player2_last_name',
          phoneNumber: 'phone_number',
          city: 'city'
        };
        const updatePayload = {};
        for (const camel in fieldMap) {
          if (camel in teamFields) updatePayload[fieldMap[camel]] = teamFields[camel];
        }
        // Update the team in Supabase
        const { error } = await supabase.from('teams').update(updatePayload).eq('id', id);
        if (error) {
          toast({ title: 'Failed to update team in database.', description: error.message, variant: 'destructive' });
          return;
        }
        // Update team_registrations join table if registeredTournaments is present
        if (Array.isArray(registeredTournaments)) {
          // Remove all existing registrations for this team
          await supabase.from('team_registrations').delete().eq('team_id', id);
          // Insert new registrations
          if (registeredTournaments.length > 0) {
            const newRegs = registeredTournaments.map(tournament_id => ({ team_id: id, tournament_id }));
            await supabase.from('team_registrations').insert(newRegs);
          }
        }
        // Refetch teams from Supabase to update local state
        const { data: teamsData, error: teamsError } = await supabase.from('teams').select('*');
        if (teamsError) {
          toast({ title: 'Error reloading teams from Supabase.', description: teamsError.message, variant: 'destructive' });
          return;
        }
        // Refetch team_registrations
        const { data: registrations, error: regError } = await supabase.from('team_registrations').select('*');
        if (regError) {
          setTeams(teamsData || []);
        } else {
          // Map registeredTournaments onto each team
          const teamsWithTournaments = (teamsData || []).map(team => {
            const regs = registrations.filter(r => String(r.team_id) === String(team.id));
            const regTournaments = regs.map(r => r.tournament_id);
            return {
              ...team,
              registeredTournaments: regTournaments
            };
          });
          setTeams(teamsWithTournaments);
        }
        toast({ title: 'Team updated successfully!' });
      },
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
      setActiveTournament,
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