interface Team {
  id: string;
  name: string;
  city: string;
}

interface Match {
  teamA: Team;
  teamB: Team;
  round: number;
  table?: number;
  opponentPlaceholder?: { type: 'winner', table: number };
}

interface ByeMatch {
  team: Team;
  round: number;
  isBye: true;
  table?: number;
  opponentPlaceholder?: { type: 'winner', table: number };
}

type GameMatch = Match | ByeMatch;

interface PreviousMatch {
  teamAId: string;
  teamBId: string;
}


// --- CITY-AWARE ROUND ROBIN SCHEDULER ---
// This replaces the old generateNRoundsWithByeAndFinal logic
export function generateNRoundsWithByeAndFinal(inputTeams: Team[], numRounds: number): GameMatch[][] {
  // 1. Group teams by city
  const cityMap: Record<string, Team[]> = {};
  for (const team of inputTeams) {
    if (!cityMap[team.city]) cityMap[team.city] = [];
    cityMap[team.city].push(team);
  }
  const cities = Object.keys(cityMap);

  // 2. Find the best split city (minimizes column difference)
  let bestSplit: { splitCity: string; left: string[]; right: string[]; diff: number } | null = null;
  for (const splitCity of cities) {
    const otherCities = cities.filter(c => c !== splitCity);
    // Try all possible assignments of other cities to left/right
    const assignments: string[][] = [[]];
    for (const city of otherCities) {
      const newAssignments: string[][] = [];
      for (const assign of assignments) {
        newAssignments.push([...assign, city]);
        newAssignments.push(assign);
      }
      assignments.push(...newAssignments);
    }
    for (const assign of assignments) {
      const leftCities = assign;
      const rightCities = otherCities.filter(c => !leftCities.includes(c));
      const leftCount = leftCities.reduce((sum, c) => sum + cityMap[c].length, 0);
      const rightCount = rightCities.reduce((sum, c) => sum + cityMap[c].length, 0);
      const splitCount = cityMap[splitCity].length;
      // Try all possible splits of splitCity
      for (let leftSplit = 0; leftSplit <= splitCount; leftSplit++) {
        const rightSplit = splitCount - leftSplit;
        const totalLeft = leftCount + leftSplit;
        const totalRight = rightCount + rightSplit;
        const diff = Math.abs(totalLeft - totalRight);
        if (!bestSplit || diff < bestSplit.diff) {
          bestSplit = {
            splitCity,
            left: [...leftCities, ...Array(leftSplit).fill(splitCity)],
            right: [...rightCities, ...Array(rightSplit).fill(splitCity)],
            diff,
          };
        }
      }
    }
  }
  if (!bestSplit) throw new Error('Could not find a valid split');

  // 3. Build columns
  const leftTeams: Team[] = [];
  const rightTeams: Team[] = [];
  const splitCityTeams = [...cityMap[bestSplit.splitCity]];
  // Assign split city teams to left (bottom) and right (top)
  const leftSplitCount = bestSplit.left.filter(c => c === bestSplit.splitCity).length;
  const rightSplitCount = bestSplit.right.filter(c => c === bestSplit.splitCity).length;
  leftTeams.push(...bestSplit.left.filter(c => c !== bestSplit.splitCity).flatMap(c => cityMap[c]));
  rightTeams.push(...bestSplit.right.filter(c => c !== bestSplit.splitCity).flatMap(c => cityMap[c]));
  leftTeams.push(...splitCityTeams.slice(0, leftSplitCount)); // bottom of left
  rightTeams.unshift(...splitCityTeams.slice(leftSplitCount)); // top of right

  // 4. Add BYE if needed
  let totalTeams = leftTeams.length + rightTeams.length;
  if (totalTeams % 2 !== 0) {
    const byeTeam: Team = { id: 'BYE', name: 'BYE', city: 'BYE' };
    if (leftTeams.length < rightTeams.length) leftTeams.push(byeTeam);
    else rightTeams.push(byeTeam);
    totalTeams++;
  }

  // 5. Shuffle within columns (except split city teams, which are locked at top/bottom)
  // (Optional: implement a shuffle that avoids BYE vs. same city in first rounds)

  // 6. Generate rounds
  const rounds: GameMatch[][] = [];
  for (let round = 0; round < Math.min(numRounds, leftTeams.length); round++) {
    const matches: GameMatch[] = [];
    for (let i = 0; i < leftTeams.length; i++) {
      if (leftTeams[i].id === 'BYE' && rightTeams[i].id === 'BYE') {
        continue;
      } else if (leftTeams[i].id === 'BYE') {
        const match = { teamA: rightTeams[i], teamB: { id: 'BYE', name: 'BYE', city: 'BYE' }, round: round + 1 };
        matches.push(match);
      } else if (rightTeams[i].id === 'BYE') {
        const match = { teamA: leftTeams[i], teamB: { id: 'BYE', name: 'BYE', city: 'BYE' }, round: round + 1 };
        matches.push(match);
      } else {
        const match = {
          round: round + 1,
          teamA: leftTeams[i],
          teamB: rightTeams[i],
        };
        matches.push(match);
      }
    }
    rounds.push(matches);
    rightTeams.unshift(rightTeams.pop()!);
  }

  // --- NEW LOGIC: Add an extra round to pair up teams who played against BYE ---
  // 1. Collect all teams who played against BYE in any round
  const teamsWithBye: Team[] = [];
  for (const round of rounds) {
    for (const match of round) {
      if ('teamA' in match && 'teamB' in match) {
        if (match.teamA.id !== 'BYE' && match.teamB.id === 'BYE') {
          teamsWithBye.push(match.teamA);
        }
        if (match.teamB.id !== 'BYE' && match.teamA.id === 'BYE') {
          teamsWithBye.push(match.teamB);
        }
      }
    }
  }
  // 2. Pair them up in a single extra round
  if (teamsWithBye.length > 0) {
    const extraRound: GameMatch[] = [];
    for (let i = 0; i < teamsWithBye.length; i += 2) {
      const teamA = teamsWithBye[i];
      const teamB = teamsWithBye[i + 1];
      if (teamA && teamB) {
        extraRound.push({ teamA, teamB, round: rounds.length + 1 });
      }
    }
    if (extraRound.length > 0) rounds.push(extraRound);
  }

  return rounds;
}

