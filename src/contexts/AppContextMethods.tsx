import { TournamentResult, Team } from './AppContext';

export const createTournamentResultMethods = (
  tournamentResults: { [tournamentId: string]: TournamentResult[] },
  setTournamentResults: React.Dispatch<React.SetStateAction<{ [tournamentId: string]: TournamentResult[] }>>,
  teams: Team[]
) => {
  const updateTournamentResult = (tournamentId: string, teamId: string, round: number, field: 'points' | 'wl' | 'boston', value: any) => {
    setTournamentResults(prev => {
      const results = prev[tournamentId] || [];
      const updatedResults = results.map(result => {
        if (result.teamId === teamId) {
          const updatedRounds = { ...result.rounds };
          if (!updatedRounds[round]) {
            updatedRounds[round] = { points: 0, wl: '', boston: 0 };
          }
          updatedRounds[round] = { ...updatedRounds[round], [field]: value };
          
          // Recalculate totals
          const totalPoints = Object.values(updatedRounds).reduce((sum, r) => sum + (r.points || 0), 0);
          const totalWins = Object.values(updatedRounds).filter(r => r.wl === 'W').length;
          const totalBoston = Object.values(updatedRounds).reduce((sum, r) => sum + (r.boston || 0), 0);
          
          return {
            ...result,
            rounds: updatedRounds,
            totalPoints,
            totalWins,
            totalBoston
          };
        }
        return result;
      });
      
      return { ...prev, [tournamentId]: updatedResults };
    });
  };

  const getTournamentResults = (tournamentId: string): TournamentResult[] => {
    // Always return all teams registered for this tournament, with zeroed stats if not present in tournamentResults
    const registeredTeams = teams.filter(team => team.registeredTournaments?.includes(tournamentId));
    const existingResults = tournamentResults[tournamentId] || [];
    // Map of teamId to TournamentResult
    const resultMap: { [teamId: string]: TournamentResult } = {};
    existingResults.forEach(r => { resultMap[r.teamId] = r; });

    const mergedResults: TournamentResult[] = registeredTeams.map(team => {
      if (resultMap[team.id]) return resultMap[team.id];
      return {
        teamId: team.id,
        teamNumber: team.teamNumber,
        teamName: team.name,
        rounds: {},
        totalPoints: 0,
        totalWins: 0,
        totalBoston: 0
      };
    });

    // Do NOT update state here! This function may be called during render.
    // If you need to ensure all teams have a result entry, do it in a useEffect in the component.
    return mergedResults;
  };

  const formatTeamName = (firstName: string, lastName: string) => {
    if (!firstName.trim() || !lastName.trim()) return '';
    // Use first name and first letter of last name only
    const lastInitial = lastName.trim().charAt(0).toUpperCase();
    return `${firstName.trim()} ${lastInitial}`;
  };

  return { updateTournamentResult, getTournamentResults, formatTeamName };
};
