import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, MessageSquare } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface SampleMessagesProps {
  onSelectMessage: (message: string) => void;
  tournamentName?: string;
}

const SampleMessages: React.FC<SampleMessagesProps> = ({ 
  onSelectMessage, 
  tournamentName = 'Tournament' 
}) => {
  const sampleMessages = [
    {
      title: 'Tournament Start',
      message: `🏆 Welcome to ${tournamentName}! Tournament starts in 30 minutes. Please check in at the registration table. Good luck to all teams! 🎯`
    },
    {
      title: 'Round Schedule',
      message: `📅 ${tournamentName} Round 1 Schedule:\n\nTable 1: Team A vs Team B\nTable 2: Team C vs Team D\nTable 3: Team E vs Team F\n\nRound starts in 15 minutes!`
    },
    {
      title: 'Break Announcement',
      message: `⏰ 15-minute break before the next round. Snacks and drinks available at the concession stand. Next round starts at [TIME].`
    },
    {
      title: 'Final Round',
      message: `🏁 Final round of ${tournamentName}! This is it - championship on the line. Give it your all! 🥇`
    },
    {
      title: 'Tournament Complete',
      message: `🎉 ${tournamentName} is complete! Congratulations to all participants. Awards ceremony in 10 minutes. Thank you for a great tournament!`
    },
    {
      title: 'Payment Reminder',
      message: `💰 Friendly reminder: Tournament fees are due before play begins. Please see the registration table if you haven't paid yet.`
    },
    {
      title: 'Weather Update',
      message: `🌧️ Weather update: Tournament will continue as scheduled indoors. All games moved to the main hall. See you there!`
    },
    {
      title: 'Parking Info',
      message: `🚗 Parking reminder: Free parking available in the north lot. Please do not park in reserved spaces. Thanks!`
    }
  ];

  const copyToClipboard = (message: string) => {
    navigator.clipboard.writeText(message);
    toast({ title: 'Message copied to clipboard!' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Sample Messages
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sampleMessages.map((sample, index) => (
          <div key={index} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">{sample.title}</h4>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(sample.message)}
                >
                  <Copy className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => onSelectMessage(sample.message)}
                >
                  Use
                </Button>
              </div>
            </div>
            <p className="text-xs text-gray-600 line-clamp-2">
              {sample.message}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default SampleMessages;