function generateOneRound(
  teams: Team[],
  previousMatches: PreviousMatch[],
  round: number,
  byeTeams: Team[]
): GameMatch[] {
  const matches: GameMatch[] = [];
  const matchedIds = new Set<string>();
  const isOdd = teams.length % 2 === 1;

  // Count city frequencies
  const cityCounts: Record<string, number> = {};
  teams.forEach(t => { cityCounts[t.city] = (cityCounts[t.city] || 0) + 1; });
  const moreThanHalfSameCity = Object.values(cityCounts).some(count => count > teams.length / 2);

  // Build rematch set
  const playedSet = new Set(
    previousMatches.map(m => `${[m.teamAId, m.teamBId].sort().join('-')}`)
  );

  const shuffled = [...teams].sort(() => Math.random() - 0.5);

  // Handle bye for odd number of teams
  if (isOdd) {
    // Find a team that hasn't had a bye yet
    const availableForBye = shuffled.filter(team => 
      !byeTeams.some(byeTeam => byeTeam.id === team.id)
    );
    if (availableForBye.length > 0) {
      const byeTeam = availableForBye[0];
      matches.push({ team: byeTeam, round, isBye: true });
      matchedIds.add(byeTeam.id);
    }
  }

  // Generate regular matches with rule priorities
  for (let i = 0; i < shuffled.length; i++) {
    const teamA = shuffled[i];
    if (matchedIds.has(teamA.id)) continue;

    // 1. Try to find a team not from same city and not a rematch
    let found = false;
    for (let j = i + 1; j < shuffled.length; j++) {
      const teamB = shuffled[j];
      if (matchedIds.has(teamB.id)) continue;
      const key = [teamA.id, teamB.id].sort().join('-');
      if (teamA.city === teamB.city && !moreThanHalfSameCity) continue;
      if (playedSet.has(key)) continue;
      matches.push({ teamA, teamB, round });
      matchedIds.add(teamA.id);
      matchedIds.add(teamB.id);
      found = true;
      break;
    }
    if (found) continue;

    // 2. If not possible, allow same-city match (but not a rematch)
    for (let j = i + 1; j < shuffled.length; j++) {
      const teamB = shuffled[j];
      if (matchedIds.has(teamB.id)) continue;
      const key = [teamA.id, teamB.id].sort().join('-');
      if (playedSet.has(key)) continue;
      matches.push({ teamA, teamB, round });
      matchedIds.add(teamA.id);
      matchedIds.add(teamB.id);
      found = true;
      break;
    }
    if (found) continue;

    // 3. If not possible, allow a rematch (city doesn't matter)
    for (let j = i + 1; j < shuffled.length; j++) {
      const teamB = shuffled[j];
      if (matchedIds.has(teamB.id)) continue;
      const key = [teamA.id, teamB.id].sort().join('-');
      matches.push({ teamA, teamB, round });
      matchedIds.add(teamA.id);
      matchedIds.add(teamB.id);
      break;
    }
  }

  return matches;
}

function generateByeRound(byeTeams: Team[], previousMatches: PreviousMatch[], roundNum: number): GameMatch[] {
  const matches: GameMatch[] = [];
  const matchedIds = new Set<string>();
  const disallowed = new Set(
    previousMatches.map(
      (m) => `${[m.teamAId, m.teamBId].sort().join('-')}`
    )
  );
  const shuffled = [...byeTeams].sort(() => Math.random() - 0.5);
  for (let i = 0; i < shuffled.length; i++) {
    const teamA = shuffled[i];
    if (matchedIds.has(teamA.id)) continue;
    for (let j = i + 1; j < shuffled.length; j++) {
      const teamB = shuffled[j];
      if (matchedIds.has(teamB.id)) continue;
      if (teamA.city === teamB.city) continue;
      const key = [teamA.id, teamB.id].sort().join('-');
      if (disallowed.has(key)) continue;
      matches.push({ teamA, teamB, round: roundNum });
      matchedIds.add(teamA.id);
      matchedIds.add(teamB.id);
      break;
    }
  }
  return matches;
}

