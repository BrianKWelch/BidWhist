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
      player1_id: `dummy-player1-${teamNumber}`,
      player2_id: `dummy-player2-${teamNumber}`,
      created_at: new Date().toISOString(),
      // Legacy fields for backward compatibility
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
import { AppContext, Team, Game, Tournament, TournamentSchedule, ScoreText, TournamentResult, ScoreSubmission, Bracket, ScheduleMatch, Player, PlayerTournament, Message } from './AppContext';
import { createTournamentResultMethods } from './AppContextMethods';
import { generateNextWinLossRound } from '../lib/scheduler';

export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // TEMP HOTFIX: Always clear localStorage caches so placeholders are not loaded
  // Remove after tournament when proper cache invalidation is implemented
  ['teams', 'schedules', 'games', 'scoreSubmissions'].forEach(key => localStorage.removeItem(key));
  
  const [fetchError, setFetchError] = useState<string | null>(null);
  
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
  const resetAllTournamentData = async (tournamentId?: string) => {
    try {
      const { supabase } = await import('../supabaseClient');
      
      // Clear database data
      if (tournamentId) {
        // Find all matchIds for this tournament
        const schedule = schedules.find(s => s.tournamentId === tournamentId);
        const matchIds = schedule ? schedule.matches.map(m => m.id) : [];
        
        if (matchIds.length > 0) {
          // Delete games from database
          const { error: gamesError } = await supabase
            .from('games')
            .delete()
            .in('matchId', matchIds);
          
          if (gamesError) {
            console.error('Error deleting games from database:', gamesError);
          } else {
            console.log(`Deleted games for matchIds: ${matchIds.join(', ')}`);
          }
          
          // Delete matches from database
          const { error: matchesError } = await supabase
            .from('matches')
            .delete()
            .in('id', matchIds);
          
          if (matchesError) {
            console.error('Error deleting matches from database:', matchesError);
          } else {
            console.log(`Deleted matches for matchIds: ${matchIds.join(', ')}`);
          }
          
          // Delete score submissions from database (if table exists)
          const { error: submissionsError } = await supabase
            .from('score_submissions')
            .delete()
            .in('matchId', matchIds);
          
          if (submissionsError) {
            console.log('Score submissions table may not exist or have different structure:', submissionsError.message);
          } else {
            console.log(`Deleted score submissions for matchIds: ${matchIds.join(', ')}`);
          }
        }
      } else {
        // Clear all games, matches, and score submissions
        const { error: gamesError } = await supabase
          .from('games')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all games
        
        if (gamesError) {
          console.error('Error deleting all games from database:', gamesError);
        } else {
          console.log('Deleted all games from database');
        }
        
        const { error: matchesError } = await supabase
          .from('matches')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all matches
        
        if (matchesError) {
          console.error('Error deleting all matches from database:', matchesError);
        } else {
          console.log('Deleted all matches from database');
        }
        
        const { error: submissionsError } = await supabase
          .from('score_submissions')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all score submissions
        
        if (submissionsError) {
          console.log('Score submissions table may not exist or have different structure:', submissionsError.message);
        } else {
          console.log('Deleted all score submissions from database');
        }
      }
    } catch (error) {
      console.error('Error clearing database data:', error);
    }

    // Clear local state and localStorage
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
  const [players, setPlayers] = useState<Player[]>([]);
  useEffect(() => {
    import('../supabaseClient').then(async ({ supabase }) => {
      try {
        console.log('Starting to load teams from Supabase...');
        // Fetch all teams with player data joined
        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select(`
            *,
            player1:players!player1_id(*),
            player2:players!player2_id(*)
          `);
        
        console.log('Teams fetch result:', { teamsData: teamsData?.length || 0, teamsError });
        
        if (teamsError) {
          console.error('Error fetching teams:', teamsError);
          const errorMessage = `Failed to load teams: ${teamsError.message} (Code: ${teamsError.code})`;
          setFetchError(errorMessage);
          toast({ 
            title: 'Teams Loading Error', 
            description: errorMessage, 
            variant: 'destructive' 
          });
          setTeams([]);
          return;
        }

        // Fetch team_registrations join table
        const { data: registrations, error: regError } = await supabase.from('team_registrations').select('*');
        
        // Fetch player tournament payments for all players
        const { data: playerPayments, error: paymentError } = await supabase
          .from('player_tournament')
          .select('*');

        if (regError) {
          console.error('Error fetching team registrations:', regError);
          const errorMessage = `Failed to load team registrations: ${regError.message} (Code: ${regError.code})`;
          setFetchError(errorMessage);
          toast({ 
            title: 'Team Registrations Error', 
            description: errorMessage, 
            variant: 'destructive' 
          });
          // Map teams with player data and populate legacy fields
          const teamsWithPlayers = (teamsData || []).map(team => ({
            ...team,
            id: String(team.id),
            // Populate legacy fields from player data for backward compatibility
            player1FirstName: team.player1?.first_name || '',
            player1LastName: team.player1?.last_name || '',
            player2FirstName: team.player2?.first_name || '',
            player2LastName: team.player2?.last_name || '',
            phoneNumber: team.player1?.phone_number || team.player2?.phone_number || '',
            player1_phone: team.player1?.phone_number || '',
            player2_phone: team.player2?.phone_number || '',
            city: team.city || '',
            registeredTournaments: []
          }));
          setTeams(teamsWithPlayers);
          return;
        }

        if (paymentError) {
          console.error('Error fetching player payments:', paymentError);
          const errorMessage = `Failed to load player payments: ${paymentError.message} (Code: ${paymentError.code})`;
          setFetchError(errorMessage);
          toast({ 
            title: 'Player Payments Error', 
            description: errorMessage, 
            variant: 'destructive' 
          });
        }

        // Map registeredTournaments onto each team and populate legacy fields
        const teamsWithTournaments = (teamsData || []).map(team => {
          const regs = registrations.filter(r => String(r.team_id) === String(team.id));
          const regTournaments = regs.map(r => r.tournament_id);
          
          // Build payment data for this team's players
          const player1TournamentPayments: { [tournamentId: string]: boolean } = {};
          const player2TournamentPayments: { [tournamentId: string]: boolean } = {};
          const player1BostonPotPayments: { [tournamentId: string]: boolean } = {};
          const player2BostonPotPayments: { [tournamentId: string]: boolean } = {};

          if (playerPayments && !paymentError) {
            playerPayments.forEach(payment => {
              if (payment.player_id === team.player1_id) {
                player1TournamentPayments[payment.tournament_id] = payment.paid;
                player1BostonPotPayments[payment.tournament_id] = payment.b_paid;
              } else if (payment.player_id === team.player2_id) {
                player2TournamentPayments[payment.tournament_id] = payment.paid;
                player2BostonPotPayments[payment.tournament_id] = payment.b_paid;
              }
            });
          }
          
          return {
            ...team,
            id: String(team.id),
            // Populate legacy fields from player data for backward compatibility
            player1FirstName: team.player1?.first_name || '',
            player1LastName: team.player1?.last_name || '',
            player2FirstName: team.player2?.first_name || '',
            player2LastName: team.player2?.last_name || '',
            phoneNumber: team.player1?.phone_number || team.player2?.phone_number || '',
            player1_phone: team.player1?.phone_number || '',
            player2_phone: team.player2?.phone_number || '',
            city: team.city || '',
            registeredTournaments: regTournaments,
            player1TournamentPayments,
            player2TournamentPayments,
            player1BostonPotPayments,
            player2BostonPotPayments
          };
        });
        console.log('Setting teams with tournaments:', teamsWithTournaments?.length || 0, 'teams');
        setTeams(teamsWithTournaments);
        setFetchError(null); // Clear any previous errors
      } catch (error) {
        const errorMessage = `Unexpected error loading teams: ${error instanceof Error ? error.message : String(error)}`;
        console.error('Unexpected error in teams loading:', error);
        setFetchError(errorMessage);
        toast({ 
          title: 'Teams Loading Error', 
          description: errorMessage, 
          variant: 'destructive' 
        });
        setTeams([]);
      }
    });
  }, []);

  // Load players on mount
  useEffect(() => {
    refreshPlayers();
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
        teamA: String(g.teamA ?? g.team_a),
        teamB: String(g.teamB ?? g.team_b),
        matchId: String(g.matchId ?? g.match_id),
        handsA: g.handsA ?? g.hands_a ?? 0,
        handsB: g.handsB ?? g.hands_b ?? 0,
        boston_a: g.boston_a ?? g.bostonA ?? 0,
        boston_b: g.boston_b ?? g.bostonB ?? 0,
        entered_by_team_id: g.entered_by_team_id ?? g.enteredBy,
        status: g.status,
        round: g.round,
        submittedBy: String(g.submitted_by ?? g.submittedBy ?? ''),
        confirmed: Boolean(g.confirmed),
        timestamp: g.timestamp ? new Date(g.timestamp) : new Date(),
      }));
      setGames(mappedGames);
    }
    fetchGamesFromSupabase();

    // Real-time subscription for games table
    const gamesChannel = supabase
      .channel('public:games')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, payload => {
        const row: any = payload.new || payload.old;
        if (!row) return;
        
        const mappedGame = {
          ...row,
          id: String(row.id),
          teamA: String(row.teamA ?? row.team_a),
          teamB: String(row.teamB ?? row.team_b),
          matchId: String(row.matchId ?? row.match_id),
          handsA: row.handsA ?? row.hands_a ?? 0,
          handsB: row.handsB ?? row.hands_b ?? 0,
          boston_a: row.boston_a ?? row.bostonA ?? 0,
          boston_b: row.boston_b ?? row.bostonB ?? 0,
          entered_by_team_id: row.entered_by_team_id ?? row.enteredBy,
          status: row.status,
          round: row.round,
          submittedBy: String(row.submitted_by ?? row.submittedBy ?? ''),
          confirmed: Boolean(row.confirmed),
          timestamp: row.timestamp ? new Date(row.timestamp) : new Date(),
        };

        setGames(prev => {
          switch (payload.eventType) {
            case 'DELETE':
              return prev.filter(g => g.id !== row.id);
            case 'UPDATE':
              return prev.map(g => (g.id === row.id ? mappedGame : g));
            case 'INSERT':
            default:
              const exists = prev.some(g => g.id === row.id);
              return exists ? prev : [...prev, mappedGame];
          }
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(gamesChannel);
    };
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
        id: String(g.id),
        teamA: String(g.teamA ?? g.team_a),
        teamB: String(g.teamB ?? g.team_b),
        matchId: String(g.matchId ?? g.match_id),
        handsA: g.handsA ?? g.hands_a ?? 0,
        handsB: g.handsB ?? g.hands_b ?? 0,
        boston_a: g.boston_a ?? g.bostonA ?? 0,
        boston_b: g.boston_b ?? g.bostonB ?? 0,
        entered_by_team_id: g.entered_by_team_id ?? g.enteredBy,
        status: g.status,
        round: g.round,
        submittedBy: String(g.submitted_by ?? g.submittedBy ?? ''),
        confirmed: Boolean(g.confirmed),
        timestamp: g.timestamp ? new Date(g.timestamp) : new Date(),
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

  // --- Fetch existing scores and subscribe in real-time so cross-device conflicts show in the UI ---
  useEffect(() => {
    // Initial fetch
    const loadScores = async () => {
      const { data, error } = await supabase.from('scores').select('*');
      if (error) {
        console.error('Failed to load scores', error);
        return;
      }
      if (data) {
        setScoreSubmissions(data.map((row: any) => ({
          id: row.id,
          matchId: row.matchId,
          teamA: teams.find(t => String(t.id) === String(row.team_a)) || { id: String(row.team_a) } as Team,
          teamB: teams.find(t => String(t.id) === String(row.team_b)) || { id: String(row.team_b) } as Team,
          scoreA: Number(row.score_a),
          scoreB: Number(row.score_b),
          boston: row.boston as 'none' | 'teamA' | 'teamB',
          handsA: Number(row.hands_a) || 0,
          handsB: Number(row.hands_b) || 0,
          submittedBy: String(row.submitted_by),
          timestamp: new Date(row.timestamp),
          round: row.round
        })));
      }
    };
    loadScores();

    // Real-time subscription
    const channel = supabase
      .channel('public:scores')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, payload => {
        const row: any = payload.new || payload.old;
        if (!row) return;
        const mapped: ScoreSubmission = {
          id: row.id,
          matchId: row.matchId,
          teamA: teams.find(t => String(t.id) === String(row.team_a)) || { id: String(row.team_a) } as Team,
          teamB: teams.find(t => String(t.id) === String(row.team_b)) || { id: String(row.team_b) } as Team,
          scoreA: Number(row.score_a),
          scoreB: Number(row.score_b),
          boston: row.boston as 'none' | 'teamA' | 'teamB',
          handsA: Number(row.hands_a) || 0,
          handsB: Number(row.hands_b) || 0,
          submittedBy: String(row.submitted_by),
          timestamp: new Date(row.timestamp),
          round: row.round
        };

        setScoreSubmissions(prev => {
          switch (payload.eventType) {
            case 'DELETE':
              return prev.filter(s => s.id !== row.id);
            case 'UPDATE':
              return prev.map(s => (s.id === row.id ? mapped : s));
            case 'INSERT':
            default:
              const exists = prev.some(s => s.id === row.id);
              return exists ? prev : [...prev, mapped];
          }
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teams]);
  
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
          // Map boston_pot_cost to bostonPotCost, tracks_hands to tracksHands, and scoring_mode to scoringMode for frontend use
          const tournaments = (result.data || []).map(t => ({
            ...t,
            bostonPotCost: t.boston_pot_cost,
            tracksHands: t.tracks_hands !== false,
            scoringMode: t.scoring_mode || 'team'
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
      // Map boston_pot_cost to bostonPotCost, tracks_hands to tracksHands, and scoring_mode to scoringMode for frontend use
      const mappedTournaments = (data || []).map(t => ({
        ...t,
        bostonPotCost: t.boston_pot_cost,
        tracksHands: t.tracks_hands !== false,
        scoringMode: t.scoring_mode || 'team'
      }));
      setTournaments(mappedTournaments);
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
  const [messages, setMessages] = useState<Message[]>([]);

  // Fetch messages from Supabase
  const fetchMessagesFromSupabase = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }
      
      if (data) {
        // Convert database format to Message interface
        const formattedMessages: Message[] = data.map((msg: any) => ({
          id: msg.id,
          text: msg.text,
          type: msg.type,
          active: msg.active,
          createdAt: new Date(msg.created_at),
          expiresAt: msg.expires_at ? new Date(msg.expires_at) : undefined,
          createdBy: msg.created_by
        }));
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  // Load messages on component mount
  useEffect(() => {
    fetchMessagesFromSupabase();
  }, []);

  // Periodic refresh as backup to real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchMessagesFromSupabase();
    }, 5000); // Refresh every 5 seconds as backup

    return () => clearInterval(interval);
  }, []);

  // Real-time subscription for messages
  useEffect(() => {
    const setupSubscription = async () => {
      try {
        const channel = supabase
          .channel('messages-realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
            // Add a small delay to ensure the database change is committed
            setTimeout(() => {
              fetchMessagesFromSupabase();
            }, 100);
          })
          .subscribe((status) => {
            if (status === 'CHANNEL_ERROR') {
              console.error('Messages subscription error');
            }
          });

        return channel;
      } catch (error) {
        console.error('Error setting up messages subscription:', error);
        return null;
      }
    };

    let channel: any = null;
    setupSubscription().then((ch) => {
      channel = ch;
    });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

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

  // Realtime subscription: auto-confirm when opponent submission arrives
  useEffect(() => {
    let channel: any = null;
    (async () => {
      const { supabase } = await import('../supabaseClient');
      channel = supabase.channel('scores-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scores' }, async payload => {
          const sub = payload.new as any;
          const matchId = String(sub.match_id);
          // Find my submission (already in local state)
          const mine = scoreSubmissions.find(s => s.matchId === matchId && String(s.submittedBy) === String(currentUser));
          if (!mine) return;
          // Check if scores match
          if (mine.scoreA === sub.score_a && mine.scoreB === sub.score_b && mine.boston === sub.boston) {
            await submitGame({
              ...mine,
              teamA: mine.teamA,
              teamB: mine.teamB,
              scoreA: mine.scoreA,
              scoreB: mine.scoreB,
              boston: mine.boston,
              handsA: mine.handsA,
              handsB: mine.handsB,
              matchId,
              round: mine.round,
              submittedBy: mine.submittedBy
            });
          }
        })
        .subscribe();
    })();
    return () => { channel && channel.unsubscribe && channel.unsubscribe(); };
  }, [scoreSubmissions, currentUser]);

  // Real-time subscription for games table to update score entry status immediately
  useEffect(() => {
    const setupGamesSubscription = async () => {
      try {
        const channel = supabase
          .channel('games-realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, (payload) => {
            // Add a small delay to ensure the database change is committed
            setTimeout(() => {
              refreshGamesFromSupabase();
            }, 100);
          })
          .subscribe((status) => {
            if (status === 'CHANNEL_ERROR') {
              console.error('Games subscription error');
            }
          });

        return channel;
      } catch (error) {
        console.error('Error setting up games subscription:', error);
        return null;
      }
    };

    let channel: any = null;
    setupGamesSubscription().then((ch) => {
      channel = ch;
    });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [refreshGamesFromSupabase]);

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
      const teamAId = typeof game.teamA === 'object' ? game.teamA.id : String(game.teamA || '');
      const teamBId = typeof game.teamB === 'object' ? game.teamB.id : String(game.teamB || '');
      // Use the winner field from the game data, which handles tied scores correctly
      const teamAWin = game.winner === 'teamA';
      const teamBWin = game.winner === 'teamB';
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
    const teamId = gameData.entered_by_team_id;
    
    // Find the existing row to get its ID - could be "entering" or "disputed"
    const { data: existing, error: selErr } = await supabase
      .from('games')
      .select('*')
      .eq('matchId', matchId)
      .eq('entered_by_team_id', teamId)
      .in('status', ['entering', 'disputed'])
      .single();
    
    if (selErr || !existing) {
      console.error('submitGame: Could not find existing score entry or disputed row', selErr);
      toast({ title: 'Error: Could not find score entry session', description: 'Please try again.', variant: 'destructive' });
      return;
    }
    
    // Create the game record with pending confirmation status, using the existing ID
    const newGame: Game = {
      id: existing.id, // Use the existing ID from the "entering" row
      teamA: gameData.teamA,
      teamB: gameData.teamB,
      scoreA: gameData.scoreA,
      scoreB: gameData.scoreB,
      teamAScore: gameData.scoreA,
      teamBScore: gameData.scoreB,
      boston: 'none', // Default for backward compatibility
      boston_a: gameData.boston_a,
      boston_b: gameData.boston_b,
      winner: gameData.winner,
      submittedBy: String(teamId),
      confirmed: false,
      timestamp: new Date(),
      matchId,
      round: gameData.round,
      handsA: gameData.handsA,
      handsB: gameData.handsB,
      status: 'pending_confirmation',
      entered_by_team_id: teamId
    };
    
    // Save to games table in Supabase - this will update the existing row
    try {
      const { error } = await supabase.from('games').upsert([
        {
          id: newGame.id,
          matchId: newGame.matchId,
          teamA: String(newGame.teamA),
          teamB: String(newGame.teamB),
          scoreA: newGame.scoreA,
          scoreB: newGame.scoreB,
          boston_a: newGame.boston_a,
          boston_b: newGame.boston_b,
          winner: newGame.winner,
          submittedBy: newGame.submittedBy,
          confirmed: newGame.confirmed,
          confirmedBy: null,
          round: newGame.round,
          timestamp: newGame.timestamp,
          handsA: newGame.handsA,
          handsB: newGame.handsB,
          status: newGame.status,
          entered_by_team_id: newGame.entered_by_team_id
        }
      ], { onConflict: ['id'] });
      
      if (error) {
        console.error('GAME UPSERT ERROR', error);
        toast({ title: 'Failed to save game', description: error.message, variant: 'destructive' });
        return;
      }
      
      toast({ title: 'Score submitted successfully!', description: 'Waiting for opponent confirmation.', variant: 'default' });
      
      // Update local state by replacing the existing game
      setGames(prev => prev.map(game => game.id === newGame.id ? newGame : game));
      
      // Refresh from Supabase to ensure consistency
      await refreshGamesFromSupabase();
      
    } catch (err) {
      console.error('GAME UPSERT UNEXPECTED', err);
      toast({ title: 'Unexpected error', description: String(err), variant: 'destructive' });
      return;
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
    // Update local state
    setGames(prevGames => prevGames.map(game =>
      game.id === gameId ? { ...game, confirmed: confirm } : game
    ));
    
    // Update database record
    try {
      const { error } = await supabase
        .from('games')
        .update({ 
          status: confirm ? 'confirmed' : 'disputed',
          confirmed: confirm,
          confirmedBy: confirm ? 'opponent' : null
        })
        .eq('id', gameId);
      
      if (error) {
        console.error('confirmScore database update error:', error);
        toast({ title: 'Error updating score confirmation', description: error.message, variant: 'destructive' });
        return;
      }
    } catch (err) {
      console.error('confirmScore unexpected error:', err);
      toast({ title: 'Unexpected error updating confirmation', description: String(err), variant: 'destructive' });
      return;
    }
    
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

      // Determine winner and loser using the winner field from the game data
      const winnerId = effectiveGame.winner === 'teamA' ? match.teamA : match.teamB;
      const loserId = effectiveGame.winner === 'teamA' ? match.teamB : match.teamA;
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
        const loser = game.winner === 'teamA' ? src.teamB : src.teamA;
        const winner = game.winner === 'teamA' ? src.teamA : src.teamB;
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

  const updateTeamPayment = (teamId: string, tournamentId: string, isPaid: boolean) => {
    setTeams(prevTeams => 
      prevTeams.map(team => {
        if (team.id === teamId) {
          const updatedTournamentPayments = { ...team.tournamentPayments };
          updatedTournamentPayments[tournamentId] = isPaid;
          return { ...team, tournamentPayments: updatedTournamentPayments };
        }
        return team;
      })
    );
  };

  const updatePlayerPayment = async (playerId: string, tournamentId: string, isPaid: boolean, isBostonPot: boolean) => {
    try {
      const { supabase } = await import('../supabaseClient');
      
      const updateData = isBostonPot 
        ? { b_paid: isPaid }
        : { paid: isPaid };
      
      const { error } = await supabase
        .from('player_tournament')
        .update(updateData)
        .eq('player_id', playerId)
        .eq('tournament_id', tournamentId);

      if (error) {
        console.error('Error updating player payment:', error);
        throw error;
      }

      // Teams will be refreshed on next component render
      toast({ title: 'Payment updated successfully' });
    } catch (error) {
      console.error('Error updating player payment:', error);
      throw error;
    }
  };

  const getPlayerTournamentPayments = async (playerId: string): Promise<PlayerTournament[]> => {
    try {
      const { supabase } = await import('../supabaseClient');
      
      const { data, error } = await supabase
        .from('player_tournament')
        .select('*')
        .eq('player_id', playerId);

      if (error) {
        console.error('Error fetching player tournament payments:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching player tournament payments:', error);
      throw error;
    }
  };

  const getTeamPaymentStatus = (team: Team, tournamentId: string) => {
    // Get player tournament records for this team and tournament
    const player1Payment = team.player1TournamentPayments?.[tournamentId] || false;
    const player2Payment = team.player2TournamentPayments?.[tournamentId] || false;
    const player1BostonPot = team.player1BostonPotPayments?.[tournamentId] || false;
    const player2BostonPot = team.player2BostonPotPayments?.[tournamentId] || false;
    
    // Tournament is paid if both players paid
    const tournamentPaid = player1Payment && player2Payment;
    
    // Boston Pot is paid if both players paid for Boston Pot
    const bostonPotPaid = player1BostonPot && player2BostonPot;
    
    // Boston Pot mismatch if one player is in Boston Pot and the other isn't
    const bostonPotMismatch = (player1BostonPot !== player2BostonPot);
    
    return { tournamentPaid, bostonPotPaid, bostonPotMismatch };
  };

  const calculateTeamTotalOwed = (team: Team): number => {
    let total = 0;
    
    console.log(`Calculating total for team ${team.name}:`, {
      registeredTournaments: team.registeredTournaments,
      bostonPotTournaments: team.bostonPotTournaments
    });
    
    if (team.registeredTournaments) {
      team.registeredTournaments.forEach(tournamentId => {
        const tournament = tournaments.find(t => t.id === tournamentId);
        if (tournament) {
          // Add tournament cost (already per team)
          total += tournament.cost;
          console.log(`Added tournament cost: ${tournament.cost}, total now: ${total}`);
          
          // Add Boston Pot cost if team is in Boston Pot (already per team)
          const isInBostonPot = team.bostonPotTournaments?.includes(tournamentId);
          console.log(`Tournament ${tournamentId} - isInBostonPot: ${isInBostonPot}, bostonPotCost: ${tournament.bostonPotCost}`);
          
          if (isInBostonPot) {
            total += tournament.bostonPotCost;
            console.log(`Added Boston Pot cost: ${tournament.bostonPotCost}, total now: ${total}`);
          }
        }
      });
    }
    
    console.log(`Final total for team ${team.name}: ${total}`);
    return total;
  };

  const createTeamFromPlayers = async (player1: Player, player2: Player, tournamentId: string) => {
    const { supabase } = await import('../supabaseClient');
    try {
      const teamName = `${player1.first_name}/${player2.first_name}`;
      
      // First, create the team with city from player1
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .insert([{
          name: teamName,
          player1_id: player1.id,
          player2_id: player2.id,
          city: player1.city || player2.city || '' // Use player1's city, fallback to player2
        }])
        .select()
        .single();

      if (teamError) {
        console.error('Error creating team:', teamError);
        toast({ title: 'Failed to create team', description: teamError.message, variant: 'destructive' });
        return null;
      }

      // Register the team for the tournament
      const { error: regError } = await supabase
        .from('team_registrations')
        .insert([{ team_id: teamData.id, tournament_id: tournamentId }]);

      if (regError) {
        console.error('Error registering team for tournament:', regError);
        toast({ title: 'Team created but failed to register for tournament', description: regError.message, variant: 'destructive' });
        return null;
      }

      // Register both players for the tournament (if not already registered)
      const playerRegistrations = [];
      
      // Check if player1 is already registered
      const { data: existingPlayer1 } = await supabase
        .from('player_tournament')
        .select('id')
        .eq('player_id', player1.id)
        .eq('tournament_id', tournamentId)
        .single();

      if (!existingPlayer1) {
        playerRegistrations.push({
          player_id: player1.id,
          tournament_id: tournamentId,
          paid: false,
          b_paid: false,
          entered_boston_pot: false
        });
      }

      // Check if player2 is already registered
      const { data: existingPlayer2 } = await supabase
        .from('player_tournament')
        .select('id')
        .eq('player_id', player2.id)
        .eq('tournament_id', tournamentId)
        .single();

      if (!existingPlayer2) {
        playerRegistrations.push({
          player_id: player2.id,
          tournament_id: tournamentId,
          paid: false,
          b_paid: false,
          entered_boston_pot: false
        });
      }

      // Register players if needed
      if (playerRegistrations.length > 0) {
        const { error: playerRegError } = await supabase
          .from('player_tournament')
          .insert(playerRegistrations);

        if (playerRegError) {
          console.error('Error registering players for tournament:', playerRegError);
          toast({ title: 'Team created but failed to register players', description: playerRegError.message, variant: 'destructive' });
          return null;
        }
      }

      // Refetch teams with player data and registrations
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select(`*, player1:players!player1_id(*), player2:players!player2_id(*)`);

      if (teamsError) {
        console.error('Error fetching teams:', teamsError);
        toast({ title: 'Team created but failed to refresh data', description: teamsError.message, variant: 'destructive' });
        return null;
      }

      // Fetch team registrations
      const { data: registrations, error: regsError } = await supabase
        .from('team_registrations')
        .select('team_id, tournament_id');

      if (regsError) {
        console.error('Error fetching team registrations:', regsError);
        toast({ title: 'Team created but failed to refresh registrations', description: regsError.message, variant: 'destructive' });
        return null;
      }

      // Map teams with their registrations
      const teamsWithTournaments = teamsData.map(team => {
        const regs = registrations.filter(r => r.team_id === team.id);
        const regTournaments = regs.map(r => r.tournament_id);
        
        return {
          ...team,
          id: String(team.id),
          // Populate legacy fields from player data for backward compatibility
          player1FirstName: team.player1?.first_name || '',
          player1LastName: team.player1?.last_name || '',
          player2FirstName: team.player2?.first_name || '',
          player2LastName: team.player2?.last_name || '',
          phoneNumber: team.player1?.phone_number || team.player2?.phone_number || '',
          player1_phone: team.player1?.phone_number || '',
          player2_phone: team.player2?.phone_number || '',
          city: team.city || '', // Use team's city field directly
          registeredTournaments: regTournaments
        };
      });

      setTeams(teamsWithTournaments);
      toast({ title: `Team ${teamName} created successfully!` });
      return String(teamData.id);
    } catch (error) {
      console.error('Error creating team from players:', error);
      toast({ title: 'Failed to create team', description: String(error), variant: 'destructive' });
      return null;
    }
  };

  const refreshTeams = async () => {
    const { supabase } = await import('../supabaseClient');
    try {
      // Fetch all teams with player data joined
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select(`
          *,
          player1:players!player1_id(*),
          player2:players!player2_id(*)
        `);
      
      if (teamsError) {
        console.error('Error fetching teams:', teamsError);
        const errorMessage = `Failed to refresh teams: ${teamsError.message} (Code: ${teamsError.code})`;
        setFetchError(errorMessage);
        toast({ 
          title: 'Teams Refresh Error', 
          description: errorMessage, 
          variant: 'destructive' 
        });
        return;
      }
      
      

      // Fetch team_registrations join table
      const { data: registrations, error: regError } = await supabase.from('team_registrations').select('*');
      
      if (regError) {
        console.error('Error fetching team registrations:', regError);
        const errorMessage = `Failed to refresh team registrations: ${regError.message} (Code: ${regError.code})`;
        setFetchError(errorMessage);
        toast({ 
          title: 'Team Registrations Refresh Error', 
          description: errorMessage, 
          variant: 'destructive' 
        });
        // Map teams with player data and populate legacy fields
        const teamsWithPlayers = (teamsData || []).map(team => ({
          ...team,
          id: String(team.id),
          // Populate legacy fields from player data for backward compatibility
          player1FirstName: team.player1?.first_name || '',
          player1LastName: team.player1?.last_name || '',
          player2FirstName: team.player2?.first_name || '',
          player2LastName: team.player2?.last_name || '',
          phoneNumber: team.player1?.phone_number || team.player2?.phone_number || '',
          player1_phone: team.player1?.phone_number || '',
          player2_phone: team.player2?.phone_number || '',
          city: team.city || '',
          registeredTournaments: []
        }));
        setTeams(teamsWithPlayers);
        return;
      }

      // Fetch player tournament payments for all players
      const { data: playerPayments, error: paymentError } = await supabase
        .from('player_tournament')
        .select('*');

      if (paymentError) {
        console.error('Error fetching player payments:', paymentError);
        const errorMessage = `Failed to refresh player payments: ${paymentError.message} (Code: ${paymentError.code})`;
        setFetchError(errorMessage);
        toast({ 
          title: 'Player Payments Refresh Error', 
          description: errorMessage, 
          variant: 'destructive' 
        });
      }

      // Map registeredTournaments onto each team and populate legacy fields
      const teamsWithTournaments = (teamsData || []).map(team => {
        const regs = registrations.filter(r => String(r.team_id) === String(team.id));
        const regTournaments = regs.map(r => r.tournament_id);
        
        // Build payment data for this team's players
        const player1TournamentPayments: { [tournamentId: string]: boolean } = {};
        const player2TournamentPayments: { [tournamentId: string]: boolean } = {};
        const player1BostonPotPayments: { [tournamentId: string]: boolean } = {};
        const player2BostonPotPayments: { [tournamentId: string]: boolean } = {};

        if (playerPayments) {
          playerPayments.forEach(payment => {
            if (payment.player_id === team.player1_id) {
              player1TournamentPayments[payment.tournament_id] = payment.paid;
              player1BostonPotPayments[payment.tournament_id] = payment.b_paid;
            } else if (payment.player_id === team.player2_id) {
              player2TournamentPayments[payment.tournament_id] = payment.paid;
              player2BostonPotPayments[payment.tournament_id] = payment.b_paid;
            }
          });
        }

        // Determine Boston Pot tournaments for this team
        const bostonPotTournaments: string[] = [];
        console.log(`Refreshing team ${team.name}:`, {
          teamId: team.id,
          player1_id: team.player1_id,
          player2_id: team.player2_id,
          regTournaments,
          playerPaymentsCount: playerPayments?.length || 0
        });
        
        if (regTournaments.length > 0 && playerPayments) {
          const player1BostonPotTournaments = new Set<string>();
          const player2BostonPotTournaments = new Set<string>();
          
          playerPayments.forEach(payment => {
            console.log(`Payment: player_id=${payment.player_id}, tournament_id=${payment.tournament_id}, entered_boston_pot=${payment.entered_boston_pot}`);
            
            if (payment.player_id === team.player1_id && payment.entered_boston_pot) {
              player1BostonPotTournaments.add(payment.tournament_id);
              console.log(`Added player1 Boston Pot tournament: ${payment.tournament_id}`);
            } else if (payment.player_id === team.player2_id && payment.entered_boston_pot) {
              player2BostonPotTournaments.add(payment.tournament_id);
              console.log(`Added player2 Boston Pot tournament: ${payment.tournament_id}`);
            }
          });
          
          console.log(`Player1 Boston Pot tournaments: ${Array.from(player1BostonPotTournaments)}`);
          console.log(`Player2 Boston Pot tournaments: ${Array.from(player2BostonPotTournaments)}`);
          
          // Team is in Boston Pot if both players are in Boston Pot for the same tournament
          regTournaments.forEach(tournamentId => {
            const player1InBostonPot = player1BostonPotTournaments.has(tournamentId);
            const player2InBostonPot = player2BostonPotTournaments.has(tournamentId);
            console.log(`Tournament ${tournamentId}: player1=${player1InBostonPot}, player2=${player2InBostonPot}`);
            
            if (player1InBostonPot && player2InBostonPot) {
              bostonPotTournaments.push(tournamentId);
              console.log(`Added tournament ${tournamentId} to team Boston Pot tournaments`);
            }
          });
        }
        
        console.log(`Final bostonPotTournaments for team ${team.name}: ${bostonPotTournaments}`);
        
        return {
          ...team,
          id: String(team.id),
          // Populate legacy fields from player data for backward compatibility
          player1FirstName: team.player1?.first_name || '',
          player1LastName: team.player1?.last_name || '',
          player2FirstName: team.player2?.first_name || '',
          player2LastName: team.player2?.last_name || '',
          phoneNumber: team.player1?.phone_number || team.player2?.phone_number || '',
          player1_phone: team.player1?.phone_number || '',
          player2_phone: team.player2?.phone_number || '',
          city: team.city || '', // Use team's city field directly
          registeredTournaments: regTournaments,
          bostonPotTournaments: bostonPotTournaments,
          player1TournamentPayments,
          player2TournamentPayments,
          player1BostonPotPayments,
          player2BostonPotPayments
        };
      });
      setTeams(teamsWithTournaments);
      setFetchError(null); // Clear any previous errors
    } catch (error) {
      const errorMessage = `Unexpected error refreshing teams: ${error instanceof Error ? error.message : String(error)}`;
      console.error('Error refreshing teams:', error);
      setFetchError(errorMessage);
      toast({ 
        title: 'Teams Refresh Error', 
        description: errorMessage, 
        variant: 'destructive' 
      });
    }
  };

  const refreshPlayers = async () => {
    try {
      const { supabase } = await import('../supabaseClient');
      
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .order('first_name', { ascending: true });

      if (playersError) {
        console.error('Error fetching players:', playersError);
        setPlayers([]);
        return;
      }

      setPlayers(playersData || []);
    } catch (error) {
      console.error('Error refreshing players:', error);
    }
  };

  const refreshTournaments = async () => {
    try {
      const { supabase } = await import('../supabaseClient');
      
      const { data: tournamentsData, error: tournamentsError } = await supabase
        .from('tournaments')
        .select('*')
        .order('name', { ascending: true });

      if (tournamentsError) {
        console.error('Error fetching tournaments:', tournamentsError);
        setTournaments([]);
        return;
      }

      // Map boston_pot_cost to bostonPotCost, tracks_hands to tracksHands, and scoring_mode to scoringMode for frontend use
      const mappedTournaments = (tournamentsData || []).map(t => ({
        ...t,
        bostonPotCost: t.boston_pot_cost,
        tracksHands: t.tracks_hands !== false,
        scoringMode: t.scoring_mode || 'team'
      }));
      setTournaments(mappedTournaments);
    } catch (error) {
      console.error('Error refreshing tournaments:', error);
    }
  };

  const addPlayer = async (player: { first_name: string; last_name: string; phone_number: string }) => {
    try {
      const { supabase } = await import('../supabaseClient');
      
      const { data, error } = await supabase
        .from('players')
        .insert([player])
        .select()
        .single();

      if (error) {
        console.error('Error adding player:', error);
        toast({ title: 'Error adding player', description: error.message, variant: 'destructive' });
        return;
      }

      toast({ title: 'Player added successfully' });
      await refreshPlayers();
    } catch (error) {
      console.error('Error adding player:', error);
      toast({ title: 'Error adding player', description: String(error), variant: 'destructive' });
    }
  };

  const addTeamToTournament = async (teamId: string, tournamentId: string) => {
    try {
      const { supabase } = await import('../supabaseClient');
      
      // Check if team is already in tournament
      const { data: existing, error: checkError } = await supabase
        .from('team_registrations')
        .select('*')
        .eq('team_id', teamId)
        .eq('tournament_id', tournamentId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('Error checking team tournament:', checkError);
        return;
      }

      if (existing) {
        // Team already in tournament
        return;
      }

      // Add team to tournament
      const { error } = await supabase
        .from('team_registrations')
        .insert([{
          team_id: teamId,
          tournament_id: tournamentId
        }]);

      if (error) {
        console.error('Error adding team to tournament:', error);
        toast({ title: 'Error adding team to tournament', description: error.message, variant: 'destructive' });
        return;
      }

      toast({ title: 'Team added to tournament successfully' });
      await refreshTeams();
    } catch (error) {
      console.error('Error adding team to tournament:', error);
      toast({ title: 'Error adding team to tournament', description: String(error), variant: 'destructive' });
    }
  };

  const beginScoreEntry = async ({ matchId, teamId, teamA, teamB, round }: { matchId: string; teamId: string; teamA: string; teamB: string; round: number }) => {
    try {
      // Check existing game for this match
      const { data: existing, error: selErr } = await supabase
        .from('games')
        .select('*')
        .eq('matchId', matchId)
        .in('status', ['entering', 'pending_confirmation', 'disputed']);
      if (selErr) {
        console.error('beginScoreEntry select error:', selErr);
        return { ok: false, reason: 'error' as const };
      }
      if (existing && existing.length > 0) {
        const g = existing[0];
        // If another team holds the lock, deny
        if (g.status === 'entering' && String(g.entered_by_team_id) !== String(teamId)) {
          return { ok: false, reason: 'conflict' as const };
        }
        if (g.status === 'pending_confirmation') {
          return { ok: false, reason: 'conflict' as const };
        }
        // For disputed status, only allow the team that originally entered the score to re-enter
        if (g.status === 'disputed' && String(g.entered_by_team_id) !== String(teamId)) {
          return { ok: false, reason: 'conflict' as const };
        }
      }
      
      // Check if a teammate is already entering a score for this match
      const { data: teammateEntry, error: teammateErr } = await supabase
        .from('games')
        .select('*')
        .eq('matchId', matchId)
        .eq('status', 'entering');
      
      if (teammateErr) {
        console.error('beginScoreEntry teammate check error:', teammateErr);
        return { ok: false, reason: 'error' as const };
      }
      
      if (teammateEntry && teammateEntry.length > 0) {
        const teammateGame = teammateEntry[0];
        // Check if the entering team is the same team (different player)
        if (String(teammateGame.entered_by_team_id) === String(teamId)) {
          return { ok: false, reason: 'teammate_entering' as const };
        }
      }
      // Upsert entering record
      const id = existing && existing[0] ? existing[0].id : Date.now().toString();
      const row: any = {
        id,
        matchId,
        teamA: String(teamA),
        teamB: String(teamB),
        round,
        scoreA: 0,
        scoreB: 0,
        boston_a: 0,
        boston_b: 0,
        handsA: 0,
        handsB: 0,
        status: 'entering',
        entered_by_team_id: String(teamId),
        confirmed: false,
        timestamp: new Date().toISOString(),
      };
      const { error } = await supabase.from('games').upsert([row], { onConflict: ['id'] });
      if (error) {
        console.error('beginScoreEntry upsert error:', error);
        return { ok: false, reason: 'error' as const };
      }
      await refreshGamesFromSupabase();
      return { ok: true };
    } catch (error) {
      console.error('beginScoreEntry catch error:', error);
      return { ok: false, reason: 'error' as const };
    }
  };

  const releaseScoreEntryLock = async ({ matchId, teamId }: { matchId: string; teamId: string }) => {
    try {
      const { error } = await supabase
        .from('games')
        .delete()
        .eq('matchId', matchId)
        .eq('status', 'entering')
        .eq('entered_by_team_id', teamId);
      
      if (error) {
        console.error('Error releasing score entry lock:', error);
        return { ok: false };
      }
      
      await refreshGamesFromSupabase();
      return { ok: true };
    } catch (error) {
      console.error('Error releasing score entry lock:', error);
      return { ok: false };
    }
  };

  return (
    <AppContext.Provider value={{
      sidebarOpen, toggleSidebar: () => setSidebarOpen(prev => !prev), teams, players, games, setGames, tournaments, setTournaments, schedules, scoreTexts, tournamentResults, setTournamentResults, brackets, cities, currentUser, setCurrentUser, scoreSubmissions, setScoreSubmissions, resetAllTournamentData, fetchError,
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
        const { supabase } = await import('../supabaseClient');
        
        try {
          // First, create or find player1
          const { data: player1Data, error: player1Error } = await supabase
            .from('players')
            .insert([{
              first_name: player1First,
              last_name: player1Last,
              phone_number: phoneNumber,
              city
            }])
            .select()
            .single();
          
          if (player1Error) {
            toast({ title: 'Failed to create player 1', description: player1Error.message, variant: 'destructive' });
            return null;
          }

          // Create or find player2
          const { data: player2Data, error: player2Error } = await supabase
            .from('players')
            .insert([{
              first_name: player2First,
              last_name: player2Last,
              phone_number: phoneNumber,
              city
            }])
            .select()
            .single();
          
          if (player2Error) {
            toast({ title: 'Failed to create player 2', description: player2Error.message, variant: 'destructive' });
            return null;
          }

          // Create team name
          const teamName = `${player1First}/${player2First}`;

          // Create team
          const { data: teamData, error: teamError } = await supabase
            .from('teams')
            .insert([{
              name: teamName,
              player1_id: player1Data.id,
              player2_id: player2Data.id
            }])
            .select()
            .single();

          if (teamError) {
            toast({ title: 'Failed to create team', description: teamError.message, variant: 'destructive' });
            return null;
          }

          // Insert into team_registrations join table
          if (selectedTournaments && selectedTournaments.length > 0) {
            const regs = selectedTournaments.map(tournament_id => ({ 
              team_id: teamData.id, 
              tournament_id 
            }));
            await supabase.from('team_registrations').insert(regs);
          }

          // Refetch teams with player data
          const { data: teamsData, error: teamsError } = await supabase
            .from('teams')
            .select(`
              *,
              player1:players!player1_id(*),
              player2:players!player2_id(*)
            `);

          if (teamsError) {
            toast({ title: 'Error reloading teams', description: teamsError.message, variant: 'destructive' });
          }

          // Refetch team_registrations
          const { data: registrations, error: regError } = await supabase.from('team_registrations').select('*');

          if (!teamsError && !regError) {
            // Map registeredTournaments onto each team and populate legacy fields
            const teamsWithTournaments = (teamsData || []).map(team => {
              const regs = registrations.filter(r => String(r.team_id) === String(team.id));
              const regTournaments = regs.map(r => r.tournament_id);
              
              return {
                ...team,
                id: String(team.id),
                // Populate legacy fields from player data for backward compatibility
                player1FirstName: team.player1?.first_name || '',
                player1LastName: team.player1?.last_name || '',
                player2FirstName: team.player2?.first_name || '',
                player2LastName: team.player2?.last_name || '',
                phoneNumber: team.player1?.phone_number || team.player2?.phone_number || '',
                city: team.player1?.city || team.player2?.city || '',
                registeredTournaments: regTournaments
              };
            });
            setTeams(teamsWithTournaments);
          } else if (teamsData) {
            setTeams(teamsData);
          }

          toast({ title: `Team ${teamName} registered successfully!` });
          return String(teamData.id);
        } catch (error) {
          toast({ title: 'Failed to register team', description: String(error), variant: 'destructive' });
          return null;
        }
      },
      updateTeam: async (updatedTeam: Team) => {
        const { supabase } = await import('../supabaseClient');
        
        try {
          // Update team fields including city
          const { id, registeredTournaments, bostonPotTournaments, city, phoneNumber, player1_phone, player2_phone } = updatedTeam;
          
          // Update team record with name and city (only fields that exist in DB)
          const { error: teamUpdateError } = await supabase
            .from('teams')
            .update({ 
              name: updatedTeam.name,
              city: city || null
            })
            .eq('id', id);
          
          if (teamUpdateError) {
            toast({ title: 'Error updating team', description: teamUpdateError.message, variant: 'destructive' });
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

          // Update Boston Pot registrations if bostonPotTournaments is present
          if (Array.isArray(bostonPotTournaments)) {
            console.log('Updating Boston Pot registrations:', {
              teamId: id,
              bostonPotTournaments,
              registeredTournaments
            });
            
            // Update player_tournament records to set entered_boston_pot
            const { data: teamData } = await supabase
              .from('teams')
              .select('player1_id, player2_id')
              .eq('id', id)
              .single();

            if (teamData) {
              // Create or update player_tournament records for all tournaments
              for (const tournamentId of registeredTournaments || []) {
                const isInBostonPot = bostonPotTournaments.includes(tournamentId);
                console.log(`Setting player1 (${teamData.player1_id}) Boston Pot for tournament ${tournamentId}: ${isInBostonPot}`);
                
                // Check if player1 record exists
                const { data: existingPlayer1 } = await supabase
                  .from('player_tournament')
                  .select('id')
                  .eq('player_id', teamData.player1_id)
                  .eq('tournament_id', tournamentId)
                  .single();

                if (existingPlayer1) {
                  // Update existing record
                  const { error: player1Error } = await supabase
                    .from('player_tournament')
                    .update({ entered_boston_pot: isInBostonPot })
                    .eq('player_id', teamData.player1_id)
                    .eq('tournament_id', tournamentId);
                  
                  if (player1Error) {
                    console.error('Error updating player1 Boston Pot:', player1Error);
                  }
                } else {
                  // Create new record
                  const { error: player1Error } = await supabase
                    .from('player_tournament')
                    .insert({
                      player_id: teamData.player1_id,
                      tournament_id: tournamentId,
                      paid: false,
                      b_paid: false,
                      entered_boston_pot: isInBostonPot
                    });
                  
                  if (player1Error) {
                    console.error('Error creating player1 record:', player1Error);
                  }
                }

                console.log(`Setting player2 (${teamData.player2_id}) Boston Pot for tournament ${tournamentId}: ${isInBostonPot}`);
                
                // Check if player2 record exists
                const { data: existingPlayer2 } = await supabase
                  .from('player_tournament')
                  .select('id')
                  .eq('player_id', teamData.player2_id)
                  .eq('tournament_id', tournamentId)
                  .single();

                if (existingPlayer2) {
                  // Update existing record
                  const { error: player2Error } = await supabase
                    .from('player_tournament')
                    .update({ entered_boston_pot: isInBostonPot })
                    .eq('player_id', teamData.player2_id)
                    .eq('tournament_id', tournamentId);
                  
                  if (player2Error) {
                    console.error('Error updating player2 Boston Pot:', player2Error);
                  }
                } else {
                  // Create new record
                  const { error: player2Error } = await supabase
                    .from('player_tournament')
                    .insert({
                      player_id: teamData.player2_id,
                      tournament_id: tournamentId,
                      paid: false,
                      b_paid: false,
                      entered_boston_pot: isInBostonPot
                    });
                  
                  if (player2Error) {
                    console.error('Error creating player2 record:', player2Error);
                  }
                }
              }
            }
          }

          // Refetch teams with player data
          const { data: teamsData, error: teamsError } = await supabase
            .from('teams')
            .select(`
              *,
              player1:players!player1_id(*),
              player2:players!player2_id(*)
            `);

          if (teamsError) {
            toast({ title: 'Error reloading teams', description: teamsError.message, variant: 'destructive' });
            return;
          }

          // Refetch team_registrations
          const { data: registrations, error: regError } = await supabase.from('team_registrations').select('*');

          if (!teamsError && !regError) {
            // Fetch player_tournament data to determine Boston Pot status
            const { data: playerTournamentData, error: playerTournamentError } = await supabase
              .from('player_tournament')
              .select('player_id, tournament_id, entered_boston_pot')
              .in('player_id', teamsData.map(t => [t.player1_id, t.player2_id]).flat())
              .in('tournament_id', registrations.map(r => r.tournament_id));

            if (playerTournamentError) {
              console.error('Error fetching player tournament data:', playerTournamentError);
            }

            // Map registeredTournaments onto each team and populate legacy fields
            const teamsWithTournaments = (teamsData || []).map(team => {
              const regs = registrations.filter(r => String(r.team_id) === String(team.id));
              const regTournaments = regs.map(r => r.tournament_id);
              
              // Determine Boston Pot tournaments for this team
              const bostonPotTournaments: string[] = [];
              if (regTournaments.length > 0 && playerTournamentData) {
                const player1BostonPotTournaments = new Set<string>();
                const player2BostonPotTournaments = new Set<string>();
                
                playerTournamentData.forEach(pt => {
                  if (pt.player_id === team.player1_id && pt.entered_boston_pot) {
                    player1BostonPotTournaments.add(pt.tournament_id);
                  } else if (pt.player_id === team.player2_id && pt.entered_boston_pot) {
                    player2BostonPotTournaments.add(pt.tournament_id);
                  }
                });
                
                // Team is in Boston Pot if both players are in Boston Pot for the same tournament
                regTournaments.forEach(tournamentId => {
                  if (player1BostonPotTournaments.has(tournamentId) && player2BostonPotTournaments.has(tournamentId)) {
                    bostonPotTournaments.push(tournamentId);
                  }
                });
                
                console.log(`Team ${team.id} Boston Pot tournaments: ${bostonPotTournaments.join(', ')}`);
              }
              
              return {
                ...team,
                id: String(team.id),
                // Populate legacy fields from player data for backward compatibility
                player1FirstName: team.player1?.first_name || '',
                player1LastName: team.player1?.last_name || '',
                player2FirstName: team.player2?.first_name || '',
                player2LastName: team.player2?.last_name || '',
                phoneNumber: team.player1?.phone_number || team.player2?.phone_number || '',
                player1_phone: team.player1?.phone_number || '',
                player2_phone: team.player2?.phone_number || '',
                city: team.city || '', // Use team's city field directly
                registeredTournaments: regTournaments,
                bostonPotTournaments: bostonPotTournaments
              };
            });
            setTeams(teamsWithTournaments);
          } else if (teamsData) {
            setTeams(teamsData);
          }

          toast({ title: 'Team updated successfully!' });
        } catch (error) {
          toast({ title: 'Failed to update team', description: String(error), variant: 'destructive' });
        }
      },
      submitGame,
      beginScoreEntry,
      releaseScoreEntryLock,
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
      addTournament: (name: string, cost: number, bostonPotCost: number, description?: string, tracksHands: boolean = true) => {
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
          status: 'active' as Tournament['status'],
          tracksHands: tracksHands
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
      updateTournament: async (id: string, name: string, cost: number, bostonPotCost: number, description?: string, status?: string, tracksHands?: boolean, scoringMode?: 'team' | 'admin') => {
        const { supabase } = await import('../supabaseClient');
        // Update in Supabase
        const updateData: any = {
          name,
          cost,
          boston_pot_cost: bostonPotCost,
          status,
          description
        };
        if (tracksHands !== undefined) {
          updateData.tracks_hands = tracksHands;
        }
        if (scoringMode !== undefined) {
          updateData.scoring_mode = scoringMode;
        }
        const { error } = await supabase
          .from('tournaments')
          .update(updateData)
          .eq('id', id);
        if (error) {
          toast({ title: 'Failed to update tournament in database.', description: error.message, variant: 'destructive' });
          return;
        }
        // Refetch tournaments from Supabase to update local state
        const { data: tournamentsData, error: fetchError } = await supabase.from('tournaments').select('*');
        if (!fetchError) {
          // Map boston_pot_cost to bostonPotCost, tracks_hands to tracksHands, and scoring_mode to scoringMode for frontend use
          const mappedTournaments = (tournamentsData || []).map(t => ({
            ...t,
            bostonPotCost: t.boston_pot_cost,
            tracksHands: t.tracks_hands !== false,
            scoringMode: t.scoring_mode || 'team'
          }));
          setTournaments(mappedTournaments);
        }
        toast({ title: `Tournament "${name}" updated successfully!` });
      },
      createTournament: async (name: string, status: 'pending' | 'active' | 'finished') => {
        const { supabase } = await import('../supabaseClient');
        const { data, error } = await supabase
          .from('tournaments')
          .insert([{
            name,
            status,
            cost: 0,
            boston_pot_cost: 0,
            tracks_hands: true
          }])
          .select()
          .single();

        if (error) {
          toast({ title: 'Failed to create tournament in database.', description: error.message, variant: 'destructive' });
          return;
        }

        // Refetch tournaments from Supabase to update local state
        const { data: tournamentsData, error: fetchError } = await supabase.from('tournaments').select('*');
        if (!fetchError) {
          // Map boston_pot_cost to bostonPotCost, tracks_hands to tracksHands, and scoring_mode to scoringMode for frontend use
          const mappedTournaments = (tournamentsData || []).map(t => ({
            ...t,
            bostonPotCost: t.boston_pot_cost,
            tracksHands: t.tracks_hands !== false,
            scoringMode: t.scoring_mode || 'team'
          }));
          setTournaments(mappedTournaments);
        }
        toast({ title: `Tournament "${name}" created successfully!` });
      },
      updateTournamentStatus: async (tournament: Tournament) => {
        const { supabase } = await import('../supabaseClient');
        const { error } = await supabase
          .from('tournaments')
          .update({
            name: tournament.name,
            status: tournament.status
          })
          .eq('id', tournament.id);

        if (error) {
          toast({ title: 'Failed to update tournament in database.', description: error.message, variant: 'destructive' });
          return;
        }

        // Refetch tournaments from Supabase to update local state
        const { data: tournamentsData, error: fetchError } = await supabase.from('tournaments').select('*');
        if (!fetchError) {
          // Map boston_pot_cost to bostonPotCost, tracks_hands to tracksHands, and scoring_mode to scoringMode for frontend use
          const mappedTournaments = (tournamentsData || []).map(t => ({
            ...t,
            bostonPotCost: t.boston_pot_cost,
            tracksHands: t.tracks_hands !== false,
            scoringMode: t.scoring_mode || 'team'
          }));
          setTournaments(mappedTournaments);
        }
        toast({ title: `Tournament "${tournament.name}" updated successfully!` });
      },
      deleteTournament: async (tournamentId: string) => {
        const { supabase } = await import('../supabaseClient');
        const { error } = await supabase
          .from('tournaments')
          .delete()
          .eq('id', tournamentId);

        if (error) {
          toast({ title: 'Failed to delete tournament from database.', description: error.message, variant: 'destructive' });
          return;
        }

        // Refetch tournaments from Supabase to update local state
        const { data: tournamentsData, error: fetchError } = await supabase.from('tournaments').select('*');
        if (!fetchError) {
          // Map boston_pot_cost to bostonPotCost, tracks_hands to tracksHands, and scoring_mode to scoringMode for frontend use
          const mappedTournaments = (tournamentsData || []).map(t => ({
            ...t,
            bostonPotCost: t.boston_pot_cost,
            tracksHands: t.tracks_hands !== false,
            scoringMode: t.scoring_mode || 'team'
          }));
          setTournaments(mappedTournaments);
        }
        toast({ title: 'Tournament deleted successfully!' });
      },
      updatePaymentStatus: () => {}, 
      updatePlayerPaymentStatus: () => {}, 
      updatePlayerTournamentPayment, 
      updateTeamPayment, 
      updatePlayerPayment, 
      getPlayerTournamentPayments, 
      getTeamPaymentStatus, 
      calculateTeamTotalOwed, 
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
      refreshGamesFromSupabase,
      createTeamFromPlayers,
      refreshTeams,
      refreshPlayers,
      refreshTournaments,
      addPlayer,
      addTeamToTournament,
      messages,
      addMessage: async (message: Omit<Message, 'id' | 'createdAt'>) => {
        try {
          const { data, error } = await supabase
            .from('messages')
            .insert([{
              text: message.text,
              type: message.type,
              active: message.active,
              expires_at: message.expiresAt,
              created_by: message.createdBy || 'admin'
            }])
            .select()
            .single();
          
          if (error) {
            console.error('Error adding message:', error);
            toast({ title: 'Error adding message', variant: 'destructive' });
            return;
          }
          
          // Let the real-time subscription handle the state update
          toast({ title: 'Message added successfully!' });
        } catch (error) {
          console.error('Error adding message:', error);
          toast({ title: 'Error adding message', variant: 'destructive' });
        }
      },
      updateMessage: async (id: string, updates: Partial<Message>) => {
        try {
          const updateData: any = {};
          if (updates.text !== undefined) updateData.text = updates.text;
          if (updates.type !== undefined) updateData.type = updates.type;
          if (updates.active !== undefined) updateData.active = updates.active;
          if (updates.expiresAt !== undefined) updateData.expires_at = updates.expiresAt;
          
          const { error } = await supabase
            .from('messages')
            .update(updateData)
            .eq('id', id);
          
          if (error) {
            console.error('Error updating message:', error);
            toast({ title: 'Error updating message', variant: 'destructive' });
            return;
          }
          
          // Let the real-time subscription handle the state update
          toast({ title: 'Message updated successfully!' });
        } catch (error) {
          console.error('Error updating message:', error);
          toast({ title: 'Error updating message', variant: 'destructive' });
        }
      },
      deleteMessage: async (id: string) => {
        try {
          const { error } = await supabase
            .from('messages')
            .delete()
            .eq('id', id);
          
          if (error) {
            console.error('Error deleting message:', error);
            toast({ title: 'Error deleting message', variant: 'destructive' });
            return;
          }
          
          // Let the real-time subscription handle the state update
          toast({ title: 'Message deleted successfully!' });
        } catch (error) {
          console.error('Error deleting message:', error);
          toast({ title: 'Error deleting message', variant: 'destructive' });
        }
      },
      getActiveMessages: () => {
        const activeMessages = messages.filter(msg => msg.active);
        return activeMessages;
      }
    }}>
      {children}
    </AppContext.Provider>
  );
};