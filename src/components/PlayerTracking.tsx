import React, { useState, useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import PlayerEditor from './PlayerEditor';
import TeamEditor from './TeamEditor';

const PlayerTracking: React.FC = () => {
  const { teams, tournaments, updateTeam } = useAppContext();
  const [search, setSearch] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTeamModalOpen, setEditTeamModalOpen] = useState(false);

  // Debug: Log selectedPlayer whenever it changes
  React.useEffect(() => {
    if (selectedPlayer) {
      console.log('Selected Player:', selectedPlayer);
      console.log('PlayerEditor props:', {
        firstName: selectedPlayer.firstName,
        lastName: selectedPlayer.lastName,
        phone: selectedPlayer.phone,
        city: selectedPlayer.city,
        team: selectedPlayer.team,
        role: selectedPlayer.role,
      });
    }
  }, [selectedPlayer]);

  // Flatten all players into a single list with team/tournament info
  const allPlayers = useMemo(() => {
    const players: any[] = [];
    teams.forEach(team => {
      ['player1', 'player2'].forEach(role => {
        // Support both camelCase and snake_case
        const firstName = team[role + 'FirstName'] || team[role + '_first_name'] || '';
        const lastName = team[role + 'LastName'] || team[role + '_last_name'] || '';
        const phone = team[role + 'Phone'] || team.phoneNumber || team.phone_number || '';
        const city = team.city || '';
        const playerId = `${firstName}|${lastName}|${phone}`;
        const partner =
          role === 'player1'
            ? (team.player2FirstName || team.player2_first_name || '') + ' ' + (team.player2LastName || team.player2_last_name || '')
            : (team.player1FirstName || team.player1_first_name || '') + ' ' + (team.player1LastName || team.player1_last_name || '');
        players.push({
          playerId,
          firstName,
          lastName,
          phone,
          city,
          team,
          role,
          tournaments: team.registeredTournaments || [],
          payments: team[role + 'TournamentPayments'] || {},
          partner,
          teamName: team.name,
          teamNumber: team.id, // Use id as team number
        });
      });
    });
    return players;
  }, [teams]);

  const filteredPlayers = allPlayers.filter(p => {
    const s = search.toLowerCase();
    return (
      (p.firstName || '').toLowerCase().includes(s) ||
      (p.lastName || '').toLowerCase().includes(s) ||
      (p.phone || '').toLowerCase().includes(s) ||
      (p.city || '').toLowerCase().includes(s)
    );
  });

  const handleMarkPaid = (player: any, tournamentId: string, paid: boolean) => {
    const updatedTeam = { ...player.team };
    if (!updatedTeam[player.role + 'TournamentPayments']) {
      updatedTeam[player.role + 'TournamentPayments'] = {};
    }
    updatedTeam[player.role + 'TournamentPayments'][tournamentId] = paid;
    updateTeam(updatedTeam);
    setSelectedPlayer({ ...player, payments: { ...player.payments, [tournamentId]: paid } });
  };

  const handleEditPlayer = (updatedPlayer: any) => {
    // Update the player info in the team object
    const updatedTeam = { ...selectedPlayer.team };
    if (selectedPlayer.role === 'player1') {
      updatedTeam.player1FirstName = updatedPlayer.firstName;
      updatedTeam.player1LastName = updatedPlayer.lastName;
      updatedTeam.phoneNumber = updatedPlayer.phone;
      updatedTeam.city = updatedPlayer.city;
    } else {
      updatedTeam.player2FirstName = updatedPlayer.firstName;
      updatedTeam.player2LastName = updatedPlayer.lastName;
      updatedTeam.phoneNumber = updatedPlayer.phone;
      updatedTeam.city = updatedPlayer.city;
    }
    updateTeam(updatedTeam);
    setSelectedPlayer({ ...selectedPlayer, ...updatedPlayer });
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Player Tracking</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Input
            placeholder="Search by first name, last name, phone, or city..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {!selectedPlayer ? (
          <div className="space-y-2">
            {filteredPlayers.slice(0, 30).map((player, idx) => (
              <div
                key={player.playerId && player.team && player.team.id ? `${player.playerId}|${player.team.id}` : idx}
                className="p-2 border rounded cursor-pointer hover:bg-gray-50"
                onClick={() => setSelectedPlayer(player)}
              >
                <span className="font-semibold">{player.firstName} {player.lastName}</span> — {player.phone} — {player.city} <Badge variant="outline">Team {player.teamNumber}: {player.teamName}</Badge>
              </div>
            ))}
            {filteredPlayers.length > 30 && <div className="text-xs text-gray-400">Showing first 30 results...</div>}
          </div>
        ) : (
          <div>
            <Button variant="outline" className="mb-2" onClick={() => setSelectedPlayer(null)}>
              Back to Search
            </Button>
            <div className="mb-2">
              <div className="flex items-center gap-2">
                <div className="font-bold text-lg">{selectedPlayer.firstName} {selectedPlayer.lastName}</div>
                <Button size="sm" variant="outline" onClick={() => setEditModalOpen(true)}>
                  Edit Player
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  console.log('Edit Team button clicked. Team:', selectedPlayer?.team);
                  setEditTeamModalOpen(true);
                }}>
                  Edit Team
                </Button>
              </div>
              <div>Phone: {selectedPlayer.phone}</div>
              <div>City: {selectedPlayer.city}</div>
              <div>Partner: {selectedPlayer.partner}</div>
              <div>Team: {selectedPlayer.teamName} (#{selectedPlayer.teamNumber})</div>
            </div>
            <PlayerEditor
              player={{
                ...selectedPlayer,
                firstName: selectedPlayer?.firstName || selectedPlayer?.team?.player1FirstName || selectedPlayer?.team?.player1_first_name || '',
                lastName: selectedPlayer?.lastName || selectedPlayer?.team?.player1LastName || selectedPlayer?.team?.player1_last_name || '',
                phone: selectedPlayer?.phone || selectedPlayer?.team?.phoneNumber || selectedPlayer?.team?.phone_number || '',
                city: selectedPlayer?.city || selectedPlayer?.team?.city || '',
                team: selectedPlayer?.team || {},
                role: selectedPlayer?.role || '',
              }}
              isOpen={editModalOpen}
              onClose={() => setEditModalOpen(false)}
              onSave={handleEditPlayer}
            />
            {/* Only render TeamEditor if team is defined */}
            {selectedPlayer?.team && (
              <>
                {console.log('TeamEditor props:', selectedPlayer.team)}
                <TeamEditor
                  team={selectedPlayer.team}
                  isOpen={editTeamModalOpen}
                  onClose={() => setEditTeamModalOpen(false)}
                  onSave={updateTeam}
                />
              </>
            )}
            <div>
              <div className="font-semibold mb-1">Tournaments:</div>
              {selectedPlayer.tournaments.length === 0 && <div className="text-gray-500">Not registered in any tournaments.</div>}
              <ul className="space-y-1">
                {selectedPlayer.tournaments.map((tid: string) => {
                  const t = tournaments.find((tt: any) => tt.id === tid);
                  const paid = selectedPlayer.payments[tid];
                  return (
                    <li key={tid} className="flex items-center gap-2">
                      <span>{t ? t.name : tid}</span>
                      {paid ? (
                        <>
                          <Badge className="bg-green-600">Paid</Badge>
                          <Button size="sm" variant="destructive" onClick={() => handleMarkPaid(selectedPlayer, tid, false)}>
                            Reverse
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" onClick={() => handleMarkPaid(selectedPlayer, tid, true)}>
                          Mark Paid
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PlayerTracking;
