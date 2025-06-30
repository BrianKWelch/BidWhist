import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle2 } from 'lucide-react';

interface WaitingForConfirmationProps {
  teamName: string;
  opponentName: string;
  submittedScore: {
    teamScore: number;
    opponentScore: number;
    boston?: string;
  };
}

export const WaitingForConfirmation: React.FC<WaitingForConfirmationProps> = ({
  teamName,
  opponentName,
  submittedScore
}) => {
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center flex items-center justify-center gap-2">
          <Clock className="h-5 w-5 text-blue-500 animate-pulse" />
          Waiting for Confirmation
        </CardTitle>
        <p className="text-center text-sm text-muted-foreground">
          {teamName} vs {opponentName}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium text-green-700">Score Submitted Successfully</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="font-semibold text-sm">{teamName}</p>
              <p className="text-3xl font-bold text-blue-600">{submittedScore.teamScore}</p>
            </div>
            <div>
              <p className="font-semibold text-sm">{opponentName}</p>
              <p className="text-3xl font-bold text-blue-600">{submittedScore.opponentScore}</p>
            </div>
          </div>
          
          {submittedScore.boston && (
            <div className="mt-3 text-center">
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                Boston: {submittedScore.boston === 'us' ? teamName : opponentName}
              </Badge>
            </div>
          )}
        </div>

        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            <span className="text-sm font-medium">Waiting for {opponentName} to confirm</span>
          </div>
          <p className="text-xs text-muted-foreground">
            We've sent them a message to confirm this score
          </p>
        </div>
      </CardContent>
    </Card>
  );
};