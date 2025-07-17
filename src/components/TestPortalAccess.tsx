import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAppContext } from '@/contexts/AppContext';
import { Eye, Settings, Users } from 'lucide-react';

const TestPortalAccess = () => {
  const [testMode, setTestMode] = useState(false);
  const { teams } = useAppContext();

  const handleTestPortal = () => {
    if (testMode) {
      // Open portal in test mode - bypass phone number requirement
      const testUrl = `/portal?test=true`;
      window.open(testUrl, '_blank');
    } else {
      // Open normal portal
      window.open('/portal', '_blank');
    }
  };

  return (
    <Card className="bg-green-50 border-green-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-800">
          <Settings className="h-5 w-5" />
          Portal Testing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="test-mode"
            checked={testMode}
            onCheckedChange={setTestMode}
          />
          <Label htmlFor="test-mode" className="text-sm">
            Enable Test Mode (bypass phone login)
          </Label>
        </div>
        
        {testMode && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              <strong>Test Mode:</strong> You'll be able to select any team without entering a phone number.
            </p>
          </div>
        )}
        
        <Button 
          onClick={handleTestPortal}
          className={`w-full ${testMode ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          <Eye className="h-4 w-4 mr-2" />
          {testMode ? 'Open Portal (Test Mode)' : 'Open Portal (Normal)'}
        </Button>
        
        {teams.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium mb-2">Available Teams:</p>
            <div className="space-y-1">
              {teams.slice(0, 3).map((team) => (
                <div key={team.id} className="flex items-center justify-between text-xs bg-white rounded p-2">
                  <span>Team {team.teamNumber}: {team.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {team.phoneNumber}
                  </Badge>
                </div>
              ))}
              {teams.length > 3 && (
                <p className="text-xs text-gray-500">...and {teams.length - 3} more teams</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TestPortalAccess;