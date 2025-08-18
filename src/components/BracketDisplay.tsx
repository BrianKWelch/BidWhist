import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface BracketTeam {
  seed: number;
  teamId: string;
  teamName: string;
  teamNumber: number;
}

interface BracketMatch {
  id: string;
  round: number;
  table: number;
  team1?: BracketTeam;
  team2?: BracketTeam;
  winner?: BracketTeam;
  team1Score?: number;
  team2Score?: number;
}

interface BracketDisplayProps {
  size: number;
  matches: BracketMatch[];
  teams: BracketTeam[]; // seeded teams array, in seed order (row = seed)
  onScoreUpdate: (matchId: string, team1Score: number, team2Score: number) => void;
  onAdvanceWinner: (matchId: string) => void;
}

export const BracketDisplay: React.FC<BracketDisplayProps> = ({
  size,
  matches,
  teams,
  onScoreUpdate,
  onAdvanceWinner
}) => {
  const rounds = Math.log2(size);
  
  const getRoundName = (round: number) => {
    if (round === rounds) return 'Final';
    if (round === rounds - 1) return 'Semi-Final';
    if (round === rounds - 2) return 'Quarter-Final';
    return `Round ${round}`;
  };

     // Table info logic remains, but all seeding is now based on the provided seed (row number from TournamentResults)
   const getTableInfo = (round: number, table: number, size: number) => {
     const tablesInRound = size / Math.pow(2, round);
     const tablesInNextRound = size / Math.pow(2, round + 1);
     let info = `Table ${table}`;
     if (round > 1 && tablesInRound > tablesInNextRound) {
       if (table <= tablesInNextRound) {
         info += ` (Winners stay)`;
       } else {
         const moveToTable = table - tablesInNextRound;
         info += ` (Winner moves to Table ${moveToTable})`;
       }
     }
     return info;
   };

  const handleAdvanceWinner = (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match || !match.team1 || !match.team2) return;
    
    onAdvanceWinner(matchId);
  };

     return (
     <div className="space-y-6">
               <style>
          {`
            .score-input::-webkit-outer-spin-button,
            .score-input::-webkit-inner-spin-button {
              background: #a60002 !important;
              color: white !important;
              opacity: 1 !important;
              border: none !important;
              width: 20px !important;
              height: 20px !important;
            }
            .score-input::-webkit-outer-spin-button:hover,
            .score-input::-webkit-inner-spin-button:hover {
              background: #a60002 !important;
              color: white !important;
              opacity: 1 !important;
            }
            .score-input::-webkit-outer-spin-button:active,
            .score-input::-webkit-inner-spin-button:active {
              background: #a60002 !important;
              color: white !important;
            }
            .score-input::-webkit-outer-spin-button:focus,
            .score-input::-webkit-inner-spin-button:focus {
              background: #a60002 !important;
              color: white !important;
            }
          `}
        </style>
             <h3 className="text-3xl font-bold text-center" style={{ color: '#a60002' }}>
         {size} Team Elimination Bracket
       </h3>
      

      
      <div className="grid gap-6">
        {Array.from({ length: rounds }, (_, roundIndex) => {
          const round = roundIndex + 1;
          const roundMatches = matches.filter(m => m.round === round).sort((a, b) => a.table - b.table);
          
          return (
            <Card key={round} className="w-full">
              <CardHeader>
                <CardTitle className="text-center">
                  {getRoundName(round)} - {roundMatches.length} Tables
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4" style={{
                  gridTemplateColumns: `repeat(${Math.max(1, Math.min(4, roundMatches.length))}, 1fr)`
                }}>
                  {roundMatches.map(match => (
                    <div key={match.id} className="border rounded-lg p-4 space-y-3">
                                             <div className="text-center font-medium text-sm" style={{ color: '#a60002' }}>
                         {getTableInfo(match.round, match.table, size)}
                       </div>
                      
                      {/* Team 1 */}
                      <div className="flex items-center justify-between p-2 border rounded">
                                                 <div className="flex items-center gap-2">
                           {match.team1 && (
                             <>
                               <Badge variant="outline">#{match.team1.seed}</Badge>
                                                               <div className="flex flex-col items-center">
                                                                     {(() => {
                                     const teamNum = match.team1.teamNumber ?? match.team1.teamId;
                                     return teamNum ? (
                                       <span className="text-xs font-bold" style={{ color: 'black' }}>{teamNum}</span>
                                     ) : null;
                                   })()}
                                  <span className="text-sm font-medium">
                                    {match.team1.teamName}
                                  </span>
                                </div>
                             </>
                           )}
                          {!match.team1 && (
                            <span className="text-sm text-gray-500">TBD</span>
                          )}
                        </div>
                        {match.team1 && (
                                                     <Input
                             type="number"
                             className="w-16 h-8 text-center score-input"
                             value={match.team1Score || ''}
                             onChange={(e) => {
                               const score = parseInt(e.target.value) || 0;
                               onScoreUpdate(match.id, score, match.team2Score || 0);
                             }}
                             min="0"
                           />
                        )}
                      </div>
                      
                      <div className="text-center text-xs text-gray-500">vs</div>
                      
                      {/* Team 2 */}
                      <div className="flex items-center justify-between p-2 border rounded">
                                                 <div className="flex items-center gap-2">
                           {match.team2 && (
                             <>
                               <Badge variant="outline">#{match.team2.seed}</Badge>
                                                               <div className="flex flex-col items-center">
                                                                     {(() => {
                                     const teamNum = match.team2.teamNumber ?? match.team2.teamId;
                                     return teamNum ? (
                                       <span className="text-xs font-bold" style={{ color: 'black' }}>{teamNum}</span>
                                     ) : null;
                                   })()}
                                  <span className="text-sm font-medium">
                                    {match.team2.teamName}
                                  </span>
                                </div>
                             </>
                           )}
                          {!match.team2 && (
                            <span className="text-sm text-gray-500">TBD</span>
                          )}
                        </div>
                        {match.team2 && (
                                                     <Input
                             type="number"
                             className="w-16 h-8 text-center score-input"
                             value={match.team2Score || ''}
                             onChange={(e) => {
                               const score = parseInt(e.target.value) || 0;
                               onScoreUpdate(match.id, match.team1Score || 0, score);
                             }}
                             min="0"
                           />
                        )}
                      </div>
                      
                      {/* Advance Winner Button */}
                      {match.team1 && match.team2 && 
                       typeof match.team1Score === 'number' && 
                       typeof match.team2Score === 'number' && (
                                                 <Button
                           size="sm"
                           className="w-full"
                           onClick={() => handleAdvanceWinner(match.id)}
                           disabled={match.winner !== undefined}
                           style={{ backgroundColor: '#a60002', color: 'white' }}
                         >
                          {match.winner ? 
                            `Winner: ${match.winner.teamName}` : 
                            'Advance Winner'
                          }
                        </Button>
                      )}
                      
                      {match.winner && (
                        <div className="text-center p-2 bg-green-100 rounded">
                          <Badge className="bg-green-600">
                          Winner: #{match.winner.seed} {match.winner.teamName}
                          {(() => {
                            const teamNum = match.winner.teamNumber ?? match.winner.teamId;
                            return teamNum ? ` (Team # ${teamNum})` : '';
                          })()}
                          </Badge>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};