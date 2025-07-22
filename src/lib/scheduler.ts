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