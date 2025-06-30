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
    if (!tournamentResults[tournamentId]) {
      // Initialize results for all teams registered for this tournament
      const registeredTeams = teams.filter(team => 
        team.registeredTournaments?.includes(tournamentId)
      );
      
      const initialResults: TournamentResult[] = registeredTeams.map(team => ({
        teamId: team.id,
        teamNumber: team.teamNumber,
        teamName: team.name,
        rounds: {},
        totalPoints: 0,
        totalWins: 0,
        totalBoston: 0
      }));
      
      setTournamentResults(prev => ({ ...prev, [tournamentId]: initialResults }));
      return initialResults;
    }
    
    return tournamentResults[tournamentId];
  };

  const formatTeamName = (firstName: string, lastName: string) => {
    if (!firstName.trim() || !lastName.trim()) return '';
    // Use first name and first letter of last name only
    const lastInitial = lastName.trim().charAt(0).toUpperCase();
    return `${firstName.trim()} ${lastInitial}`;
  };

  return { updateTournamentResult, getTournamentResults, formatTeamName };
};
