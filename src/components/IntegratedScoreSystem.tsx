import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SMSScoreSystem } from './SMSScoreSystem';
import { ScoreConfirmationFlow } from './ScoreConfirmationFlow';
import { ScoreSubmissionFlow } from './ScoreSubmissionFlow';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface IntegratedScoreSystemProps {
  tournamentId: string;
}

export const IntegratedScoreSystem: React.FC<IntegratedScoreSystemProps> = ({ tournamentId }) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Score Management System</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertDescription>
              Complete score management system with SMS integration. Teams can submit scores via SMS,
              opponents receive confirmation requests, and all scores are tracked and verified.
            </AlertDescription>
          </Alert>
          
          <Tabs defaultValue="sms" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="sms">SMS Score Requests</TabsTrigger>
              <TabsTrigger value="confirmations">Score Confirmations</TabsTrigger>
              <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            </TabsList>
            
            <TabsContent value="sms" className="mt-6">
              <SMSScoreSystem tournamentId={tournamentId} />
            </TabsContent>
            
            <TabsContent value="confirmations" className="mt-6">
              <ScoreConfirmationFlow tournamentId={tournamentId} />
            </TabsContent>
            
            <TabsContent value="manual" className="mt-6">
              <ScoreSubmissionFlow tournamentId={tournamentId} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};