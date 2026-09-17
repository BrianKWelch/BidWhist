import React from 'react';
import type { LeagueLeader, LeagueLeaders } from '@/lib/league';

const BRAND = '#a60002';

const LeaderTile: React.FC<{ label: string; leader: LeagueLeader; unit: string; highlightTeamId?: string; dark?: boolean }> = ({ label, leader, unit, highlightTeamId, dark }) => {
  const isMine = highlightTeamId !== undefined && leader.teams.some(t => t.teamId === highlightTeamId);
  return (
    <div className={`rounded-lg p-2 text-center ${dark ? 'bg-black text-white' : 'text-white'} ${isMine ? 'ring-2 ring-yellow-400' : ''}`} style={dark ? undefined : { backgroundColor: BRAND }}>
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
      {leader.teams.length === 0 ? (
        <div className="text-sm opacity-70 mt-1">—</div>
      ) : (
        <>
          <div className="text-lg font-bold leading-tight">
            {leader.teams.length === 1 ? `Team ${leader.teams[0].teamId}` : leader.teams.map(t => t.teamId).join(' / ')}
          </div>
          <div className="text-[11px] opacity-90 truncate">
            {leader.teams.length === 1 ? leader.teams[0].teamName : `${leader.teams.length}-way tie`}
          </div>
          <div className="text-xs font-semibold mt-0.5">{leader.value} {unit}</div>
        </>
      )}
    </div>
  );
};

/** Three tiles: wins leader, points leader, Boston leader. Used for a week or for the season. */
const LeagueLeadersPanel: React.FC<{ leaders: LeagueLeaders; highlightTeamId?: string; compact?: boolean }> = ({ leaders, highlightTeamId, compact }) => (
  <div className={`grid grid-cols-3 ${compact ? 'gap-1' : 'gap-2'}`}>
    <LeaderTile label="Wins Leader" leader={leaders.wins} unit={leaders.wins.value === 1 ? 'win' : 'wins'} highlightTeamId={highlightTeamId} dark />
    <LeaderTile label="Points Leader" leader={leaders.points} unit="pts" highlightTeamId={highlightTeamId} />
    <LeaderTile label="Boston Leader" leader={leaders.bostons} unit={leaders.bostons.value === 1 ? 'Boston' : 'Bostons'} highlightTeamId={highlightTeamId} dark />
  </div>
);

export default LeagueLeadersPanel;
