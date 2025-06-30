import React from 'react';
import AppLayout from '@/components/AppLayout';
import TestPortalAccess from '@/components/TestPortalAccess';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, ExternalLink } from 'lucide-react';

const Index: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <AppLayout />
          </div>
          <div className="space-y-4">
            <TestPortalAccess />
            
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-800">
                  <Users className="h-5 w-5" />
                  Team Portal Access
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-blue-700 mb-4">
                  Teams can now access their schedule, submit scores, and view standings through a simple portal.
                </p>
                <p className="text-sm text-blue-600 mb-4">
                  Share this URL with your teams: <strong>{window.location.origin}/portal</strong>
                </p>
                <Button 
                  onClick={() => window.open('/portal', '_blank')}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Team Portal
                </Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>How It Works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                  <div>
                    <p className="font-medium">Teams visit /portal</p>
                    <p className="text-sm text-gray-600">Easy to remember URL they can bookmark</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                  <div>
                    <p className="font-medium">Enter phone number</p>
                    <p className="text-sm text-gray-600">Simple login using team's registered phone</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                  <div>
                    <p className="font-medium">Access everything</p>
                    <p className="text-sm text-gray-600">Schedule, score entry, results, and standings</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export { Index };
export default Index;