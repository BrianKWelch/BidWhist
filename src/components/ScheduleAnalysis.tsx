import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Calendar, Users, Target } from 'lucide-react';

const ScheduleAnalysis = () => {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule Display Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-2">Current Implementation</h3>
            <p className="text-sm text-blue-700">
              The team portal schedule tab currently shows only matches where the logged-in team is a participant.
              This is filtered using: <code className="bg-blue-100 px-1 rounded">match.teamA === team.id || match.teamB === team.id</code>
            </p>
          </div>
          
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h3 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Why Show Entire Schedule?
            </h3>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Teams can see when other matches are happening</li>
              <li>• Helps with tournament logistics and planning</li>
              <li>• Allows teams to watch other games</li>
              <li>• Provides full tournament context</li>
            </ul>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-semibold text-green-800 mb-2">Implementation Impact</h3>
            <div className="text-sm text-green-700 space-y-2">
              <p><strong>Code Change:</strong> Remove the team filter in getTeamSchedule()</p>
              <p><strong>Result:</strong> All tournament matches display instead of just team-specific ones</p>
              <p><strong>User Experience:</strong> Teams see complete tournament schedule</p>
            </div>
          </div>

          <div className="bg-red-50 p-4 rounded-lg">
            <h3 className="font-semibold text-red-800 mb-2">Potential Concerns</h3>
            <ul className="text-sm text-red-700 space-y-1">
              <li>• Information overload for teams</li>
              <li>• May confuse teams about their specific matches</li>
              <li>• Longer loading times with more data</li>
              <li>• Less focused user experience</li>
            </ul>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="font-semibold text-purple-800 mb-2">Recommendation</h3>
            <p className="text-sm text-purple-700">
              Consider a hybrid approach: Show team's matches prominently at the top, 
              followed by a collapsible "Full Tournament Schedule" section below.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Code Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Badge variant="outline">Current (Team-Only)</Badge>
              <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
{`const teamMatches = schedule.matches.filter(match => {
  return match.teamA === team.id || match.teamB === team.id;
});`}
              </pre>
            </div>
            <div className="space-y-2">
              <Badge variant="outline">Proposed (All Matches)</Badge>
              <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
{`const teamMatches = schedule.matches;
// Shows all matches in tournament`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ScheduleAnalysis;