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
 * Generate a tournament schedule with proper bye handling for odd team counts
 * @param inputTeams List of teams
 * @param numRounds Number of rounds (must be even if teams are odd)
 */
export function generateTournamentRounds(inputTeams: Team[], numRounds: number): GameMatch[][] {
  if (inputTeams.length % 2 === 1 && numRounds % 2 !== 0) {
    throw new Error('Number of rounds must be even if there are an odd number of teams.');
  }
  const rounds: GameMatch[][] = [];
  let previousMatches: PreviousMatch[] = [];
  let byeTeams: Team[] = [];

  for (let round = 1; round <= numRounds; round++) {
    const roundMatches = generateOneRoundParam(inputTeams, previousMatches, round, byeTeams);
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
    const byeRoundMatches = generateByeRound(byeTeams, previousMatches, numRounds + 1);
    rounds.push(byeRoundMatches);
  }

  return rounds;
}

function generateOneRoundParam(
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

  // Handle bye for odd number of teams
  if (isOdd) {
    // Find a team that hasn't had a bye yet
    const availableForBye = teams.filter(team => 
      !byeTeams.some(byeTeam => byeTeam.id === team.id)
    );
    if (availableForBye.length > 0) {
      const byeTeam = availableForBye[0];
      matches.push({ team: byeTeam, round, isBye: true });
      matchedIds.add(byeTeam.id);
    }
  }

  // Create a list of available teams (excluding bye team)
  const availableTeams = teams.filter(team => !matchedIds.has(team.id));
  
  // Generate matches using a more robust algorithm
  while (availableTeams.length >= 2) {
    let matchFound = false;
    
    // Try to find a valid match starting from the first available team
    for (let i = 0; i < availableTeams.length && !matchFound; i++) {
      const teamA = availableTeams[i];
      
      for (let j = i + 1; j < availableTeams.length && !matchFound; j++) {
        const teamB = availableTeams[j];
        
        // Check constraints
        if (teamA.city === teamB.city) continue;
        
        const key = [teamA.id, teamB.id].sort().join('-');
        if (disallowed.has(key)) continue;
        
        // Valid match found
        matches.push({ teamA, teamB, round });
        matchedIds.add(teamA.id);
        matchedIds.add(teamB.id);
        
        // Remove matched teams from available list
        availableTeams.splice(j, 1);
        availableTeams.splice(i, 1);
        matchFound = true;
      }
    }
    
    // If no valid match found, we need to relax constraints
    if (!matchFound && availableTeams.length >= 2) {
      // Find any match that doesn't violate same-city rule
      for (let i = 0; i < availableTeams.length && !matchFound; i++) {
        const teamA = availableTeams[i];
        
        for (let j = i + 1; j < availableTeams.length && !matchFound; j++) {
          const teamB = availableTeams[j];
          
          // Only check same-city constraint, ignore previous matches
          if (teamA.city === teamB.city) continue;
          
          // Valid match found (relaxed constraints)
          matches.push({ teamA, teamB, round });
          matchedIds.add(teamA.id);
          matchedIds.add(teamB.id);
          
          // Remove matched teams from available list
          availableTeams.splice(j, 1);
          availableTeams.splice(i, 1);
          matchFound = true;
        }
      }
    }
    
    // If still no match found, we have to allow same-city matches
    if (!matchFound && availableTeams.length >= 2) {
      const teamA = availableTeams[0];
      const teamB = availableTeams[1];
      
      matches.push({ teamA, teamB, round });
      matchedIds.add(teamA.id);
      matchedIds.add(teamB.id);
      
      // Remove matched teams from available list
      availableTeams.splice(1, 1);
      availableTeams.splice(0, 1);
    }
  }

  return matches;
}

function generateByeRound(byeTeams: Team[], previousMatches: PreviousMatch[], round: number): GameMatch[] {
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
      matches.push({ teamA, teamB, round });
      matchedIds.add(teamA.id);
      matchedIds.add(teamB.id);
      break;
    }
  }
  return matches;
}