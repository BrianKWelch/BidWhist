import React, { useState, useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const PlayerTracking: React.FC = () => {
  const { teams, tournaments, updateTeam } = useAppContext();
  const [search, setSearch] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);

  // Flatten all players into a single list with team/tournament info
  const allPlayers = useMemo(() => {
    const players: any[] = [];
    teams.forEach(team => {
      ['player1', 'player2'].forEach(role => {
        const firstName = team[role + 'FirstName'];
        const lastName = team[role + 'LastName'];
        const phone = team[role + 'Phone'] || team.phoneNumber;
        const city = team.city;
        const playerId = `${firstName}|${lastName}|${phone}`;
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
          partner: role === 'player1' ? `${team.player2FirstName} ${team.player2LastName}` : `${team.player1FirstName} ${team.player1LastName}`,
          teamName: team.name,
          teamNumber: team.teamNumber,
        });
      });
    });
    return players;
  }, [teams]);

  const filteredPlayers = allPlayers.filter(p => {
    const s = search.toLowerCase();
    return (
      p.firstName.toLowerCase().includes(s) ||
      p.lastName.toLowerCase().includes(s) ||
      p.phone.toLowerCase().includes(s) ||
      p.city.toLowerCase().includes(s)
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
            {filteredPlayers.slice(0, 30).map(player => (
              <div
                key={player.playerId + player.team.teamNumber}
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
              <div className="font-bold text-lg">{selectedPlayer.firstName} {selectedPlayer.lastName}</div>
              <div>Phone: {selectedPlayer.phone}</div>
              <div>City: {selectedPlayer.city}</div>
              <div>Partner: {selectedPlayer.partner}</div>
              <div>Team: {selectedPlayer.teamName} (#{selectedPlayer.teamNumber})</div>
            </div>
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
