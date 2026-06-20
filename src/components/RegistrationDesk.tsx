import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  ClipboardList, Search, Pencil, RefreshCw, X, Settings, ChevronDown, ChevronUp,
} from 'lucide-react';

// ── Local types ───────────────────────────────────────────────────────────────
interface DeskPlayer {
  id: number;
  first_name: string;
  last_name: string;
  phone_number: string | null;
}

interface DeskTournEntry {
  tournament_id: string;
  p1_paid: boolean;
  p2_paid: boolean;
  p1_prepaid: boolean;
  p2_prepaid: boolean;
  p1_boston: boolean;
  p2_boston: boolean;
}

interface DeskTeam {
  id: number;
  name: string;
  city: string | null;
  created_at: string;
  player1: DeskPlayer;
  player2: DeskPlayer | null;
  tournaments: DeskTournEntry[];
}

// ── Blank form ────────────────────────────────────────────────────────────────
const BLANK = {
  p1First: '', p1Last: '', p1Phone: '',
  p1Prepaid: false, p1PayNow: true,
  p2First: '', p2Last: '', p2Phone: '',
  p2Prepaid: false, p2PayNow: true,
  city: '',
  selectedTourneys: [] as string[],
  bostonPotTourneys: [] as string[],
};

// ── Component ─────────────────────────────────────────────────────────────────
export const RegistrationDesk: React.FC = () => {
  const { tournaments, refreshTeams, refreshPlayers } = useAppContext();
  const activeTourneys = tournaments.filter(t => t.status !== 'finished');

  // ── Desk tournament filter (persisted to localStorage) ────────────────────
  const [deskTourneys, setDeskTourneys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('desk_filter_tourneys');
      if (saved) return JSON.parse(saved) as string[];
    } catch {}
    return [];
  });
  const [showFilter, setShowFilter] = useState(false);

  // When tournaments load/change, default-check any new active ones not yet saved
  useEffect(() => {
    if (activeTourneys.length === 0) return;
    setDeskTourneys(prev => {
      const added = activeTourneys.filter(t => !prev.includes(t.id)).map(t => t.id);
      if (added.length === 0) return prev;
      const next = [...prev, ...added];
      localStorage.setItem('desk_filter_tourneys', JSON.stringify(next));
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournaments.length]);

  const toggleDeskTourney = (tid: string) => {
    setDeskTourneys(prev => {
      const next = prev.includes(tid) ? prev.filter(x => x !== tid) : [...prev, tid];
      localStorage.setItem('desk_filter_tourneys', JSON.stringify(next));
      return next;
    });
  };

  // ── State ─────────────────────────────────────────────────────────────────
  const [form, setForm]           = useState({ ...BLANK });
  const [deskTeams, setDeskTeams] = useState<DeskTeam[]>([]);
  const [loading, setLoading]     = useState(false);
  const [search, setSearch]       = useState('');
  const [filterTourney, setFilterTourney] = useState('all');
  const [filterStatus, setFilterStatus]   = useState('all');
  const [editingTeam, setEditingTeam]     = useState<DeskTeam | null>(null);

  // Typeahead suggestions
  const [p1Sugg, setP1Sugg] = useState<DeskPlayer[]>([]);
  const [p2Sugg, setP2Sugg] = useState<DeskPlayer[]>([]);
  const [p1ShowSugg, setP1ShowSugg] = useState(false);
  const [p2ShowSugg, setP2ShowSugg] = useState(false);

  // Duplicate tournament detection
  const [dupTourneys, setDupTourneys] = useState<string[]>([]);

  // Refs to auto-focus first name when phone has no match
  const p1FirstRef = useRef<HTMLInputElement>(null);
  const p2FirstRef = useRef<HTMLInputElement>(null);

  // ── Load from original tables ─────────────────────────────────────────────
  const loadDesk = useCallback(async () => {
    const { supabase } = await import('../supabaseClient');

    // Fetch all three tables separately to avoid FK-hint ambiguity in nested selects
    const [
      { data: teamsData },
      { data: trData },
      { data: ptData },
    ] = await Promise.all([
      supabase
        .from('teams')
        .select(`
          id, name, city, created_at,
          player1:players!player1_id(id, first_name, last_name, phone_number),
          player2:players!player2_id(id, first_name, last_name, phone_number)
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('team_registrations')
        .select('team_id, tournament_id'),
      supabase
        .from('player_tournament')
        .select('player_id, tournament_id, paid, b_paid, prepaid, entered_boston_pot'),
    ]);

    // Build team_id → [tournament_id] map
    const teamTourneyMap = new Map<number, string[]>();
    for (const tr of (trData || [])) {
      const key = Number(tr.team_id);
      if (!teamTourneyMap.has(key)) teamTourneyMap.set(key, []);
      teamTourneyMap.get(key)!.push(tr.tournament_id);
    }

    const result: DeskTeam[] = (teamsData || [])
      .filter(t => {
        const tourneys = teamTourneyMap.get(Number(t.id)) ?? [];
        // Show if it has at least one desk-active tournament
        // If deskTourneys is empty (still loading), show all teams that have any registration
        return deskTourneys.length === 0
          ? tourneys.length > 0
          : tourneys.some(tid => deskTourneys.includes(tid));
      })
      .map(team => {
        const allTourneys = teamTourneyMap.get(Number(team.id)) ?? [];
        const visibleTourneys = deskTourneys.length === 0
          ? allTourneys
          : allTourneys.filter(tid => deskTourneys.includes(tid));

        return {
          id:         Number(team.id),
          name:       team.name,
          city:       team.city,
          created_at: team.created_at,
          player1:    team.player1 as DeskPlayer,
          player2:    team.player2 as DeskPlayer | null,
          tournaments: visibleTourneys.map(tid => {
            const p1pt = (ptData || []).find(
              p => String(p.player_id) === String((team.player1 as any)?.id) && p.tournament_id === tid
            );
            const p2pt = team.player2
              ? (ptData || []).find(
                  p => String(p.player_id) === String((team.player2 as any)?.id) && p.tournament_id === tid
                )
              : null;
            return {
              tournament_id: tid,
              p1_paid:    p1pt?.paid             ?? false,
              p2_paid:    p2pt?.paid             ?? false,
              p1_prepaid: p1pt?.prepaid          ?? false,
              p2_prepaid: p2pt?.prepaid          ?? false,
              p1_boston:  p1pt?.entered_boston_pot ?? false,
              p2_boston:  p2pt?.entered_boston_pot ?? false,
            };
          }),
        };
      });

    setDeskTeams(result);
  }, [deskTourneys]);

  useEffect(() => { loadDesk(); }, [loadDesk]);

  useEffect(() => {
    const onFocus = () => loadDesk();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadDesk]);

  // ── Duplicate tournament detection ────────────────────────────────────────
  useEffect(() => {
    if (editingTeam) { setDupTourneys([]); return; }

    const check = async () => {
      const phones = [form.p1Phone, form.p2Phone]
        .map(p => p.replace(/\D/g, ''))
        .filter(p => p.length >= 7);

      if (!phones.length || !form.selectedTourneys.length) { setDupTourneys([]); return; }

      const { supabase } = await import('../supabaseClient');

      // Find player IDs for these phone numbers (limit 1 each in case of legacy dups)
      const { data: players } = await supabase
        .from('players')
        .select('id')
        .in('phone_number', phones);

      if (!players || players.length === 0) { setDupTourneys([]); return; }

      const playerIds = players.map(p => p.id);
      const dups: string[] = [];

      for (const tid of form.selectedTourneys) {
        const { data } = await supabase
          .from('player_tournament')
          .select('id')
          .in('player_id', playerIds)
          .eq('tournament_id', tid)
          .limit(1);
        if (data && data.length > 0) dups.push(tid);
      }
      setDupTourneys(dups);
    };
    check();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.p1Phone, form.p2Phone, JSON.stringify(form.selectedTourneys), editingTeam]);

  // ── Phone typeahead ───────────────────────────────────────────────────────
  const handlePhoneChange = useCallback(async (value: string, slot: 'p1' | 'p2') => {
    if (slot === 'p1') setForm(f => ({ ...f, p1Phone: value }));
    else               setForm(f => ({ ...f, p2Phone: value }));

    const digits = value.replace(/\D/g, '');

    if (digits.length < 3) {
      if (slot === 'p1') { setP1Sugg([]); setP1ShowSugg(false); }
      else               { setP2Sugg([]); setP2ShowSugg(false); }
      return;
    }

    const { supabase } = await import('../supabaseClient');
    const { data } = await supabase
      .from('players')
      .select('id, first_name, last_name, phone_number')
      .ilike('phone_number', `${digits}%`)
      .limit(6);

    const matches = (data || []) as DeskPlayer[];

    if (slot === 'p1') {
      setP1Sugg(matches);
      setP1ShowSugg(matches.length > 0);
      // 10-digit number with no match → move to first name
      if (digits.length >= 10 && matches.length === 0) {
        setTimeout(() => p1FirstRef.current?.focus(), 50);
      }
    } else {
      setP2Sugg(matches);
      setP2ShowSugg(matches.length > 0);
      if (digits.length >= 10 && matches.length === 0) {
        setTimeout(() => p2FirstRef.current?.focus(), 50);
      }
    }
  }, []);

  // ── First name typeahead ──────────────────────────────────────────────────
  const handleFirstNameChange = useCallback(async (value: string, slot: 'p1' | 'p2') => {
    if (slot === 'p1') setForm(f => ({ ...f, p1First: value }));
    else               setForm(f => ({ ...f, p2First: value }));

    if (value.trim().length < 2) {
      if (slot === 'p1') { setP1Sugg([]); setP1ShowSugg(false); }
      else               { setP2Sugg([]); setP2ShowSugg(false); }
      return;
    }

    const { supabase } = await import('../supabaseClient');
    const { data } = await supabase
      .from('players')
      .select('id, first_name, last_name, phone_number')
      .ilike('first_name', `${value.trim()}%`)
      .limit(6);

    const matches = (data || []) as DeskPlayer[];

    if (slot === 'p1') {
      setP1Sugg(matches);
      setP1ShowSugg(matches.length > 0);
    } else {
      setP2Sugg(matches);
      setP2ShowSugg(matches.length > 0);
    }
  }, []);

  const selectSuggestion = (player: DeskPlayer, slot: 'p1' | 'p2') => {
    if (slot === 'p1') {
      setForm(f => ({ ...f, p1Phone: player.phone_number ?? '', p1First: player.first_name, p1Last: player.last_name }));
      setP1Sugg([]); setP1ShowSugg(false);
    } else {
      setForm(f => ({ ...f, p2Phone: player.phone_number ?? '', p2First: player.first_name, p2Last: player.last_name }));
      setP2Sugg([]); setP2ShowSugg(false);
    }
    toast({ title: 'Player loaded', description: `${player.first_name} ${player.last_name}` });
  };

  // ── Price helpers ─────────────────────────────────────────────────────────
  const PREPAID_DISCOUNT = 30; // flat $30 off total when prepaid

  // Per-tourney walk-in price (used for individual tourney display)
  const perPlayer = (tid: string) => {
    const t = tournaments.find(x => x.id === tid);
    return t ? t.cost / 2 : 0;
  };

  // bostonPotCost is per-team; halve it for per-player ($10/team → $5/player)
  const bostonCost = (tid: string) => {
    const t = tournaments.find(x => x.id === tid);
    return (t?.bostonPotCost || 10) / 2;
  };

  // Show prepay only if at least one selected tournament has allowPrepay enabled
  const showPrepay = form.selectedTourneys.some(tid => {
    const t = tournaments.find(x => x.id === tid);
    return t?.allowPrepay === true;
  });

  // Total owed per player across all selected tourneys; prepaid = subtract $30 flat; boston = +$5/tourney
  const totalOwed = (slot: 'p1' | 'p2') => {
    const prep = slot === 'p1' ? form.p1Prepaid : form.p2Prepaid;
    const base = form.selectedTourneys.reduce((s, tid) => s + perPlayer(tid), 0);
    const boston = form.bostonPotTourneys.reduce((s, tid) => s + bostonCost(tid), 0);
    return (prep ? Math.max(0, base - PREPAID_DISCOUNT) : base) + boston;
  };

  // ── Find or create player ─────────────────────────────────────────────────
  const upsertPlayer = async (
    supabase: any, first: string, last: string, phone: string | null
  ): Promise<number | null> => {
    // Always look up by phone first — phone is the UID
    if (phone) {
      const { data: existing } = await supabase
        .from('players').select('id, first_name, last_name')
        .eq('phone_number', phone).limit(1).maybeSingle();
      if (existing) return Number(existing.id);
    }

    const { data, error } = await supabase
      .from('players')
      .insert({ first_name: first, last_name: last, phone_number: phone })
      .select('id').single();

    if (error) {
      // 23505 = unique_violation — phone was inserted between our check and insert
      if (error.code === '23505' && phone) {
        const { data: race } = await supabase
          .from('players').select('id').eq('phone_number', phone).limit(1).maybeSingle();
        if (race) return Number(race.id);
        toast({ title: 'Phone already registered', description: phone, variant: 'destructive' });
        return null;
      }
      console.error('upsertPlayer:', error);
      toast({ title: 'Failed to save player', description: error.message, variant: 'destructive' });
      return null;
    }

    return Number(data.id);
  };

  // ── Find or create team ───────────────────────────────────────────────────
  const upsertTeam = async (
    supabase: any,
    p1Id: number, p2Id: number | null,
    p1First: string, p2First: string, city: string
  ): Promise<number | null> => {
    // Look for existing team with these two players (either order)
    if (p2Id) {
      const { data: existing } = await supabase
        .from('teams').select('id')
        .or(`and(player1_id.eq.${p1Id},player2_id.eq.${p2Id}),and(player1_id.eq.${p2Id},player2_id.eq.${p1Id})`)
        .maybeSingle();
      if (existing) {
        await supabase.from('teams').update({ city }).eq('id', existing.id);
        return Number(existing.id);
      }
    }
    const teamName = p2Id ? `${p1First}/${p2First}` : p1First;
    const { data, error } = await supabase
      .from('teams')
      .insert({ name: teamName, player1_id: p1Id, player2_id: p2Id, city })
      .select('id').single();
    if (error) {
      toast({ title: 'Team creation failed', description: error.message, variant: 'destructive' });
      return null;
    }
    toast({ title: `✅ Team created — ${teamName}`, description: 'Now visible in Command Center.' });
    return Number(data.id);
  };

  // ── Upsert player_tournament (check-then-insert to avoid duplicate key) ───
  const upsertPT = async (
    supabase: any,
    playerId: number, tournamentId: string, paid: boolean, prepaid: boolean, enteredBostonPot: boolean = false
  ) => {
    const { data: existing } = await supabase
      .from('player_tournament').select('id')
      .eq('player_id', playerId).eq('tournament_id', tournamentId).maybeSingle();
    if (existing) {
      await supabase.from('player_tournament')
        .update({ paid, prepaid, entered_boston_pot: enteredBostonPot }).eq('id', existing.id);
    } else {
      await supabase.from('player_tournament')
        .insert({ player_id: playerId, tournament_id: tournamentId, paid, prepaid, b_paid: false, entered_boston_pot: enteredBostonPot });
    }
  };

  // ── Open edit (load team into top form) ───────────────────────────────────
  const openEdit = (team: DeskTeam) => {
    setForm({
      p1First:  team.player1.first_name,
      p1Last:   team.player1.last_name,
      p1Phone:  team.player1.phone_number ?? '',
      p1Prepaid: false, p1PayNow: false,
      p2First:  team.player2?.first_name ?? '',
      p2Last:   team.player2?.last_name  ?? '',
      p2Phone:  team.player2?.phone_number ?? '',
      p2Prepaid: false, p2PayNow: false,
      city:     team.city ?? '',
      selectedTourneys: [],
      bostonPotTourneys: [],
    });
    setEditingTeam(team);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => { setEditingTeam(null); setForm({ ...BLANK }); };

  // ── Remove a tournament from a team ──────────────────────────────────────
  const removeTourney = async (team: DeskTeam, tournamentId: string) => {
    const { supabase } = await import('../supabaseClient');
    await supabase.from('team_registrations')
      .delete().eq('team_id', team.id).eq('tournament_id', tournamentId);
    await supabase.from('player_tournament')
      .delete().eq('player_id', team.player1.id).eq('tournament_id', tournamentId);
    if (team.player2) {
      await supabase.from('player_tournament')
        .delete().eq('player_id', team.player2.id).eq('tournament_id', tournamentId);
    }
    toast({ title: 'Tournament removed' });

    // Keep editingTeam state in sync
    if (editingTeam?.id === team.id) {
      const updated = { ...editingTeam, tournaments: editingTeam.tournaments.filter(t => t.tournament_id !== tournamentId) };
      if (updated.tournaments.length === 0) cancelEdit();
      else setEditingTeam(updated);
    }

    await Promise.all([refreshTeams(), refreshPlayers()]);
    loadDesk();
  };

  // ── Toggle a player paid/unpaid ───────────────────────────────────────────
  const togglePaid = async (team: DeskTeam, playerId: number, tournamentId: string, currentlyPaid: boolean) => {
    const { supabase } = await import('../supabaseClient');
    const entry = team.tournaments.find(t => t.tournament_id === tournamentId);
    const isPlayer1 = playerId === team.player1.id;
    const isInBoston = isPlayer1 ? entry?.p1_boston : entry?.p2_boston;
    const updateData: Record<string, unknown> = { paid: !currentlyPaid };
    if (isInBoston) updateData.b_paid = !currentlyPaid;
    await supabase.from('player_tournament')
      .update(updateData)
      .eq('player_id', playerId)
      .eq('tournament_id', tournamentId);

    // Keep edit form in sync immediately
    if (editingTeam?.id === team.id) {
      setEditingTeam(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          tournaments: prev.tournaments.map(t =>
            t.tournament_id !== tournamentId ? t : {
              ...t,
              p1_paid: playerId === team.player1.id   ? !currentlyPaid : t.p1_paid,
              p2_paid: team.player2?.id === playerId  ? !currentlyPaid : t.p2_paid,
            }
          ),
        };
      });
    }

    await Promise.all([refreshTeams(), refreshPlayers()]);
    loadDesk();
  };

  // ── Save (new or edit) ────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.p1Phone.trim()) {
      toast({ title: 'Player 1 phone required', variant: 'destructive' }); return;
    }
    if (!form.p1First.trim()) {
      toast({ title: 'Player 1 first name required', variant: 'destructive' }); return;
    }
    setLoading(true);
    try {
      const { supabase } = await import('../supabaseClient');

      if (editingTeam) {
        // ── EDIT MODE ──────────────────────────────────────────────────────

        // 1. Update P1 player info
        await supabase.from('players').update({
          first_name:   form.p1First.trim(),
          last_name:    form.p1Last.trim(),
          phone_number: form.p1Phone.trim() || null,
        }).eq('id', editingTeam.player1.id);

        // 2. Handle P2 — three cases:
        //    a) already exists → update info
        //    b) was TBD, now being added → create player + link to team
        //    c) still TBD → nothing to do
        let p2Id: number | null = editingTeam.player2?.id ?? null;

        if (editingTeam.player2) {
          // (a) update existing P2
          await supabase.from('players').update({
            first_name:   form.p2First.trim(),
            last_name:    form.p2Last.trim(),
            phone_number: form.p2Phone.trim() || null,
          }).eq('id', editingTeam.player2.id);

        } else if (form.p2First.trim() || form.p2Phone.trim()) {
          // (b) P2 was TBD — create or find them now
          p2Id = await upsertPlayer(
            supabase,
            form.p2First.trim() || 'TBD', form.p2Last.trim(),
            form.p2Phone.trim() || null
          );

          if (p2Id) {
            // Link P2 to the team and update team name
            await supabase.from('teams').update({
              player2_id: p2Id,
              name: `${form.p1First.trim()}/${form.p2First.trim()}`,
            }).eq('id', editingTeam.id);

            // Register P2 for every tournament the team is already in
            for (const et of editingTeam.tournaments) {
              await upsertPT(supabase, p2Id, et.tournament_id, form.p2PayNow, form.p2Prepaid);
            }

            toast({ title: `✅ Partner added — ${form.p2First} ${form.p2Last}` });
          }
        }

        // 3. Update city (+ name update if P1 first name changed and P2 already existed)
        const teamUpdate: Record<string, any> = { city: form.city.trim() || null };
        if (editingTeam.player2) {
          teamUpdate.name = `${form.p1First.trim()}/${form.p2First.trim()}`;
        }
        await supabase.from('teams').update(teamUpdate).eq('id', editingTeam.id);

        // 4. Add any newly selected tournaments
        for (const tid of form.selectedTourneys) {
          const inBoston = form.bostonPotTourneys.includes(tid);
          await supabase.from('team_registrations')
            .upsert({ team_id: editingTeam.id, tournament_id: tid }, { onConflict: 'team_id,tournament_id', ignoreDuplicates: true });
          await upsertPT(supabase, editingTeam.player1.id, tid, form.p1PayNow, form.p1Prepaid, inBoston);
          if (p2Id) {
            await upsertPT(supabase, p2Id, tid, form.p2PayNow, form.p2Prepaid, inBoston);
          }
        }

        toast({ title: 'Registration updated' });
        cancelEdit();

      } else {
        // ── NEW REGISTRATION ───────────────────────────────────────────────
        if (!form.selectedTourneys.length) {
          toast({ title: 'Select at least one tournament', variant: 'destructive' });
          setLoading(false); return;
        }
        if (dupTourneys.length > 0) {
          const names = dupTourneys.map(id => tName(id)).join(', ');
          toast({ title: 'Duplicate registration blocked', description: `Phone already registered for: ${names}`, variant: 'destructive' });
          setLoading(false); return;
        }

        const p1Id = await upsertPlayer(supabase, form.p1First.trim(), form.p1Last.trim(), form.p1Phone.trim() || null);
        if (!p1Id) throw new Error('Failed to create Player 1');

        let p2Id: number | null = null;
        if (form.p2First.trim() || form.p2Phone.trim()) {
          p2Id = await upsertPlayer(supabase, form.p2First.trim() || 'TBD', form.p2Last.trim(), form.p2Phone.trim() || null);
        }

        const teamId = await upsertTeam(supabase, p1Id, p2Id, form.p1First.trim(), form.p2First.trim(), form.city.trim());
        if (!teamId) throw new Error('Failed to create team');

        for (const tid of form.selectedTourneys) {
          const inBoston = form.bostonPotTourneys.includes(tid);
          await supabase.from('team_registrations')
            .upsert({ team_id: teamId, tournament_id: tid }, { onConflict: 'team_id,tournament_id', ignoreDuplicates: true });
          await upsertPT(supabase, p1Id, tid, form.p1PayNow, form.p1Prepaid, inBoston);
          if (p2Id) {
            await upsertPT(supabase, p2Id, tid, form.p2PayNow, form.p2Prepaid, inBoston);
          }
        }

        const p2Label = p2Id ? ` / ${form.p2First} ${form.p2Last}` : '';
        toast({ title: 'Registered!', description: `${form.p1First} ${form.p1Last}${p2Label}` });
        setForm({ ...BLANK });
      }

      await Promise.all([refreshTeams(), refreshPlayers()]);
      loadDesk();
    } catch (e) {
      toast({ title: 'Save failed', description: String(e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ── Filtered rolling list ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return deskTeams.filter(team => {
      const hay = [
        team.player1.first_name, team.player1.last_name, team.player1.phone_number,
        team.player2?.first_name, team.player2?.last_name, team.player2?.phone_number,
        team.city,
      ].join(' ').toLowerCase();
      const matchSearch  = !search || hay.includes(search.toLowerCase());
      const matchTourney = filterTourney === 'all' || team.tournaments.some(t => t.tournament_id === filterTourney);
      const matchStatus  =
        filterStatus === 'all'        ? true :
        filterStatus === 'paid'       ? team.tournaments.every(t => t.p1_paid && (!team.player2 || t.p2_paid)) :
        filterStatus === 'unpaid'     ? team.tournaments.some(t => !t.p1_paid || (team.player2 && !t.p2_paid)) :
        filterStatus === 'incomplete' ? !team.player2 : true;
      return matchSearch && matchTourney && matchStatus;
    });
  }, [deskTeams, search, filterTourney, filterStatus]);

  const tName = (id: string) => tournaments.find(t => t.id === id)?.name ?? id;

  // Tournaments available to add in form (desk-filtered, not already on team in edit mode)
  const addableTourneys = editingTeam
    ? activeTourneys.filter(t => deskTourneys.includes(t.id) && !editingTeam.tournaments.some(et => et.tournament_id === t.id))
    : activeTourneys.filter(t => deskTourneys.includes(t.id));

  // Quick stats per tournament
  const tourneyCount = (tid: string) =>
    deskTeams.filter(t => t.tournaments.some(tr => tr.tournament_id === tid)).length;
  const tourneyPaid = (tid: string) =>
    deskTeams.filter(t => t.tournaments.some(tr => tr.tournament_id === tid && tr.p1_paid && (!t.player2 || tr.p2_paid))).length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-5xl">

      {/* ── Desk Filter ──────────────────────────────────────────────────── */}
      <Card className="border border-gray-200">
        <CardHeader className="pb-2 pt-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Desk Tournaments
            </CardTitle>
            <button onClick={() => setShowFilter(v => !v)} className="text-gray-400 hover:text-gray-600">
              {showFilter ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
          {/* Quick stats */}
          <div className="flex flex-wrap gap-2 pt-1">
            {activeTourneys.filter(t => deskTourneys.includes(t.id)).map(t => (
              <Badge key={t.id} variant="outline" className="text-xs">
                {t.name}: {tourneyPaid(t.id)}/{tourneyCount(t.id)} paid
              </Badge>
            ))}
          </div>
        </CardHeader>
        {showFilter && (
          <CardContent className="pt-0">
            <p className="text-xs text-gray-500 mb-3">
              Select which tournaments appear on this desk. Changes are saved automatically.
            </p>
            <div className="flex flex-wrap gap-4">
              {tournaments.map(t => (
                <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox"
                    checked={deskTourneys.includes(t.id)}
                    onChange={() => toggleDeskTourney(t.id)} />
                  <span className={t.status === 'finished' ? 'text-gray-400 line-through' : ''}>{t.name}</span>
                  <span className="text-xs text-gray-400">({t.status})</span>
                </label>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Registration Form ────────────────────────────────────────────── */}
      <Card className="border-2" style={{ borderColor: editingTeam ? '#f59e0b' : '#a60002' }}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" style={{ color: editingTeam ? '#f59e0b' : '#a60002' }} />
              {editingTeam
                ? `Editing: ${editingTeam.player1.first_name} ${editingTeam.player1.last_name}${editingTeam.player2 ? ` / ${editingTeam.player2.first_name} ${editingTeam.player2.last_name}` : ''}`
                : 'New Registration'
              }
            </span>
            {editingTeam && (
              <Button variant="outline" size="sm" onClick={cancelEdit}>Cancel Edit</Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>

          {/* ── Step 1 & 2: Players (phone + name only) ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

            {/* Player 1 */}
            <div className="p-4 rounded-lg border bg-gray-50 space-y-3">
              <div className="text-xs font-bold tracking-widest" style={{ color: '#a60002' }}>PLAYER 1</div>
              <div>
                <Label className="text-xs">Phone *</Label>
                <div className="relative">
                  <Input
                    value={form.p1Phone}
                    onChange={e => handlePhoneChange(e.target.value, 'p1')}
                    onBlur={() => setTimeout(() => setP1ShowSugg(false), 150)}
                    onFocus={() => p1Sugg.length > 0 && setP1ShowSugg(true)}
                    placeholder="Phone number"
                  />
                  {p1ShowSugg && p1Sugg.length > 0 && (
                    <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
                      {p1Sugg.map(p => (
                        <li key={p.id} onMouseDown={() => selectSuggestion(p, 'p1')}
                          className="px-3 py-2 text-sm cursor-pointer hover:bg-red-50 hover:text-red-700 flex justify-between">
                          <span className="font-medium">{p.first_name} {p.last_name}</span>
                          <span className="text-gray-400 text-xs">{p.phone_number}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">First *</Label>
                  <div className="relative">
                    <Input ref={p1FirstRef} value={form.p1First}
                      onChange={e => handleFirstNameChange(e.target.value, 'p1')}
                      onBlur={() => setTimeout(() => setP1ShowSugg(false), 150)}
                      onFocus={() => p1Sugg.length > 0 && setP1ShowSugg(true)}
                      placeholder="First" />
                    {p1ShowSugg && p1Sugg.length > 0 && (
                      <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
                        {p1Sugg.map(p => (
                          <li key={p.id} onMouseDown={() => selectSuggestion(p, 'p1')}
                            className="px-3 py-2 text-sm cursor-pointer hover:bg-red-50 hover:text-red-700 flex justify-between">
                            <span className="font-medium">{p.first_name} {p.last_name}</span>
                            <span className="text-gray-400 text-xs">{p.phone_number}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Last</Label>
                  <Input value={form.p1Last}
                    onChange={e => setForm(f => ({ ...f, p1Last: e.target.value }))} placeholder="Last" />
                </div>
              </div>
            </div>

            {/* Player 2 */}
            <div className="p-4 rounded-lg border bg-gray-50 space-y-3">
              <div className="text-xs font-bold tracking-widest text-gray-400">
                PLAYER 2 <span className="font-normal normal-case">(optional)</span>
              </div>
              <div>
                <Label className="text-xs">Phone</Label>
                <div className="relative">
                  <Input
                    value={form.p2Phone}
                    onChange={e => handlePhoneChange(e.target.value, 'p2')}
                    onBlur={() => setTimeout(() => setP2ShowSugg(false), 150)}
                    onFocus={() => p2Sugg.length > 0 && setP2ShowSugg(true)}
                    placeholder="Phone number"
                  />
                  {p2ShowSugg && p2Sugg.length > 0 && (
                    <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
                      {p2Sugg.map(p => (
                        <li key={p.id} onMouseDown={() => selectSuggestion(p, 'p2')}
                          className="px-3 py-2 text-sm cursor-pointer hover:bg-red-50 hover:text-red-700 flex justify-between">
                          <span className="font-medium">{p.first_name} {p.last_name}</span>
                          <span className="text-gray-400 text-xs">{p.phone_number}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">First</Label>
                  <div className="relative">
                    <Input ref={p2FirstRef} value={form.p2First}
                      onChange={e => handleFirstNameChange(e.target.value, 'p2')}
                      onBlur={() => setTimeout(() => setP2ShowSugg(false), 150)}
                      onFocus={() => p2Sugg.length > 0 && setP2ShowSugg(true)}
                      placeholder="First" />
                    {p2ShowSugg && p2Sugg.length > 0 && (
                      <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
                        {p2Sugg.map(p => (
                          <li key={p.id} onMouseDown={() => selectSuggestion(p, 'p2')}
                            className="px-3 py-2 text-sm cursor-pointer hover:bg-red-50 hover:text-red-700 flex justify-between">
                            <span className="font-medium">{p.first_name} {p.last_name}</span>
                            <span className="text-gray-400 text-xs">{p.phone_number}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Last</Label>
                  <Input value={form.p2Last}
                    onChange={e => setForm(f => ({ ...f, p2Last: e.target.value }))} placeholder="Last" />
                </div>
              </div>
            </div>
          </div>

          {/* ── Step 3: City ── */}
          <div className="mb-4">
            <Label className="text-xs">City (team represents)</Label>
            <Input className="max-w-48" value={form.city}
              onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="City" />
          </div>

          {/* Edit mode: current tournaments with remove buttons */}
          {editingTeam && editingTeam.tournaments.length > 0 && (
            <div className="mb-4">
              <Label className="text-xs mb-2 block">Current Tournaments</Label>
              <div className="space-y-1">
                {editingTeam.tournaments.map(et => (
                  <div key={et.tournament_id} className="flex items-center gap-2 p-2 rounded border bg-white">
                    <span className="text-sm font-medium flex-1">{tName(et.tournament_id)}</span>
                    <button
                      onClick={() => togglePaid(editingTeam, editingTeam.player1.id, et.tournament_id, et.p1_paid)}
                      className={`h-6 text-xs px-2 rounded border font-medium transition-colors ${
                        et.p1_paid
                          ? 'bg-green-100 text-green-700 border-green-300 hover:bg-red-50 hover:text-red-600 hover:border-red-300'
                          : 'bg-white text-orange-700 border-orange-300 hover:bg-orange-50'
                      }`}
                      title={et.p1_paid ? 'Click to mark unpaid' : 'Click to mark paid'}
                    >
                      {(() => { const amt = (perPlayer(et.tournament_id) + (et.p1_boston ? bostonCost(et.tournament_id) : 0)).toFixed(0); return et.p1_paid ? `P1 ✓ $${amt}` : `Collect P1 $${amt}`; })()}
                    </button>

                    {editingTeam.player2 && (
                      <button
                        onClick={() => togglePaid(editingTeam, editingTeam.player2!.id, et.tournament_id, et.p2_paid)}
                        className={`h-6 text-xs px-2 rounded border font-medium transition-colors ${
                          et.p2_paid
                            ? 'bg-green-100 text-green-700 border-green-300 hover:bg-red-50 hover:text-red-600 hover:border-red-300'
                            : 'bg-white text-orange-700 border-orange-300 hover:bg-orange-50'
                        }`}
                        title={et.p2_paid ? 'Click to mark unpaid' : 'Click to mark paid'}
                      >
                        {(() => { const amt = (perPlayer(et.tournament_id) + (et.p2_boston ? bostonCost(et.tournament_id) : 0)).toFixed(0); return et.p2_paid ? `P2 ✓ $${amt}` : `Collect P2 $${amt}`; })()}
                      </button>
                    )}
                    {(et.p1_prepaid || et.p2_prepaid) && (
                      <Badge variant="outline" className="text-xs text-purple-600 border-purple-300">pre-paid</Badge>
                    )}
                    <button
                      onClick={() => removeTourney(editingTeam, et.tournament_id)}
                      className="text-red-400 hover:text-red-600 p-1 rounded ml-auto"
                      title="Remove this tournament"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 4: Tournaments ── */}
          {addableTourneys.length > 0 && (
            <div className="mb-4">
              <Label className="text-xs mb-2 block">
                {editingTeam ? 'Add More Tournaments' : 'Tournaments *'}
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {addableTourneys.map(t => {
                  const checked    = form.selectedTourneys.includes(t.id);
                  const isDup      = dupTourneys.includes(t.id);
                  const inBoston   = form.bostonPotTourneys.includes(t.id);
                  const basePrice  = perPlayer(t.id);
                  const p1Price    = basePrice + (inBoston ? bostonCost(t.id) : 0);
                  const p2Price    = (form.p2First || form.p2Phone) ? p1Price : null;
                  return (
                    <div key={t.id} className={`p-2 rounded border text-sm transition-colors ${
                      isDup   ? 'border-red-400 bg-red-50' :
                      checked ? 'border-green-400 bg-green-50' :
                                'border-gray-200 hover:border-gray-400'
                    }`}>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input type="checkbox" className="mt-0.5" checked={checked}
                          onChange={e => setForm(f => ({
                            ...f,
                            selectedTourneys: e.target.checked
                              ? [...f.selectedTourneys, t.id]
                              : f.selectedTourneys.filter(x => x !== t.id),
                            bostonPotTourneys: e.target.checked
                              ? f.bostonPotTourneys
                              : f.bostonPotTourneys.filter(x => x !== t.id),
                          }))} />
                        <span>
                          <span className="font-medium block">{t.name}</span>
                          <span className="text-xs text-gray-500">
                            ${p1Price}/P1{p2Price !== null ? ` · $${p2Price}/P2` : ''}
                          </span>
                          {isDup && <span className="text-xs text-red-600 font-medium block">⚠ already registered</span>}
                        </span>
                      </label>
                      {checked && (
                        <label className="flex items-center gap-1.5 mt-1.5 ml-5 cursor-pointer text-xs font-medium" style={{ color: '#a60002' }}>
                          <input type="checkbox"
                            checked={form.bostonPotTourneys.includes(t.id)}
                            onChange={e => setForm(f => ({
                              ...f,
                              bostonPotTourneys: e.target.checked
                                ? [...f.bostonPotTourneys, t.id]
                                : f.bostonPotTourneys.filter(x => x !== t.id),
                            }))} />
                          Boston Pot (+${bostonCost(t.id)}/player)
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Step 5: Payment + REGISTER ── */}
          <div className="pt-3 border-t mt-2 space-y-3">
            <div className="flex flex-wrap gap-6 items-center">

              {/* P1 payment */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold tracking-widest" style={{ color: '#a60002' }}>P1</span>
                {showPrepay && (
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
                    <input type="checkbox" checked={form.p1Prepaid}
                      onChange={e => setForm(f => ({ ...f, p1Prepaid: e.target.checked }))} />
                    Pre-paid
                  </label>
                )}
                <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
                  <input type="checkbox" checked={form.p1PayNow}
                    onChange={e => setForm(f => ({ ...f, p1PayNow: e.target.checked }))} />
                  Paid
                </label>
                {form.selectedTourneys.length > 0 && (
                  <span className={`text-sm font-semibold ${form.p1PayNow ? 'text-green-600' : 'text-orange-600'}`}>
                    ${totalOwed('p1').toFixed(0)}{form.p1PayNow ? ' ✓' : ' owed'}
                  </span>
                )}
              </div>

              {/* P2 payment — only if P2 entered */}
              {(form.p2First || form.p2Phone) && (
                <>
                  <div className="w-px h-5 bg-gray-200" />
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold tracking-widest text-gray-500">P2</span>
                    {showPrepay && (
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
                        <input type="checkbox" checked={form.p2Prepaid}
                          onChange={e => setForm(f => ({ ...f, p2Prepaid: e.target.checked }))} />
                        Pre-paid
                      </label>
                    )}
                    <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
                      <input type="checkbox" checked={form.p2PayNow}
                        onChange={e => setForm(f => ({ ...f, p2PayNow: e.target.checked }))} />
                      Paid
                    </label>
                    {form.selectedTourneys.length > 0 && (
                      <span className={`text-sm font-semibold ${form.p2PayNow ? 'text-green-600' : 'text-orange-600'}`}>
                        ${totalOwed('p2').toFixed(0)}{form.p2PayNow ? ' ✓' : ' owed'}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-between">
              {form.selectedTourneys.length > 0 ? (
                <span className="text-sm text-gray-500">
                  Total collected: <strong className="text-gray-800">
                    ${((form.p1PayNow ? totalOwed('p1') : 0) + ((form.p2First || form.p2Phone) && form.p2PayNow ? totalOwed('p2') : 0)).toFixed(0)}
                  </strong>
                </span>
              ) : <span />}
              <Button
                onClick={handleSave}
                disabled={loading || (!editingTeam && dupTourneys.length > 0)}
                className="px-8"
                style={{ backgroundColor: editingTeam ? '#f59e0b' : '#a60002', color: 'white' }}
              >
                {loading ? 'Saving…' : editingTeam ? 'Save Changes' : 'REGISTER'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Rolling List ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span>
              All Registrations{' '}
              <span className="text-gray-400 font-normal text-sm">
                ({filtered.length}{filtered.length !== deskTeams.length ? ` of ${deskTeams.length}` : ''} teams)
              </span>
            </span>
            <button onClick={loadDesk} className="text-gray-400 hover:text-gray-700 p-1 rounded" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="flex items-center gap-1 border rounded px-2 py-1 flex-1 min-w-48">
              <Search className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
              <input
                className="text-sm outline-none flex-1 bg-transparent"
                placeholder="Search name, phone, city…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select className="border rounded px-2 py-1 text-sm" value={filterTourney} onChange={e => setFilterTourney(e.target.value)}>
              <option value="all">All Tournaments</option>
              {activeTourneys.filter(t => deskTourneys.includes(t.id)).map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <select className="border rounded px-2 py-1 text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All Status</option>
              <option value="paid">Fully Paid</option>
              <option value="unpaid">Owes Money</option>
              <option value="incomplete">No Partner</option>
            </select>
          </div>

          {filtered.length === 0 && (
            <div className="text-center text-gray-400 py-12">No registrations yet</div>
          )}

          <div className="space-y-3">
            {filtered.map(team => {
              const isEditing = editingTeam?.id === team.id;
              return (
                <div
                  key={team.id}
                  className={`rounded-lg border-2 overflow-hidden transition-all ${
                    isEditing ? 'border-amber-400 shadow-md' : 'border-slate-200'
                  }`}
                >
                  {/* P1 row */}
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50">
                    <span className="text-xs font-bold text-gray-400 w-5">P1</span>
                    <span className="text-xs font-bold tabular-nums min-w-[2rem]" style={{ color: '#a60002' }}>
                      #{team.id}
                    </span>
                    <span className="font-semibold text-sm flex-1">
                      {team.player1.first_name} {team.player1.last_name}
                    </span>
                    {team.player1.phone_number && (
                      <span className="text-xs text-gray-400">📱 {team.player1.phone_number}</span>
                    )}
                    {team.city && <Badge variant="outline" className="text-xs">{team.city}</Badge>}
                    <button
                      onClick={() => openEdit(team)}
                      className={`p-1 rounded ${isEditing ? 'text-amber-500' : 'text-gray-400 hover:text-gray-700'}`}
                      title="Edit this registration"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* P2 row */}
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-t border-gray-100">
                    <span className="text-xs font-bold text-gray-400 w-5">P2</span>
                    {team.player2 ? (
                      <>
                        <span className="font-semibold text-sm flex-1">
                          {team.player2.first_name} {team.player2.last_name}
                        </span>
                        {team.player2.phone_number && (
                          <span className="text-xs text-gray-400">📱 {team.player2.phone_number}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-gray-400 italic flex-1">Partner TBD</span>
                    )}
                  </div>

                  {/* Tournament rows */}
                  {team.tournaments.map(tr => (
                    <div
                      key={tr.tournament_id}
                      className="flex flex-wrap items-center gap-2 px-4 py-2 border-t border-gray-100 bg-white"
                    >
                      <span className="text-xs font-medium text-gray-600 w-36 truncate flex-shrink-0">
                        {tName(tr.tournament_id)}
                      </span>

                      <button
                        onClick={() => togglePaid(team, team.player1.id, tr.tournament_id, tr.p1_paid)}
                        className={`h-6 text-xs px-2 rounded border font-medium transition-colors ${
                          tr.p1_paid
                            ? 'bg-green-100 text-green-700 border-green-300 hover:bg-red-50 hover:text-red-600 hover:border-red-300'
                            : 'bg-white text-orange-700 border-orange-300 hover:bg-orange-50'
                        }`}
                        title={tr.p1_paid ? 'Click to mark unpaid' : 'Click to mark paid'}
                      >
                        {(() => { const amt = (perPlayer(tr.tournament_id) + (tr.p1_boston ? bostonCost(tr.tournament_id) : 0)).toFixed(0); return tr.p1_paid ? `P1 ✓ $${amt}` : `Collect P1 $${amt}`; })()}
                      </button>

                      {team.player2 && (
                        <button
                          onClick={() => togglePaid(team, team.player2!.id, tr.tournament_id, tr.p2_paid)}
                          className={`h-6 text-xs px-2 rounded border font-medium transition-colors ${
                            tr.p2_paid
                              ? 'bg-green-100 text-green-700 border-green-300 hover:bg-red-50 hover:text-red-600 hover:border-red-300'
                              : 'bg-white text-orange-700 border-orange-300 hover:bg-orange-50'
                          }`}
                          title={tr.p2_paid ? 'Click to mark unpaid' : 'Click to mark paid'}
                        >
                          {(() => { const amt = (perPlayer(tr.tournament_id) + (tr.p2_boston ? bostonCost(tr.tournament_id) : 0)).toFixed(0); return tr.p2_paid ? `P2 ✓ $${amt}` : `Collect P2 $${amt}`; })()}
                        </button>
                      )}

                      {(tr.p1_prepaid || tr.p2_prepaid) && (
                        <Badge variant="outline" className="text-xs text-purple-600 border-purple-300">
                          pre-paid
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
