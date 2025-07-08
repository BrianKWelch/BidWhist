interface Team {
  id: string;
  name: string;
  city: string;
}

interface Match {
  teamA: Team;
  teamB: Team;
  round: number;
}

interface ByeMatch {
  team: Team;
  round: number;
  isBye: true;
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
      matches.push({
        round: round + 1,
        teamA: leftTeams[i],
        teamB: rightTeams[i],
      });
    }
    rounds.push(matches);
    // Rotate right column down by 1
    rightTeams.unshift(rightTeams.pop()!);
  }

  // --- PATCH START: Add a bye round at the end for teams that had a bye ---
  // Collect all teams that had a bye in the main rounds
  const byeTeams: Team[] = [];
  for (const round of rounds) {
    for (const match of round) {
      if ('isBye' in match && match.isBye && match.team.id !== 'BYE') {
        byeTeams.push(match.team);
      }
    }
  }
  // Remove duplicates
  const uniqueByeTeams = Array.from(new Set(byeTeams.map(t => t.id)))
    .map(id => byeTeams.find(t => t.id === id)!);

  // If 2 or more teams had a bye, schedule a single round where all play (no repeats)
  if (uniqueByeTeams.length >= 1) {
    // Gather all previous matches for rematch prevention
    const previousMatches: PreviousMatch[] = [];
    for (const round of rounds) {
      for (const match of round) {
        if ('teamA' in match && 'teamB' in match) {
          previousMatches.push({ teamAId: match.teamA.id, teamBId: match.teamB.id });
        }
      }
    }
    // Pair up bye teams for a single round (no repeats, no same team)
    const matches: GameMatch[] = [];
    const used = new Set<string>();
    for (let i = 0; i < uniqueByeTeams.length; i += 2) {
      const teamA = uniqueByeTeams[i];
      const teamB = uniqueByeTeams[i + 1];
      if (teamA && teamB && !previousMatches.some(m => (m.teamAId === teamA.id && m.teamBId === teamB.id) || (m.teamAId === teamB.id && m.teamBId === teamA.id))) {
        matches.push({ teamA, teamB, round: rounds.length + 1 });
        used.add(teamA.id);
        used.add(teamB.id);
      }
    }
    // If odd number, one team gets a bye in this round
    if (uniqueByeTeams.length % 2 === 1) {
      const left = uniqueByeTeams.find(t => !used.has(t.id));
      if (left) {
        matches.push({ team: left, round: rounds.length + 1, isBye: true });
      }
    }
    if (matches.length > 0) rounds.push(matches);
  }
  // --- PATCH END ---

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