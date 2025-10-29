import React from 'react';
import { useAppContext } from '@/contexts/AppContext';
import type { ScheduleMatch } from '@/contexts/AppContext';

interface TeamScheduleMessageProps {
  teamName: string;
  tournamentId: string;
}

export const TeamScheduleMessage: React.FC<TeamScheduleMessageProps> = ({ teamName, tournamentId }) => {
  const { schedules, tournaments, teams } = useAppContext();
  
  const schedule = schedules.find(s => s.tournamentId === tournamentId);
  const tournament = tournaments.find(t => t.id === tournamentId);
  const currentTeam = teams.find(t => t.name === teamName);
  
  if (!schedule || !tournament || !currentTeam) {
    return null;
  }

  const teamMatches = schedule.matches.filter(match => 
    match.teamA === currentTeam.id || match.teamB === currentTeam.id
  ).sort((a, b) => a.round - b.round);

  const formatMatch = (match: ScheduleMatch, teamId: string) => {
    const opponent = match.teamA === teamId ? match.teamB : match.teamA;
    const tableNum = Math.floor(Math.random() * 10) + 1; // Mock table assignment
    
    if (opponent === 'BYE') {
      return `Round ${match.round}: BYE (no game)`;
    }
    
    // Look up the opponent team to get their team number
    const opponentTeam = teams.find(t => t.id === opponent);
    const opponentDisplay = opponentTeam ? `Team ${opponentTeam.teamNumber}` : opponent;
    
    return `Round ${match.round}: vs ${opponentDisplay} at Table ${tableNum}`;
  };

  const messageContent = [
    `${tournament.name} Schedule for ${teamName}:`,
    '',
    ...teamMatches.map(match => formatMatch(match, currentTeam.id)),
    '',
    'Good luck in the tournament!'
  ].join('\n');

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h4 className="font-medium mb-2">Schedule Message for {teamName}</h4>
      <pre className="whitespace-pre-wrap text-sm font-mono bg-white p-3 rounded border">
        {messageContent}
      </pre>
    </div>
  );
};

export const generateScheduleMessage = (teamName: string, matches: ScheduleMatch[], tournamentName: string): string => {
  const { teams } = useAppContext();
  
  const currentTeam = teams.find(t => t.name === teamName);
  if (!currentTeam) {
    return `${tournamentName} Schedule for ${teamName}: Team not found`;
  }
  
  const teamMatches = matches.filter(match => 
    match.teamA === currentTeam.id || match.teamB === currentTeam.id
  ).sort((a, b) => a.round - b.round);

  const formatMatch = (match: ScheduleMatch, teamId: string) => {
    const opponent = match.teamA === teamId ? match.teamB : match.teamA;
    const tableNum = match.table || 1;
    
    if (opponent === 'BYE') {
      return `Round ${match.round}: BYE (no game)`;
    }
    
    // Look up the opponent team to get their team number
    const opponentTeam = teams.find(t => t.id === opponent);
    const opponentDisplay = opponentTeam ? `Team ${opponentTeam.teamNumber}` : opponent;
    
    return `Round ${match.round}: vs ${opponentDisplay} at Table ${tableNum}`;
  };

  return [
    `${tournamentName} Schedule for ${teamName}:`,
    '',
    ...teamMatches.map(match => formatMatch(match, currentTeam.id)),
    '',
    'Good luck!'
  ].join('\n');
};