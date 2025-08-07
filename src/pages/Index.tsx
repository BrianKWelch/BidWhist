import React from 'react';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

const Index: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-4">
        {/* Header with Portal Button */}
        <div className="flex justify-between items-center mb-6">
          <div></div> {/* Empty div for spacing */}
         {/* <Button 
            onClick={() => window.open('#/portal?admin=1', '_blank')}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Go to Player Portal
          </Button> */}
        </div>
        
        {/* Main Content - Full Width */}
        <div className="flex justify-center">
          <div className="w-full max-w-6xl">
            <AppLayout />
          </div>
        </div>
      </div>
    </div>
  );
};

export { Index };
export default Index;