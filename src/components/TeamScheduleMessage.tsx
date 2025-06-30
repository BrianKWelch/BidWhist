import React from 'react';
import { useAppContext } from '@/contexts/AppContext';
import type { ScheduleMatch } from '@/contexts/AppContext';

interface TeamScheduleMessageProps {
  teamName: string;
  tournamentId: string;
}

export const TeamScheduleMessage: React.FC<TeamScheduleMessageProps> = ({ teamName, tournamentId }) => {
  const { schedules, tournaments } = useAppContext();
  
  const schedule = schedules.find(s => s.tournamentId === tournamentId);
  const tournament = tournaments.find(t => t.id === tournamentId);
  
  if (!schedule || !tournament) {
    return null;
  }

  const teamMatches = schedule.matches.filter(match => 
    match.teamA === teamName || match.teamB === teamName
  ).sort((a, b) => a.round - b.round);

  const formatMatch = (match: ScheduleMatch, teamName: string) => {
    const opponent = match.teamA === teamName ? match.teamB : match.teamA;
    const tableNum = Math.floor(Math.random() * 10) + 1; // Mock table assignment
    
    if (opponent === 'BYE') {
      return `Round ${match.round}: BYE (no game)`;
    }
    
    return `Round ${match.round}: vs ${opponent} at Table ${tableNum}`;
  };

  const messageContent = [
    `${tournament.name} Schedule for ${teamName}:`,
    '',
    ...teamMatches.map(match => formatMatch(match, teamName)),
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
  const teamMatches = matches.filter(match => 
    match.teamA === teamName || match.teamB === teamName
  ).sort((a, b) => a.round - b.round);

  const formatMatch = (match: ScheduleMatch, teamName: string) => {
    const opponent = match.teamA === teamName ? match.teamB : match.teamA;
    const tableNum = Math.floor(Math.random() * 10) + 1;
    
    if (opponent === 'BYE') {
      return `Round ${match.round}: BYE (no game)`;
    }
    
    return `Round ${match.round}: vs ${opponent} at Table ${tableNum}`;
  };

  return [
    `${tournamentName} Schedule for ${teamName}:`,
    '',
    ...teamMatches.map(match => formatMatch(match, teamName)),
    '',
    'Good luck!'
  ].join('\n');
};