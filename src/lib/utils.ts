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
  // Always use string IDs for registeredTeams
  const teamIds = schedule ? Array.from(new Set(
    schedule.matches.flatMap(m => [String(m.teamA), String(m.teamB)])
      .filter(id => id !== 'BYE' && id !== 'TBD')
  )) : [];
  const registeredTeams = teamIds
    .map(id => teams.find(t => String(t.id) === id))
    .filter(Boolean);
  // Build resultsMatrix
  const resultsMatrix: Record<string, Record<number | string, { wl: string; points: number; boston: number; hands: number; isTie: boolean }>> = {};
  for (const team of registeredTeams) {
    const teamId = String(team.id);
    if (!resultsMatrix[teamId]) resultsMatrix[teamId] = {};
    for (let round = 1; round <= numRounds; round++) {
      const match = schedule?.matches.find(
        m => m.round === round && (String(m.teamA) === teamId || String(m.teamB) === teamId)
      );
      if (!match) {
        resultsMatrix[teamId][round] = { wl: '', points: 0, hands: 0, boston: 0, isTie: false };
        continue;
      }
      const game = games.find(g => g.matchId === match.id && g.confirmed);
      if (game) {
        const teamAId = String(game.teamA);
        const teamBId = String(game.teamB);
        const isTieGame = game.scoreA === game.scoreB;
        if (isTieGame) {
          // Ensure both teams are initialized in resultsMatrix
          if (!resultsMatrix[teamAId]) resultsMatrix[teamAId] = {};
          if (!resultsMatrix[teamBId]) resultsMatrix[teamBId] = {};
          const handsA = game.handsA ?? 0;
          const handsB = game.handsB ?? 0;
          let wlA = 'T', wlB = 'T';
          if (handsA > handsB) { wlA = 'TW'; wlB = 'TL'; }
          else if (handsA < handsB) { wlA = 'TL'; wlB = 'TW'; }
          resultsMatrix[teamAId][round] = {
            wl: wlA,
            points: game.scoreA,
            hands: handsA,
            boston: game.boston === 'teamA' ? 1 : 0,
            isTie: true
          };
          resultsMatrix[teamBId][round] = {
            wl: wlB,
            points: game.scoreB,
            hands: handsB,
            boston: game.boston === 'teamB' ? 1 : 0,
            isTie: true
          };
          continue;
        }
        // Not a tie: normal logic
        const isTeamA = teamId === teamAId;
        const myScore = isTeamA ? game.scoreA : game.scoreB;
        const oppScore = isTeamA ? game.scoreB : game.scoreA;
        const myHands = isTeamA ? game.handsA : game.handsB;
        const boston = (game.boston === 'teamA' && isTeamA) || (game.boston === 'teamB' && !isTeamA) ? 1 : 0;
        const wl = myScore > oppScore ? 'W' : 'L';
        resultsMatrix[teamId][round] = { wl, points: myScore, hands: myHands ?? 0, boston, isTie: false };
      } else {
        resultsMatrix[teamId][round] = { wl: '', points: 0, hands: 0, boston: 0, isTie: false };
      }
    }
    // Totals logic: sum wins, but add 0.5 for each tie/tiebreak
    let wins = 0;
    for (let round = 1; round <= numRounds; round++) {
      const roundData = resultsMatrix[teamId][round];
      if (roundData) {
        if (roundData.wl === 'TW' || roundData.wl === 'TL' || roundData.wl === 'T') {
          wins += 0.5;
        } else if (roundData.wl === 'W') {
          wins += 1;
        }
      }
    }
    resultsMatrix[teamId]['totalPoints'] = {
      wl: '',
      points: Object.entries(resultsMatrix[teamId])
        .filter(([k]) => k !== 'totalPoints')
        .reduce((sum, [, r]) => sum + (r.points || 0), 0),
      boston: 0,
      hands: Object.entries(resultsMatrix[teamId])
        .filter(([k]) => k !== 'totalPoints')
        .reduce((sum, [, r]) => sum + (r.hands || 0), 0),
      wins
    };
  }
  // Sort teams
  const sortedTeams = registeredTeams.slice().sort((a, b) => {
    // 1. Wins
    const aWins = resultsMatrix[a.id]['totalPoints'].wins;
    const bWins = resultsMatrix[b.id]['totalPoints'].wins;
    if (bWins !== aWins) return bWins - aWins;

    // 2. Total Hands Won (descending)
    const aHands = resultsMatrix[a.id]['totalPoints'].hands || 0;
    const bHands = resultsMatrix[b.id]['totalPoints'].hands || 0;
    if (bHands !== aHands) return bHands - aHands;

    // 3. Total Points (descending)
    const aPoints = resultsMatrix[a.id]['totalPoints'].points;
    const bPoints = resultsMatrix[b.id]['totalPoints'].points;
    if (bPoints !== aPoints) return bPoints - aPoints;

    // 4. First Round Points (descending)
    const aR1 = resultsMatrix[a.id][1]?.points || 0;
    const bR1 = resultsMatrix[b.id][1]?.points || 0;
    if (bR1 !== aR1) return bR1 - aR1;

    // 5. Second Round Points (descending)
    const aR2 = resultsMatrix[a.id][2]?.points || 0;
    const bR2 = resultsMatrix[b.id][2]?.points || 0;
    if (bR2 !== aR2) return bR2 - aR2;

    // 6. Team Number (ascending)
    const aNum = typeof a.teamNumber === 'number' ? a.teamNumber : Number(a.teamNumber) || Number(a.id);
    const bNum = typeof b.teamNumber === 'number' ? b.teamNumber : Number(b.teamNumber) || Number(b.id);
    return aNum - bNum;
  });
  return { sortedTeams, resultsMatrix };
}