import React from 'react';
import { useAppContext } from '@/contexts/AppContext';
import * as XLSX from 'xlsx';
import { getSortedTournamentResults } from '@/lib/utils';

interface ExportResultsButtonProps {
  tournamentId: string;
}


const ExportResultsButton: React.FC<ExportResultsButtonProps> = ({ tournamentId }) => {
  const { teams, games, schedules } = useAppContext();
  // Try to match the logic in TournamentResults.tsx for overrides
  const [overrides, setOverrides] = React.useState<{ [key: string]: string }>({});
  React.useEffect(() => {
    const saved = localStorage.getItem('resultsOverrides');
    if (saved) setOverrides(JSON.parse(saved));
  }, []);

  const handleExport = () => {
    const schedule = schedules.find(s => s.tournamentId === tournamentId);
    const numRounds = schedule ? schedule.rounds : 5;
    const { sortedTeams, resultsMatrix } = getSortedTournamentResults(teams, games, schedule, overrides, numRounds);
    if (!sortedTeams.length) {
      alert('No results to export.');
      return;
    }
    // Build header row
    const header = [
      'Team #',
      'Team Name',
      ...Array.from({ length: numRounds }, (_, i) => [
        `R${i+1} W/L`,
        `R${i+1} Points`,
        `R${i+1} Hands`,
        `R${i+1} Boston`
      ]).flat(),
      'Wins',
      'Points',
      'Hands',
      'Bostons'
    ];
    // Build data rows
    const rows = sortedTeams.map(team => {
      const teamId = String(team.id);
      const row = [
        team.teamNumber || teamId,
        team.name || '',
        ...Array.from({ length: numRounds }, (_, roundIndex) => {
          const round = roundIndex + 1;
          const roundData = resultsMatrix[teamId][round] || { wl: '', points: 0, hands: 0, boston: 0 };
          return [
            overrides[`${teamId}_${round}_wl`] ?? roundData.wl,
            overrides[`${teamId}_${round}_points`] ?? roundData.points,
            overrides[`${teamId}_${round}_hands`] ?? roundData.hands,
            overrides[`${teamId}_${round}_boston`] ?? roundData.boston
          ];
        }).flat(),
        resultsMatrix[teamId]['totalPoints'].wins ?? 0,
        resultsMatrix[teamId]['totalPoints'].points ?? 0,
        resultsMatrix[teamId]['totalPoints'].hands ?? 0,
        resultsMatrix[teamId]['totalPoints'].boston ?? 0
      ];
      return row;
    });
    // Combine header and rows
    const sheetData = [header, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    XLSX.writeFile(wb, `tournament_results_${tournamentId}.xlsx`);
  };

  return (
    <button onClick={handleExport} style={{ padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
      Export Results to Excel
    </button>
  );
};

export default ExportResultsButton;
