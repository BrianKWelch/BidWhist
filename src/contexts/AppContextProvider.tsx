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
import { AppContext, Team, Game, Tournament, TournamentSchedule, ScoreText, TournamentResult, ScoreSubmission, Bracket, ScheduleMatch } from './AppContext';
import { createTournamentResultMethods } from './AppContextMethods';
import { generateNextWinLossRound } from '../lib/scheduler';

export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // TEMP HOTFIX: Always clear localStorage caches so placeholders are not loaded
  // Remove after tournament when proper cache invalidation is implemented
  ['teams', 'schedules', 'games', 'scoreSubmissions'].forEach(key => localStorage.removeItem(key));
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
        // When mapping teams from Supabase
        const teamsWithTournaments = (teamsData || []).map(team => ({
          ...team,
          id: String(team.id),
          teamNumber: team.teamNumber,
          phoneNumber: String(team.phone_number ?? team.phoneNumber ?? ''),
          registeredTournaments: (team.registeredTournaments || []).map(String),
        }));
        setTeams(teamsWithTournaments);
        return;
      }
      // Map registeredTournaments onto each team
      const teamsWithTournaments = (teamsData || []).map(team => {
        const regs = registrations.filter(r => String(r.team_id) === String(team.id));
        const regTournaments = regs.map(r => r.tournament_id);
        // ...removed debug log...
        return {
          ...team,
          phoneNumber: String(team.phone_number ?? team.phoneNumber ?? ''),
          registeredTournaments: regTournaments
        };
      });
      setTeams(teamsWithTournaments);
    });
  }, []);
  // Remove localStorage initialization for games
  const [games, setGames] = useState<Game[]>([]);

  // Always fetch games from Supabase on load
  useEffect(() => {
    async function fetchGamesFromSupabase() {
      const { data: gamesData, error } = await supabase.from('games').select('*');
      if (error) {
        toast({ title: 'Failed to fetch games from Supabase', description: error.message, variant: 'destructive' });
        setGames([]);
        return;
      }
      if (!gamesData) {
        setGames([]);
        return;
      }
      const mappedGames = gamesData.map(g => ({
        ...g,
        id: String(g.id),
        teamA: String(g.teamA),
        teamB: String(g.teamB),
        matchId: String(g.matchId),
        handsA: g.handsA ?? g.hands_a ?? 0,
        handsB: g.handsB ?? g.hands_b ?? 0,
      }));
      setGames(mappedGames);
    }
    fetchGamesFromSupabase();
  }, []);

  // After submitting a score, fetch games again from Supabase
  const refreshGamesFromSupabase = async () => {
    try {
      const { data: gamesData, error } = await supabase.from('games').select('*');
      if (error) {
        toast({ title: 'Failed to refresh games from Supabase', description: error.message, variant: 'destructive' });
        return;
      }
      const mappedGames = (gamesData || []).map(g => ({
        ...g,
        handsA: g.handsA ?? g.hands_a ?? 0,
        handsB: g.handsB ?? g.hands_b ?? 0,
      }));
      setGames(mappedGames);
    } catch (err) {
      toast({ title: 'Unexpected error refreshing games', description: String(err), variant: 'destructive' });
    }
  };
  const [scoreSubmissions, setScoreSubmissions] = useState<ScoreSubmission[]>(() => {
    const saved = localStorage.getItem('scoreSubmissions');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Replace the schedules state initialization and loading logic
  const [schedules, setSchedules] = useState<TournamentSchedule[]>([]);

  useEffect(() => {
    async function fetchSchedulesFromSupabase() {
      try {
        const { data: matches, error } = await supabase.from('matches').select('*');
        if (error) {
          toast({ title: 'Failed to fetch schedules from Supabase', description: error.message, variant: 'destructive' });
          return;
        }
        if (!matches) {
          setSchedules([]);
          return;
        }
        // Group matches by tournamentId
        const grouped: { [tournamentId: string]: ScheduleMatch[] } = {};
        matches.forEach((m: any) => {
          const match: ScheduleMatch = {
            id: String(m.id),
            teamA: String(m.team_a), // map from team_a (snake_case)
            teamB: String(m.team_b), // map from team_b (snake_case)
            round: m.round,
            tournamentId: String(m.tournament_id),
            isBye: m.is_bye,
            isSameCity: m.is_same_city,
            table: m.table_number
          };
          if (!grouped[match.tournamentId]) grouped[match.tournamentId] = [];
          grouped[match.tournamentId].push(match);
        });
        // Convert to TournamentSchedule[]
        const schedulesFromDb: TournamentSchedule[] = Object.entries(grouped).map(([tournamentId, matches]) => ({
          tournamentId,
          rounds: Math.max(...matches.map(m => m.round)),
          matches
        }));
        setSchedules(schedulesFromDb);
      } catch (err) {
        toast({ title: 'Unexpected error fetching schedules', description: String(err), variant: 'destructive' });
        setSchedules([]);
      }
    }
    fetchSchedulesFromSupabase();
  }, []);

  // --- Real-time listener: refresh schedules on any matches change ---
  useEffect(() => {
    const channel = supabase
      .channel('public:matches')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        async () => {
          try {
            const { data: matches, error } = await supabase.from('matches').select('*');
            if (error || !matches) return;
            const grouped: { [tournamentId: string]: ScheduleMatch[] } = {};
            matches.forEach((m: any) => {
              const match: ScheduleMatch = {
                id: String(m.id),
                teamA: String(m.team_a),
                teamB: String(m.team_b),
                round: m.round,
                tournamentId: String(m.tournament_id),
                isBye: m.is_bye,
                isSameCity: m.is_same_city,
                table: m.table_number,
              };
              if (!grouped[match.tournamentId]) grouped[match.tournamentId] = [];
              grouped[match.tournamentId].push(match);
            });
            const schedulesFromDb: TournamentSchedule[] = Object.entries(grouped).map(([tournamentId, matches]) => ({
              tournamentId,
              rounds: Math.max(...matches.map(m => m.round)),
              matches,
            }));
            setSchedules(schedulesFromDb);
          } catch (err) {
            console.error('Realtime schedule refresh failed', err);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  
  useEffect(() => {
    localStorage.setItem('schedules', JSON.stringify(schedules));
  }, [schedules]);
  
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
          // Map boston_pot_cost to bostonPotCost for frontend use
          const tournaments = (result.data || []).map(t => ({
            ...t,
            bostonPotCost: t.boston_pot_cost,
          }));
          setTournaments(tournaments);
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

  const submitGame = async (gameData: any) => {
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
      handsA: gameData.handsA,
      handsB: gameData.handsB,
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
    
    if (
      opponentSubmission &&
      opponentSubmission.scoreA === gameData.scoreA &&
      opponentSubmission.scoreB === gameData.scoreB &&
      opponentSubmission.boston === gameData.boston
    ) {
      
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
        round: gameData.round,
        handsA: gameData.handsA,
        handsB: gameData.handsB
      };
      
      // Upsert the confirmed game to Supabase
      try {
        const { error } = await supabase.from('games').upsert([
          {
            id: confirmedGame.id,
            matchId: confirmedGame.matchId,
            teamA: String(confirmedGame.teamA.id || confirmedGame.teamA),
            teamB: String(confirmedGame.teamB.id || confirmedGame.teamB),
            scoreA: confirmedGame.scoreA,
            scoreB: confirmedGame.scoreB,
            boston: confirmedGame.boston,
            winner: confirmedGame.winner,
            submittedBy: confirmedGame.submittedBy,
            confirmed: confirmedGame.confirmed,
            confirmedBy: null,
            round: confirmedGame.round,
            timestamp: confirmedGame.timestamp,
            handsA: confirmedGame.handsA,
            handsB: confirmedGame.handsB
          }
        ], { onConflict: ['id'] });
        if (error) {
          toast({ title: 'Failed to save game to Supabase', description: error.message, variant: 'destructive' });
          return;
        }
        toast({ title: 'Game result saved to Supabase!', variant: 'default' });
        // Refresh games from Supabase
        // Add to local state immediately so confirmScore can run
        setGames(prev => [...prev, confirmedGame]);
        // Update schedule progression for Option B
        await confirmScore(confirmedGame.id, true, confirmedGame);
        // Finally sync with Supabase
        await refreshGamesFromSupabase();
      } catch (err) {
        toast({ title: 'Unexpected error saving game', description: String(err), variant: 'destructive' });
      }
      // Update local state for UI
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

  const saveSchedule = async (schedule: TournamentSchedule) => {
    // Upsert all matches in the schedule to Supabase
    try {
      const { matches } = schedule;
      // Prepare matches for Supabase (map TS fields to DB columns)
      const supabaseMatches = matches.map(m => ({
        id: m.id,
        team_a: m.teamA,
        team_b: m.teamB,
        round: m.round,
        tournament_id: m.tournamentId,
        table_number: m.table != null ? m.table : 1,
        is_bye: m.isBye ?? false,
        is_same_city: m.isSameCity ?? false
      }));
      const { error } = await supabase.from('matches').upsert(supabaseMatches, { onConflict: ['id'] });
      if (error) {
        toast({ title: 'Failed to save schedule to Supabase', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Schedule saved to Supabase!', variant: 'default' });
      // Update local state for UI
      setSchedules(prev => [...prev.filter(s => s.tournamentId !== schedule.tournamentId), schedule]);
    } catch (err) {
      toast({ title: 'Unexpected error saving schedule', description: String(err), variant: 'destructive' });
    }
  };

  const confirmScore = async (gameId: string, confirm: boolean, gameObj?: Game) => {
    setGames(prevGames => prevGames.map(game =>
      game.id === gameId ? { ...game, confirmed: confirm } : game
    ));
    const game = games.find(g => g.id === gameId);
    const effectiveGame = game || gameObj;
    if (!effectiveGame) return;
    let tournamentId = '';
    let match: ScheduleMatch | undefined;
    let schedule: TournamentSchedule | undefined;
    for (const sched of schedules) {
      const m = sched.matches.find(m => m.id === effectiveGame.matchId);
      if (m) {
        tournamentId = sched.tournamentId;
        match = m;
        schedule = sched;
        break;
      }
    }
    if (!tournamentId || !match || !schedule) return;

    // Check if Option B (initially rounds === 1, or presence of opponentPlaceholder)
    const hasStringPlaceholders = schedule.matches.some(m => {
      const regex = /^R\d+[LW]\d+$/;
      return (typeof m.teamA === 'string' && regex.test(m.teamA as string)) || (typeof m.teamB === 'string' && regex.test(m.teamB as string));
    });
    const isOptionB = schedule.rounds <= 1 || schedule.matches.some(m => m.opponentPlaceholder) || hasStringPlaceholders;
    if (isOptionB) {
      const currentRound = match.round;
      const nextRoundNum = currentRound + 1;

      // Determine winner and loser
      const winnerId = effectiveGame.scoreA > effectiveGame.scoreB ? match.teamA : match.teamB;
      const loserId = effectiveGame.scoreA > effectiveGame.scoreB ? match.teamB : match.teamA;
      let placeholderSchedules = schedules;

      // After determining winnerId and loserId, replace placeholders in the next round
      if (isOptionB) {
        const currentRound = match.round;
        const nextRoundNum = currentRound + 1;
        const loserPlaceholder = `R${currentRound}L${match.table}`;
        const winnerPlaceholder = `R${currentRound}W${match.table}`;
        // Debug output
        console.log('--- confirmScore debug ---');
        console.log('currentRound:', currentRound);
        console.log('match.table:', match.table);
        console.log('loserPlaceholder:', loserPlaceholder);
        console.log('winnerPlaceholder:', winnerPlaceholder);
        const nextRoundMatches = schedules
          .find(s => s.tournamentId === tournamentId)?.matches
          .filter(m => m.round === nextRoundNum) || [];
        nextRoundMatches.forEach(m => {
          console.log('Next round match:', m.id, 'teamA:', m.teamA, 'teamB:', m.teamB);
        });
        // Replacement logic
        const norm = (v: any) => (typeof v === 'string' ? v.trim().toUpperCase() : v);
        placeholderSchedules = schedules.map(s => {
          if (s.tournamentId !== tournamentId) return s;
          const updatedMatches = s.matches.map(m => {
            if (m.round === nextRoundNum) {
              let updated = { ...m };
              if (norm(updated.teamA) === norm(loserPlaceholder)) updated.teamA = loserId;
              if (norm(updated.teamB) === norm(loserPlaceholder)) updated.teamB = loserId;
              if (norm(updated.teamA) === norm(winnerPlaceholder)) updated.teamA = winnerId;
              if (norm(updated.teamB) === norm(winnerPlaceholder)) updated.teamB = winnerId;
              return updated;
            }
            return m;
          });
          return { ...s, matches: updatedMatches };
        });
        // removed duplicate schedule update
        // Persist the updated schedule to the database
        // const updatedSchedule = placeholderSchedules.find(s => s.tournamentId === tournamentId);
        // if (updatedSchedule) saveSchedule(updatedSchedule);
      }

      // Calculate next tables
      const table = match.table ?? 1;
      // Update totalTables:
      const totalTables = Math.ceil(schedule.matches.filter(m => m.round === 1 && !m.isBye).length / 2);
      const loserNextTable = Math.ceil(table / 2);
      const winnerNextTable = totalTables - Math.floor((totalTables - table) / 2);

      // Handle bye rotation
      let byeTeamId: string | null = null;
      if (table === 2) {
        byeTeamId = loserId;
      }
      // Previous bye enters at table 1 (TODO: track byeHistory)

      // Update or create next round matches
      const newSchedules = placeholderSchedules.map(s => {
        if (s.tournamentId !== tournamentId) return s;

        let nextMatches = s.matches.filter(m => m.round === nextRoundNum);

        // Assign loser
        let loserMatch = nextMatches.find(m => m.table === loserNextTable);
        if (!loserMatch) {
          loserMatch = {
            id: `${tournamentId}-r${nextRoundNum}-t${loserNextTable}`,
            tournamentId,
            round: nextRoundNum,
            table: loserNextTable,
            teamA: null,
            teamB: null,
            isBye: false,
            isSameCity: false
          };
          nextMatches.push(loserMatch);
        }
        if (!loserMatch.teamA) loserMatch.teamA = loserId;
        else if (!loserMatch.teamB) loserMatch.teamB = loserId;

        // Assign winner
        let winnerMatch = nextMatches.find(m => m.table === winnerNextTable);
        if (!winnerMatch) {
          winnerMatch = {
            id: `${tournamentId}-r${nextRoundNum}-t${winnerNextTable}`,
            tournamentId,
            round: nextRoundNum,
            table: winnerNextTable,
            teamA: null,
            teamB: null,
            isBye: false,
            isSameCity: false
          };
          nextMatches.push(winnerMatch);
        }
        if (!winnerMatch.teamA) winnerMatch.teamA = winnerId;
        else if (!winnerMatch.teamB) winnerMatch.teamB = winnerId;

        // Add placeholders if only one team
        [loserMatch, winnerMatch].forEach(mtch => {
          if (mtch.teamA && !mtch.teamB) {
            mtch.opponentPlaceholder = { type: 'winner', table: mtch.table };
          } else if (!mtch.teamA && mtch.teamB) {
            mtch.opponentPlaceholder = { type: 'winner', table: mtch.table };
          }
        });

        // Update rounds count if needed
        const newRounds = Math.max(s.rounds, nextRoundNum);

        return {
          ...s,
          matches: [...s.matches.filter(m => m.round !== nextRoundNum), ...nextMatches],
          rounds: newRounds
        };
      });
      setSchedules(newSchedules);
      const updatedSchedule = newSchedules.find(s => s.tournamentId === tournamentId);
      if (updatedSchedule) await saveSchedule(updatedSchedule);
    }
    const updatedS = schedules.find(s => s.tournamentId === tournamentId);
    if (updatedS) await saveSchedule(updatedS);
  };

  const updatePlaceholders = async () => {
    for (const g of games.filter(gm => gm.confirmed)) {
      await confirmScore(g.id, true, g);
    }
    toast({ title: 'Variables updated across schedule.' });
  };

  // Force resolve every placeholder based only on confirmed games
  // Manual refresh from DB
  const refreshSchedules = async () => {
    try {
      const { data: matches, error } = await supabase.from('matches').select('*');
      if (error || !matches) return;
      const grouped: { [tid: string]: ScheduleMatch[] } = {};
      matches.forEach((m: any) => {
        const match: ScheduleMatch = {
          id: String(m.id),
          teamA: String(m.team_a),
          teamB: String(m.team_b),
          round: m.round,
          tournamentId: String(m.tournament_id),
          isBye: m.is_bye,
          isSameCity: m.is_same_city,
          table: m.table_number,
        };
        if (!grouped[match.tournamentId]) grouped[match.tournamentId] = [];
        grouped[match.tournamentId].push(match);
      });
      const fresh: TournamentSchedule[] = Object.entries(grouped).map(([tid, ms]) => ({
        tournamentId: tid,
        rounds: Math.max(...ms.map(m => m.round)),
        matches: ms,
      }));
      setSchedules(fresh);
      toast({ title: 'Schedule refreshed from database.' });
    } catch (err) {
      console.error('refreshSchedules error', err);
    }
  };

  const forceReplaceAllPlaceholders = async () => {
    const norm = (v: any) => (typeof v === 'string' ? v.trim().toUpperCase() : v);
    const updatedSchedules = schedules.map(s => {
      const newMatches = s.matches.map(m => ({ ...m }));
      const findSource = (round:number, table:number) => newMatches.find(mm=>mm.round===round && mm.table===table);
      const teamFromCode = (code:string) => {
        const matchCode = /^R(\d+)([LW])(\d+)$/.exec(code.trim().toUpperCase());
        if(!matchCode) return null;
        const [,rStr,wl,tStr] = matchCode;
        const src = findSource(parseInt(rStr), parseInt(tStr));
        if(!src) return null;
        const game = games.find(g=>g.matchId===src.id && g.confirmed);
        if(!game) return null;
        const loser = game.scoreA>game.scoreB ? src.teamB : src.teamA;
        const winner = game.scoreA>game.scoreB ? src.teamA : src.teamB;
        return wl==='L'? loser : winner;
      };
      newMatches.forEach(mm=>{
        if(typeof mm.teamA==='string'){
          const rep=teamFromCode(mm.teamA);
          if(rep) mm.teamA=rep;
        }
        if(typeof mm.teamB==='string'){
          const rep=teamFromCode(mm.teamB);
          if(rep) mm.teamB=rep;
        }
      });
      return { ...s, matches:newMatches };
    });
    setSchedules(updatedSchedules);
    // Persist each updated schedule to Supabase
    for (const sch of updatedSchedules) {
      await saveSchedule(sch);
    }
    toast({ title: 'Placeholders forcibly refreshed and saved.' });
  };

  return (
    <AppContext.Provider value={{
      sidebarOpen, toggleSidebar: () => setSidebarOpen(prev => !prev), teams, games, setGames, tournaments, setTournaments, schedules, scoreTexts, tournamentResults, setTournamentResults, brackets, cities, currentUser, setCurrentUser, scoreSubmissions, setScoreSubmissions, resetAllTournamentData,
      updatePlaceholders,
      forceReplaceAllPlaceholders,
      refreshSchedules,
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
      saveSchedule: async (schedule: TournamentSchedule) => {
        // Upsert all matches in the schedule to Supabase
        try {
          const { matches } = schedule;
          // Prepare matches for Supabase (map TS fields to DB columns)
          const supabaseMatches = matches.map(m => ({
            id: m.id,
            team_a: m.teamA,
            team_b: m.teamB,
            round: m.round,
            tournament_id: m.tournamentId,
            table_number: m.table != null ? m.table : 1,
            is_bye: m.isBye ?? false,
            is_same_city: m.isSameCity ?? false
          }));
          const { error } = await supabase.from('matches').upsert(supabaseMatches, { onConflict: ['id'] });
          if (error) {
            toast({ title: 'Failed to save schedule to Supabase', description: error.message, variant: 'destructive' });
            return;
          }
          toast({ title: 'Schedule saved to Supabase!', variant: 'default' });
          // Update local state for UI
          setSchedules(prev => [...prev.filter(s => s.tournamentId !== schedule.tournamentId), schedule]);
        } catch (err) {
          toast({ title: 'Unexpected error saving schedule', description: String(err), variant: 'destructive' });
        }
      },
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
          status: 'active' as Tournament['status']
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
      updateTournament: async (id: string, name: string, cost: number, bostonPotCost: number, description?: string, status?: string) => {
        const { supabase } = await import('../supabaseClient');
        // Update in Supabase
        const { error } = await supabase
          .from('tournaments')
          .update({
            name,
            cost,
            boston_pot_cost: bostonPotCost,
            status,
            description
          })
          .eq('id', id);
        if (error) {
          toast({ title: 'Failed to update tournament in database.', description: error.message, variant: 'destructive' });
          return;
        }
        // Refetch tournaments from Supabase to update local state
        const { data: tournamentsData, error: fetchError } = await supabase.from('tournaments').select('*');
        if (!fetchError) {
          setTournaments(tournamentsData || []);
        }
        toast({ title: `Tournament "${name}" updated successfully!` });
      },
      updatePaymentStatus: () => {}, 
      updatePlayerPaymentStatus: () => {}, 
      updatePlayerTournamentPayment, 
      updateTeamPayment: () => {}, 
      sendScoreSheetLinks: async () => {}, 
      submitScore: async () => {}, 
      confirmScore, 
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
      clearScoreSubmissions,
      refreshGamesFromSupabase
    }}>
      {children}
    </AppContext.Provider>
  );
};