import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Code, Eye, Bug, CheckCircle } from 'lucide-react';

const ScheduleIssueAnalysis = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-red-500" />
            Analysis: Why Schedule Changes Aren't Showing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-semibold text-red-800 mb-2">Issue Identified</h3>
            <p className="text-red-700 text-sm">
              The schedule tab is still filtering to show only team-specific matches instead of all tournament games.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Current Implementation Problem
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Current Code (Lines 47-63):</h4>
            <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">
{`const getTeamSchedule = () => {
  if (!team) return [];
  const teamSchedules: any[] = [];
  
  schedules.forEach(schedule => {
    const teamMatches = schedule.matches.filter(match => {
      return match.teamA === team.id || match.teamB === team.id;
    });
    
    teamMatches.forEach(match => {
      // Only adds team-specific matches
    });
  });
  
  return teamSchedules.sort((a, b) => a.round - b.round);
};`}
            </pre>
          </div>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-medium text-red-800 mb-2">Problem:</h4>
            <p className="text-red-700 text-sm">
              The filter on line 52-54 restricts matches to only those where the current team participates.
              This prevents showing the full tournament schedule.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Required Fix
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Solution - Remove Team Filter:</h4>
            <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">
{`const getTeamSchedule = () => {
  const allSchedules: any[] = [];
  
  schedules.forEach(schedule => {
    // Remove the team filter - show ALL matches
    schedule.matches.forEach(match => {
      const tournament = tournaments.find(t => t.id === schedule.tournamentId);
      const teamA = teams.find(t => t.id === match.teamA);
      const teamB = teams.find(t => t.id === match.teamB);
      
      allSchedules.push({ 
        ...match, 
        tournamentName: tournament?.name || 'Unknown Tournament',
        teamA,
        teamB
      });
    });
  });
  
  return allSchedules.sort((a, b) => a.round - b.round);
};`}
            </pre>
          </div>
          
          <Badge variant="outline" className="text-green-700 border-green-300">
            This will show ALL tournament matches, not just team-specific ones
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Display Changes Needed
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Schedule Display Update:</h4>
            <p className="text-sm text-blue-700 mb-3">
              The display logic also needs updating to show both teams instead of just opponent.
            </p>
            <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">
{`// Instead of showing "vs Team X"
// Show "Team A vs Team B" for all matches
<p className="text-sm">
  Team {match.teamA?.teamNumber || 'TBD'} vs Team {match.teamB?.teamNumber || 'TBD'}
</p>`}
            </pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm">The team filter in getTeamSchedule() prevents showing all games</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm">Display logic shows opponent instead of both teams</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">Fix: Remove team filtering and update display format</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ScheduleIssueAnalysis;