import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTeamName(teamName: string): string {
  if (!teamName || teamName === 'BYE') return teamName;
  
  const parts = teamName.split('/');
  if (parts.length !== 2) return teamName;
  
  const [firstName, lastName] = parts;
  
  // Extract first name and first initial of last name
  const firstNamePart = firstName.trim();
  const lastNameInitial = lastName.trim().charAt(0);
  
  return `${firstNamePart}/${lastNameInitial}`;
}

/**
 * Builds a results matrix and returns a sorted list of teams for a tournament, matching the TournamentResults page logic.
 * @param {Array} teams - All teams
 * @param {Array} games - All games
 * @param {Object} schedule - The tournament schedule
 * @param {Object} overrides - Results overrides
 * @param {number} numRounds - Number of rounds
 * @returns {{ sortedTeams: any[], resultsMatrix: any }}
 */
export function getSortedTournamentResults(teams, games, schedule, overrides, numRounds) {
  // Helper to get override key
  const getOverrideKey = (teamId, round, field) => `${teamId}_${round}_${field}`;
  // Get unique team IDs from the schedule
  const teamIds = schedule ? Array.from(new Set(
    schedule.matches.flatMap(m => [m.teamA, m.teamB])
      .filter(id => id !== 'BYE' && id !== 'TBD')
      .map(id => (typeof id === 'object' && id && 'id' in id ? String(id.id) : String(id)))
  )) : [];
  const registeredTeams = teamIds.map(id => teams.find(t => String(t.id) === id)).filter(Boolean);
  // Build resultsMatrix
  const resultsMatrix: Record<string, Record<number | string, { wl: string; points: number; boston: number }>> = {};
  registeredTeams.forEach(team => {
    resultsMatrix[team.id] = {};
    for (let round = 1; round <= numRounds; round++) {
      const keyWl = getOverrideKey(team.id, round, 'wl');
      const keyPoints = getOverrideKey(team.id, round, 'points');
      const keyBoston = getOverrideKey(team.id, round, 'boston');
      let wl, points, boston;
      if (overrides[keyWl] !== undefined || overrides[keyPoints] !== undefined || overrides[keyBoston] !== undefined) {
        wl = overrides[keyWl] ?? '';
        points = overrides[keyPoints] !== undefined ? Number(overrides[keyPoints]) : 0;
        boston = overrides[keyBoston] !== undefined ? Number(overrides[keyBoston]) : 0;
      } else {
        // Find the match for this team in this round
        const match = schedule?.matches.find(m => m.round === round && (m.teamA === team.id || m.teamB === team.id));
        let game = undefined;
        if (match) {
          const matchTeamIds = [match.teamA, match.teamB]
            .map(id => {
              if (id === null || id === undefined) return '';
              if (typeof id === 'object' && id && 'id' in id && id.id != null) {
                return String(id.id);
              }
              return String(id);
            })
            .filter(Boolean)
            .sort();
          game = games.find(g => {
            if (!g.confirmed || g.round !== match.round) return false;
            const gameTeamAId = typeof g.teamA === 'object' ? g.teamA.id : g.teamA;
            const gameTeamBId = typeof g.teamB === 'object' ? g.teamB.id : g.teamB;
            const gameTeamIds = [String(gameTeamAId), String(gameTeamBId)].sort();
            return (
              matchTeamIds[0] === gameTeamIds[0] &&
              matchTeamIds[1] === gameTeamIds[1]
            );
          });
        }
        if (game) {
          const gameTeamAId = typeof game.teamA === 'object' ? game.teamA.id : game.teamA;
          const isTeamA = gameTeamAId === team.id;
          const myScore = isTeamA ? game.scoreA : game.scoreB;
          const oppScore = isTeamA ? game.scoreB : game.scoreA;
          wl = myScore > oppScore ? 'W' : 'L';
          boston = (game.boston === 'teamA' && isTeamA) || (game.boston === 'teamB' && !isTeamA) ? 1 : 0;
          points = myScore;
        } else {
          wl = '';
          points = 0;
          boston = 0;
        }
      }
      resultsMatrix[team.id][round] = { wl, points, boston };
    }
    // Points total for sorting
    resultsMatrix[team.id]['totalPoints'] = {
      wl: '',
      points: Object.entries(resultsMatrix[team.id])
        .filter(([k]) => k !== 'totalPoints')
        .reduce((sum, [, r]) => sum + (r.points || 0), 0),
      boston: 0
    };
  });
  // Sort teams
  const sortedTeams = registeredTeams.slice().sort((a, b) => {
    const aWins = Array.from({ length: numRounds }, (_, roundIndex) => {
      const round = roundIndex + 1;
      const wl = overrides[getOverrideKey(a.id, round, 'wl')] ?? resultsMatrix[a.id][round]?.wl;
      return wl === 'W' ? 1 : 0;
    }).reduce((sum, v) => sum + v, 0);
    const bWins = Array.from({ length: numRounds }, (_, roundIndex) => {
      const round = roundIndex + 1;
      const wl = overrides[getOverrideKey(b.id, round, 'wl')] ?? resultsMatrix[b.id][round]?.wl;
      return wl === 'W' ? 1 : 0;
    }).reduce((sum, v) => sum + v, 0);
    if (bWins !== aWins) return bWins - aWins;
    const aPoints = Array.from({ length: numRounds }, (_, roundIndex) => {
      const round = roundIndex + 1;
      const points = overrides[getOverrideKey(a.id, round, 'points')];
      return points !== undefined ? Number(points) : resultsMatrix[a.id][round]?.points || 0;
    }).reduce((sum, v) => sum + v, 0);
    const bPoints = Array.from({ length: numRounds }, (_, roundIndex) => {
      const round = roundIndex + 1;
      const points = overrides[getOverrideKey(b.id, round, 'points')];
      return points !== undefined ? Number(points) : resultsMatrix[b.id][round]?.points || 0;
    }).reduce((sum, v) => sum + v, 0);
    if (bPoints !== aPoints) return bPoints - aPoints;
    const aR1 = overrides[getOverrideKey(a.id, 1, 'points')] !== undefined ? Number(overrides[getOverrideKey(a.id, 1, 'points')]) : resultsMatrix[a.id]?.[1]?.points || 0;
    const bR1 = overrides[getOverrideKey(b.id, 1, 'points')] !== undefined ? Number(overrides[getOverrideKey(b.id, 1, 'points')]) : resultsMatrix[b.id]?.[1]?.points || 0;
    if (bR1 !== aR1) return bR1 - aR1;
    const aR2 = overrides[getOverrideKey(a.id, 2, 'points')] !== undefined ? Number(overrides[getOverrideKey(a.id, 2, 'points')]) : resultsMatrix[a.id]?.[2]?.points || 0;
    const bR2 = overrides[getOverrideKey(b.id, 2, 'points')] !== undefined ? Number(overrides[getOverrideKey(b.id, 2, 'points')]) : resultsMatrix[b.id]?.[2]?.points || 0;
    if (bR2 !== aR2) return bR2 - aR2;
    const aNum = typeof a.teamNumber === 'number' ? a.teamNumber : Number(a.teamNumber) || Number(a.id);
    const bNum = typeof b.teamNumber === 'number' ? b.teamNumber : Number(b.teamNumber) || Number(b.id);
    return aNum - bNum;
  });
  return { sortedTeams, resultsMatrix };
}