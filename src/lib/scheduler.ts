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

/**
 * Generate 4 rounds of matchups with proper bye handling for odd team counts
 */
export function generateFourRounds(inputTeams: Team[]): GameMatch[][] {
  const rounds: GameMatch[][] = [];
  let previousMatches: PreviousMatch[] = [];
  let byeTeams: Team[] = [];

  for (let round = 1; round <= 4; round++) {
    const roundMatches = generateOneRound(inputTeams, previousMatches, round, byeTeams);
    rounds.push(roundMatches);

    // Track previous matches (excluding byes)
    for (const match of roundMatches) {
      if (!('isBye' in match)) {
        previousMatches.push({
          teamAId: match.teamA.id,
          teamBId: match.teamB.id,
        });
      } else {
        // Track bye teams
        byeTeams.push(match.team);
      }
    }
  }

  // Add bye round if we have bye teams
  if (byeTeams.length >= 2) {
    const byeRoundMatches = generateByeRound(byeTeams, previousMatches);
    rounds.push(byeRoundMatches);
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

  const disallowed = new Set(
    previousMatches.map(
      (m) => `${[m.teamAId, m.teamBId].sort().join('-')}`
    )
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

  // Generate regular matches
  for (let i = 0; i < shuffled.length; i++) {
    const teamA = shuffled[i];
    if (matchedIds.has(teamA.id)) continue;

    for (let j = i + 1; j < shuffled.length; j++) {
      const teamB = shuffled[j];
      if (matchedIds.has(teamB.id)) continue;
      if (teamA.city === teamB.city) continue;

      const key = [teamA.id, teamB.id].sort().join('-');
      if (disallowed.has(key)) continue;

      matches.push({ teamA, teamB, round });
      matchedIds.add(teamA.id);
      matchedIds.add(teamB.id);
      break;
    }
  }

  return matches;
}

function generateByeRound(byeTeams: Team[], previousMatches: PreviousMatch[]): GameMatch[] {
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

      matches.push({ teamA, teamB, round: 5 });
      matchedIds.add(teamA.id);
      matchedIds.add(teamB.id);
      break;
    }
  }

  return matches;
}