import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAppContext } from '@/contexts/AppContext';
import * as XLSX from 'xlsx';
import { Download, FileSpreadsheet } from 'lucide-react';

const TournamentTeamReport: React.FC = () => {
  const { teams, tournaments, getActiveTournament } = useAppContext();
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');

  // Get tournament teams
  const tournamentTeams = useMemo(() => {
    if (!selectedTournamentId) return [];
    
    return teams
      .filter(team => team.registeredTournaments?.includes(selectedTournamentId))
      .sort((a, b) => {
        // Sort by team number if available, otherwise by id
        const numA = a.teamNumber ?? parseInt(a.id) ?? 0;
        const numB = b.teamNumber ?? parseInt(b.id) ?? 0;
        return numA - numB;
      });
  }, [teams, selectedTournamentId]);

  // Get selected tournament name
  const selectedTournament = tournaments.find(t => t.id === selectedTournamentId);

  const handleExport = () => {
    if (tournamentTeams.length === 0) {
      alert('No teams to export.');
      return;
    }

    // Build header row
    const header = [
      'Team #',
      'Player A',
      'Player B',
      'Phone A',
      'Phone B',
      'City'
    ];

    // Build data rows
    const rows = tournamentTeams.map(team => {
      const teamNumber = team.teamNumber ?? team.id;
      const playerA = `${team.player1FirstName || ''} ${team.player1LastName || ''}`.trim() || team.player1FirstName || '';
      const playerB = `${team.player2FirstName || ''} ${team.player2LastName || ''}`.trim() || team.player2FirstName || '';
      const phoneA = team.player1_phone || team.phoneNumber || '';
      const phoneB = team.player2_phone || '';
      const city = team.city || '';

      return [
        teamNumber,
        playerA,
        playerB,
        phoneA,
        phoneB,
        city
      ];
    });

    // Combine header and rows
    const sheetData = [header, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    
    // Set column widths
    const colWidths = [
      { wch: 10 }, // Team #
      { wch: 20 }, // Player A
      { wch: 20 }, // Player B
      { wch: 15 }, // Phone A
      { wch: 15 }, // Phone B
      { wch: 15 }  // City
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Teams');
    
    const fileName = selectedTournament 
      ? `tournament_teams_${selectedTournament.name.replace(/[^a-z0-9]/gi, '_')}.xlsx`
      : `tournament_teams_${selectedTournamentId}.xlsx`;
    
    XLSX.writeFile(wb, fileName);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Tournament Team Report
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Select Tournament</label>
            <Select value={selectedTournamentId} onValueChange={setSelectedTournamentId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a tournament..." />
              </SelectTrigger>
              <SelectContent>
                {tournaments.map(tournament => (
                  <SelectItem key={tournament.id} value={tournament.id}>
                    {tournament.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedTournamentId && tournamentTeams.length > 0 && (
            <Button onClick={handleExport} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export to Excel
            </Button>
          )}
        </div>

        {selectedTournamentId && (
          <div className="mt-4">
            {tournamentTeams.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No teams registered for this tournament.</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b">
                  <p className="text-sm font-medium">
                    {tournamentTeams.length} team{tournamentTeams.length !== 1 ? 's' : ''} in {selectedTournament?.name || 'tournament'}
                  </p>
                </div>
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky top-0 bg-white z-10">Team #</TableHead>
                        <TableHead className="sticky top-0 bg-white z-10">Player A</TableHead>
                        <TableHead className="sticky top-0 bg-white z-10">Player B</TableHead>
                        <TableHead className="sticky top-0 bg-white z-10">Phone A</TableHead>
                        <TableHead className="sticky top-0 bg-white z-10">Phone B</TableHead>
                        <TableHead className="sticky top-0 bg-white z-10">City</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tournamentTeams.map(team => {
                        const teamNumber = team.teamNumber ?? team.id;
                        const playerA = `${team.player1FirstName || ''} ${team.player1LastName || ''}`.trim() || team.player1FirstName || '';
                        const playerB = `${team.player2FirstName || ''} ${team.player2LastName || ''}`.trim() || team.player2FirstName || '';
                        const phoneA = team.player1_phone || team.phoneNumber || '';
                        const phoneB = team.player2_phone || '';

                        return (
                          <TableRow key={team.id}>
                            <TableCell className="font-medium">{teamNumber}</TableCell>
                            <TableCell>{playerA}</TableCell>
                            <TableCell>{playerB}</TableCell>
                            <TableCell>{phoneA}</TableCell>
                            <TableCell>{phoneB}</TableCell>
                            <TableCell>{team.city || ''}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}

        {!selectedTournamentId && (
          <div className="text-center py-8 text-gray-500">
            <p>Please select a tournament to view team report.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TournamentTeamReport;