// --- WIN/LOSS DICTATED ROTATION SCHEDULER (Option B) ---
/**
 * Generates a schedule where each round's matchups are determined by previous round's win/loss outcomes.
 * @param inputTeams List of teams (must have id, name, city)
 * @param numRounds Number of rounds (not including the final bye round)
 * @returns Array of rounds, each round is an array of GameMatch
 */
export function generateWinLossRotationSchedule(inputTeams: Team[]): GameMatch[][] {
  // Defensive copy and sort for determinism
  const teams = [...inputTeams].sort((a, b) => a.id.localeCompare(b.id));
  const round1: GameMatch[] = [];
  let round1Teams = [...teams];
  const numTables = Math.floor(teams.length / 2);
  let tableNum = 1;
  while (round1Teams.length > 1) {
    const a = round1Teams.shift()!;
    let bIdx = round1Teams.findIndex(t => t.city !== a.city);
    if (bIdx === -1) bIdx = 0;
    const b = round1Teams.splice(bIdx, 1)[0];
    round1.push({ teamA: a, teamB: b, round: 1, table: tableNum });
    tableNum++;
  }
  // If there is a bye (one team left), assign it table numTables + 1
  if (round1Teams.length === 1) {
    const byeTeam = round1Teams.pop()!;
    round1.push({ teamA: byeTeam, teamB: null, round: 1, table: numTables + 1, isBye: true });
  }
  return [round1];
}

// Scaffold: Generate next round for Option B based on previous round results
export function generateNextWinLossRound({
  teams,
  previousMatches,
  previousResults,
  roundNumber,
  byeHistory
}: {
  teams: Team[];
  previousMatches: GameMatch[];
  previousResults: { [table: number]: { winnerId: string; loserId: string } };
  roundNumber: number;
  byeHistory: string[];
}): GameMatch[] {
  // Map table number to previous match
  const tableToMatch: { [table: number]: GameMatch } = {};
  previousMatches.forEach((m, i) => {
    tableToMatch[i + 1] = m;
  });
  const totalTables = Object.keys(tableToMatch).length;
  // Track which teams have a bye
  const prevByeTeamId = byeHistory.length > 0 ? byeHistory[byeHistory.length - 1] : null;
  // 1. Assign byes for this round
  let newByeTeamId: string | null = null;
  if (previousResults[2]) {
    newByeTeamId = previousResults[2].loserId;
  }
  // 2. Build next round matches
  const nextRound: GameMatch[] = [];
  // Insert previous bye team at table 1
  let tableAssignments: { [table: number]: { teamA: string | null; teamB: string | null } } = {};
  if (prevByeTeamId) {
    tableAssignments[1] = { teamA: prevByeTeamId, teamB: null };
  }
  // Assign losers and winners to tables
  for (let t = 1; t <= totalTables; t++) {
    const prev = previousResults[t];
    if (!prev) continue;
    // Loser movement
    const loserTable = Math.ceil(t / 2);
    if (!tableAssignments[loserTable]) tableAssignments[loserTable] = { teamA: null, teamB: null };
    if (!newByeTeamId || prev.loserId !== newByeTeamId) {
      if (!tableAssignments[loserTable].teamA) tableAssignments[loserTable].teamA = prev.loserId;
      else tableAssignments[loserTable].teamB = prev.loserId;
    }
    // Winner movement
    const winnerTable = totalTables - Math.floor((totalTables - t) / 2);
    if (!tableAssignments[winnerTable]) tableAssignments[winnerTable] = { teamA: null, teamB: null };
    if (!tableAssignments[winnerTable].teamA) tableAssignments[winnerTable].teamA = prev.winnerId;
    else tableAssignments[winnerTable].teamB = prev.winnerId;
  }
  // Build GameMatch[]
  Object.entries(tableAssignments).forEach(([tableStr, { teamA, teamB }]) => {
    const table = parseInt(tableStr);
    if (teamA && teamB) {
      nextRound.push({
        teamA: teams.find(t => t.id === teamA)!,
        teamB: teams.find(t => t.id === teamB)!,
        round: roundNumber,
        table,
      });
    } else if (teamA && !teamB) {
      nextRound.push({
        teamA: teams.find(t => t.id === teamA)!,
        teamB: null,
        round: roundNumber,
        table,
        opponentPlaceholder: { type: 'winner', table }
      });
    } else if (!teamA && teamB) {
      nextRound.push({
        teamA: null,
        teamB: teams.find(t => t.id === teamB)!,
        round: roundNumber,
        table,
        opponentPlaceholder: { type: 'winner', table }
      });
    }
  });
  // Add bye match if needed
  if (newByeTeamId) {
    nextRound.push({
      team: teams.find(t => t.id === newByeTeamId)!,
      round: roundNumber,
      isBye: true
    });
  }
  return nextRound;
}