import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Phone, Settings, Code } from 'lucide-react';

interface InstructionsModalProps {
  open: boolean;
  onClose: () => void;
}

const InstructionsModal: React.FC<InstructionsModalProps> = ({ open, onClose }) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            SMS Setup for Real Text Messages (317-250-6454)
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-800">Why No SMS Messages Are Sent</h3>
                  <p className="text-sm text-red-700">
                    Your personal Verizon number (317-250-6454) cannot send SMS programmatically without proper API setup.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Quick Fix: Use Twilio with Your Number
            </h3>
            
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <h4 className="font-medium text-green-800 mb-2">Step-by-Step Setup (15 minutes)</h4>
                <ol className="text-sm space-y-2 text-green-700">
                  <li><strong>1.</strong> Go to <a href="https://twilio.com/try-twilio" target="_blank" className="text-blue-600 hover:underline font-medium">twilio.com/try-twilio</a></li>
                  <li><strong>2.</strong> Sign up (free $15 credit)</li>
                  <li><strong>3.</strong> Get a Twilio phone number ($1/month)</li>
                  <li><strong>4.</strong> Copy your Account SID and Auth Token</li>
                  <li><strong>5.</strong> Replace YOUR_ACCOUNT_SID and YOUR_AUTH_TOKEN in the code</li>
                </ol>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
                  <Code className="w-4 h-4" />
                  Code Changes Needed
                </h4>
                <div className="text-sm text-blue-700 space-y-1">
                  <p>In <code className="bg-white px-1 rounded">src/api/messaging.ts</code>:</p>
                  <ul className="ml-4 space-y-1">
                    <li>• Replace YOUR_ACCOUNT_SID with your Twilio Account SID</li>
                    <li>• Replace YOUR_AUTH_TOKEN with your Twilio Auth Token</li>
                    <li>• Update the From number to your Twilio number</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4">
              <h4 className="font-medium text-yellow-800 mb-2">Alternative: Keep Your Verizon Number</h4>
              <p className="text-sm text-yellow-700">
                Port your 317-250-6454 to Twilio ($20 fee) to send SMS from your existing number, 
                or use Twilio number and set up call forwarding from Verizon.
              </p>
            </CardContent>
          </Card>

          <div className="text-xs text-gray-500 space-y-1">
            <p><strong>Current Status:</strong> Mock mode - messages logged to console only</p>
            <p><strong>After Setup:</strong> Real SMS messages will be sent to recipients</p>
            <p><strong>Cost:</strong> ~$0.0075 per SMS message sent</p>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={onClose}>Understood</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InstructionsModal;