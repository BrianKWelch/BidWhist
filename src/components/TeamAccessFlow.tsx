import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Smartphone, Monitor, MessageSquare, CheckCircle } from 'lucide-react';

interface TeamAccessFlowProps {
  teamName: string;
  gameId: string;
}

export const TeamAccessFlow: React.FC<TeamAccessFlowProps> = ({ teamName, gameId }) => {
  const [accessMethod, setAccessMethod] = useState<'web' | 'sms' | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [gameCode, setGameCode] = useState('');

  const webUrl = `https://tournament.app/game/${gameId}`;
  const smsInstructions = `Text "SCORE ${gameCode}" to enter scores`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            How Teams Access Score Entry
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Teams can enter and confirm scores through two methods
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border-2 border-blue-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  Web Interface
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Alert>
                  <AlertDescription>
                    Teams access a dedicated web page for their game
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label>Game URL</Label>
                  <Input value={webUrl} readOnly className="text-sm" />
                  <p className="text-xs text-muted-foreground">
                    Unique URL sent to each team via SMS or email
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Features:</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Visual score entry form</li>
                    <li>• Boston selection buttons</li>
                    <li>• Real-time confirmation flow</li>
                    <li>• Mobile-friendly design</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-green-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  SMS Text Response
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Alert>
                  <AlertDescription>
                    Teams respond to SMS messages with score format
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label>Text Format</Label>
                  <Input value="SCORE 21-15 NONE" readOnly className="text-sm font-mono" />
                  <p className="text-xs text-muted-foreground">
                    Format: SCORE [your-score]-[opponent-score] [BOSTON/NONE]
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Examples:</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground font-mono">
                    <li>• SCORE 21-15 NONE</li>
                    <li>• SCORE 21-19 BOSTON</li>
                    <li>• CONFIRM (to confirm opponent's score)</li>
                    <li>• DISPUTE (to dispute opponent's score)</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Score Entry & Confirmation Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg">
              <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">1</div>
              <div>
                <h4 className="font-medium">Winning Team Enters Score</h4>
                <p className="text-sm text-muted-foreground">Via web interface or SMS text</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 p-4 bg-yellow-50 rounded-lg">
              <div className="bg-yellow-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">2</div>
              <div>
                <h4 className="font-medium">Losing Team Gets Confirmation Request</h4>
                <p className="text-sm text-muted-foreground">Receives SMS with score to confirm or dispute</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 p-4 bg-green-50 rounded-lg">
              <div className="bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">3</div>
              <div>
                <h4 className="font-medium">Losing Team Responds</h4>
                <p className="text-sm text-muted-foreground">Either confirms via web button or texts "CONFIRM"/"DISPUTE"</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 p-4 bg-purple-50 rounded-lg">
              <div className="bg-purple-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">4</div>
              <div>
                <h4 className="font-medium">Score Finalized</h4>
                <p className="text-sm text-muted-foreground">Both teams see final result, tournament bracket updates</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};