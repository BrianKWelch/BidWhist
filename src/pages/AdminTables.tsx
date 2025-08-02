


  // Create matches for the next round using eligible teams
  const handleCreateNextRound = async () => {
    if (!schedule) return;
    const availableRounds = schedule ? Array.from(new Set(schedule.matches.map(m => m.round))).sort((a, b) => a - b) : [1];
    const nextRoundNum = availableRounds.length ? Math.max(...(availableRounds as number[])) + 1 : 2;
    const prevRound = nextRoundNum - 1;
    const confirmedGames = games.filter(g => g.confirmed && g.round === prevRound);
    const confirmedTeamIds = Array.from(new Set([
      ...confirmedGames.map(g => typeof g.teamA === 'object' && g.teamA !== null ? g.teamA.id : g.teamA),
      ...confirmedGames.map(g => typeof g.teamB === 'object' && g.teamB !== null ? g.teamB.id : g.teamB)
    ]));
    const shuffled = [...confirmedTeamIds];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const matches = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      const teamA = shuffled[i];
      const teamB = shuffled[i + 1] || 'BYE';
      matches.push({
        id: `${schedule.tournamentId}-r${nextRoundNum}-m${i / 2 + 1}`,
        teamA,
        teamB,
        round: nextRoundNum,
        table: Math.floor(i / 2) + 1,
        tournamentId: schedule.tournamentId,
        isBye: teamB === 'BYE',
        isSameCity: false
      });
    }
    const updatedSchedule = {
      ...schedule,
      rounds: nextRoundNum,
      matches: [...schedule.matches, ...matches]
    };
    await saveSchedule(updatedSchedule);
    setSelectedRound(nextRoundNum);
  };
import React, { useState, useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const AdminTables: React.FC = () => {
  const { teams, games, schedules, tournaments, setGames, getActiveTournament, saveSchedule } = useAppContext();
  const activeTournament = getActiveTournament();
  const [selectedTournamentId, setSelectedTournamentId] = useState(activeTournament?.id || '');
  // Default to the next uncommitted round (usually round 2 after round 1 is committed)
  const schedule = schedules.find(s => s.tournamentId === selectedTournamentId);
  // Only declare these once at the top
  const [tableAssignments, setTableAssignments] = useState<{ [teamId: string]: number | null }>({});
  const [lastRound, setLastRound] = useState(false);
  const [error, setError] = useState('');

  // Get tournament and schedule
  const tournament = tournaments.find(t => t.id === selectedTournamentId);
  // Only allow selection of rounds that exist in the schedule
  const availableRounds = schedule ? Array.from(new Set(schedule.matches.map(m => m.round))).sort((a, b) => a - b) : [1];
  const [selectedRound, setSelectedRound] = useState(availableRounds[0]);
  const numRounds = availableRounds.length;

  // Only show teams that have not been committed for the selected round
  const eligibleTeams = React.useMemo(() => {
    if (!schedule) return [];
    // Find matches for this round that have already been committed (i.e., have both teams and a table assigned)
    const committedMatches = schedule.matches.filter(m => m.round === selectedRound && m.teamA && m.teamB && m.table);
    const committedTeamIds = new Set<string>();
    committedMatches.forEach(m => {
      if (m.teamA && m.teamA !== 'BYE' && m.teamA !== 'TBD') committedTeamIds.add(String(m.teamA));
      if (m.teamB && m.teamB !== 'BYE' && m.teamB !== 'TBD') committedTeamIds.add(String(m.teamB));
    });
    if (selectedRound === 1) {
      // Always use matches from the global schedule (database-backed) for round 1
      const round1Matches = schedule.matches.filter(m => m.round === 1);
      const teamIds = round1Matches.flatMap(m => [String(m.teamA), String(m.teamB)]);
      const result = teamIds
        .filter(id => id !== 'BYE' && id !== 'TBD')
        .map(id => teams.find(t => String(t.id) === id && t.registeredTournaments?.includes(selectedTournamentId)))
        .filter(Boolean)
        .filter(t => !committedTeamIds.has(String(t.id)));
      return result;
    }
    // For rounds > 1, only teams that played and confirmed in the previous round, minus those already committed
    const prevRound = selectedRound - 1;
    const confirmedGames = games.filter(g => g.confirmed && g.round === prevRound);
    const confirmedTeamIds = new Set<string>();
    confirmedGames.forEach(g => {
      const teamAId = typeof g.teamA === 'object' && g.teamA !== null ? g.teamA.id : g.teamA;
      const teamBId = typeof g.teamB === 'object' && g.teamB !== null ? g.teamB.id : g.teamB;
      confirmedTeamIds.add(String(teamAId));
      confirmedTeamIds.add(String(teamBId));
    });
    const result = Array.from(confirmedTeamIds)
      .map(id => teams.find(t => String(t.id) === id && t.registeredTournaments?.includes(selectedTournamentId)))
      .filter((t): t is typeof teams[0] => Boolean(t))
      .filter(t => !committedTeamIds.has(String(t.id)));
    return result;
  }, [schedule, games, selectedRound, teams, selectedTournamentId]);

  // Get all possible tables for this round
  const allTables = useMemo(() => {
    if (!schedule) return [];
    const matches = schedule.matches.filter(m => m.round === selectedRound);
    const tables = matches.map(m => m.table).filter(Boolean);
    // If no tables in schedule, default to 1..N
    if (!tables.length) {
      const numTables = Math.ceil(eligibleTeams.length / 2);
      return Array.from({ length: numTables }, (_, i) => i + 1);
    }
    return Array.from(new Set(tables));
  }, [schedule, selectedRound, eligibleTeams.length]);

  // Track which tables are full (2 teams)
  const tableCounts = useMemo(() => {
    const counts: { [table: number]: number } = {};
    Object.values(tableAssignments).forEach(table => {
      if (table) counts[table] = (counts[table] || 0) + 1;
    });
    return counts;
  }, [tableAssignments]);

  // Assign team to table
  const assignTable = (teamId: string, table: number | null) => {
    setError('');
    if (table && tableCounts[table] === 2) {
      setError(`Table ${table} is already full.`);
      return;
    }
    setTableAssignments(prev => ({ ...prev, [teamId]: table }));
  };

  // Always refresh table assignments for round 1 when schedule or games change
  React.useEffect(() => {
    if (!schedule) return;
    const roundMatches = schedule.matches.filter(m => m.round === selectedRound);
    const initialAssignments: { [teamId: string]: number } = {};
    roundMatches.forEach(m => {
      if (m.teamA && m.teamA !== 'BYE' && m.teamA !== 'TBD' && m.table) initialAssignments[String(m.teamA)] = m.table;
      if (m.teamB && m.teamB !== 'BYE' && m.teamB !== 'TBD' && m.table) initialAssignments[String(m.teamB)] = m.table;
    });
    setTableAssignments(initialAssignments);
  }, [schedule, games, selectedRound]);

  // Unassign team from table
  const unassignTable = (teamId: string) => {
    setTableAssignments(prev => ({ ...prev, [teamId]: null }));
  };

  // Save assignments (simulate updating schedule)
  // For round 1: commit all assignments. For later rounds: commit only full tables.
  const handleSave = async () => {
    if (!schedule) return;
    if (selectedRound === 1) {
      // Commit all assignments for round 1
      // Update the schedule in memory with the new table assignments
      const updatedMatches = schedule.matches.map(m => {
        if (m.round !== 1) return m;
        // Assign table from tableAssignments if present
        let table = null;
        if (m.teamA && tableAssignments[m.teamA]) table = tableAssignments[m.teamA];
        if (m.teamB && tableAssignments[m.teamB]) table = tableAssignments[m.teamB];
        return { ...m, table: table || m.table };
      });
      const updatedSchedule = { ...schedule, matches: updatedMatches };
      await saveSchedule(updatedSchedule);
    } else {
      // For later rounds, commit only full tables (2 teams)
      const tablesToCommit = Object.entries(tableCounts)
        .filter(([table, count]) => count === 2)
        .map(([table]) => Number(table));
      if (!tablesToCommit.length) {
        alert('No full tables to commit.');
        return;
      }
      // Only update matches for the selected round and the full tables
      const updatedMatches = schedule.matches.map(m => {
        if (m.round !== selectedRound) return m;
        // If this match's table is in tablesToCommit, update from tableAssignments
        if (m.table && tablesToCommit.includes(m.table)) {
          let table = null;
          if (m.teamA && tableAssignments[m.teamA]) table = tableAssignments[m.teamA];
          if (m.teamB && tableAssignments[m.teamB]) table = tableAssignments[m.teamB];
          return { ...m, table: table || m.table };
        }
        return m;
      });
      const updatedSchedule = { ...schedule, matches: updatedMatches };
      await saveSchedule(updatedSchedule);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Admin Table Assignment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-4 items-center">
            <label>Tournament:</label>
            <select value={selectedTournamentId} onChange={e => setSelectedTournamentId(e.target.value)}>
              {tournaments.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <label>Round:</label>
            <select value={selectedRound} onChange={e => setSelectedRound(Number(e.target.value))}>
              {availableRounds.map(r => (
                <option key={r} value={r}>Round {r}</option>
              ))}
            </select>
            <label>
              <input type="checkbox" checked={lastRound} onChange={e => setLastRound(e.target.checked)} />
              This is the last round
            </label>
          </div>
          {error && <div className="text-red-600 mb-2">{error}</div>}
          <table className="w-full border">
            <thead>
              <tr>
                <th className="border p-2">Team #</th>
                <th className="border p-2">Team Name</th>
                <th className="border p-2">Assign Table</th>
                <th className="border p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {eligibleTeams.map(team => (
                <tr key={team.id}>
                  <td className="border p-2">{team.teamNumber}</td>
                  <td className="border p-2">{team.name}</td>
                  <td className="border p-2">
                    <select
                      value={tableAssignments[team.id] || ''}
                      onChange={e => assignTable(team.id, e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">Unassigned</option>
                      {allTables.filter(table => tableAssignments[team.id] === table || (tableCounts[table] || 0) < 2).map(table => (
                        <option key={table} value={table}>Table {table}</option>
                      ))}
                    </select>
                  </td>
                  <td className="border p-2">
                    {tableAssignments[team.id] && (
                      <Button size="sm" variant="outline" onClick={() => unassignTable(team.id)}>
                        Unassign
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex gap-4">
            <Button onClick={handleSave} disabled={eligibleTeams.length === 0}>
              {selectedRound === 1 ? 'Commit All' : 'Commit Full Tables'}
            </Button>
            <Button onClick={handleCreateNextRound} disabled={selectedRound !== Math.max(...availableRounds)}>
              Create Round {Math.max(...availableRounds) + 1}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminTables;
