import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Send, X, Edit } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { toast } from '@/hooks/use-toast';

const MessageManager: React.FC = () => {
  const { messages, addMessage, updateMessage, deleteMessage, getActiveMessages } = useAppContext();
  const [customMessage, setCustomMessage] = useState('');
  const [messageType, setMessageType] = useState<'info' | 'warning' | 'success' | 'error'>('info');

  const predefinedMessages = [
    {
      id: 'lunch',
      title: 'Lunch Break',
      message: '🍕 Lunch will be served in 15 minutes! Please make your way to the dining area.',
      type: 'info' as const
    },
    {
      id: 'round',
      title: 'Next Round',
      message: '🎯 Next round starts in 10 minutes! Please return to your assigned tables.',
      type: 'warning' as const
    },
    {
      id: 'break',
      title: 'Break Time',
      message: '☕ 15-minute break! Snacks and drinks available at the concession stand.',
      type: 'info' as const
    },
    {
      id: 'final',
      title: 'Final Round',
      message: '🏆 Final round of the tournament! Championship on the line - give it your all!',
      type: 'success' as const
    },
    {
      id: 'awards',
      title: 'Awards Ceremony',
      message: '🏅 Awards ceremony in 10 minutes! Please gather in the main hall.',
      type: 'success' as const
    }
  ];

  const activeMessage = getActiveMessages()[0]; // Get the first active message

  const handleSendPredefined = async (predefined: typeof predefinedMessages[0]) => {
    try {
      // Deactivate any existing messages
      for (const msg of messages) {
        if (msg.active) {
          await updateMessage(msg.id, { active: false });
        }
      }

      // Add the new message
      await addMessage({
        text: predefined.message,
        type: predefined.type,
        active: true,
        createdBy: 'admin'
      });

      toast({
        title: 'Message Posted',
        description: `"${predefined.title}" message is now scrolling on all screens`,
      });
    } catch (error) {
      console.error('Error sending predefined message:', error);
    }
  };

  const handleSendCustom = async () => {
    if (!customMessage.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a message',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Deactivate any existing messages
      for (const msg of messages) {
        if (msg.active) {
          await updateMessage(msg.id, { active: false });
        }
      }

      // Add the new message
      await addMessage({
        text: customMessage,
        type: messageType,
        active: true,
        createdBy: 'admin'
      });

      setCustomMessage('');
      toast({
        title: 'Custom Message Posted',
        description: 'Your custom message is now scrolling on all screens',
      });
    } catch (error) {
      console.error('Error sending custom message:', error);
    }
  };

  const handleRemoveMessage = async () => {
    if (activeMessage) {
      try {
        await updateMessage(activeMessage.id, { active: false });
        toast({
          title: 'Message Removed',
          description: 'The scrolling message has been removed from all screens',
        });
      } catch (error) {
        console.error('Error removing message:', error);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Message Manager</h2>
        {activeMessage && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <MessageSquare className="h-3 w-3 mr-1" />
              Active Message
            </Badge>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRemoveMessage}
            >
              <X className="h-4 w-4 mr-1" />
              Remove Message
            </Button>
          </div>
        )}
      </div>

      {activeMessage && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800">Currently Displaying</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-green-700 font-medium">{activeMessage.text}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                {activeMessage.type}
              </Badge>
              <span className="text-xs text-green-600">
                Posted: {activeMessage.createdAt.toLocaleTimeString()}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Predefined Messages */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Messages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {predefinedMessages.map((predefined) => (
              <div key={predefined.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{predefined.title}</h4>
                  <Badge variant="outline" className="text-xs">
                    {predefined.type}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mb-3">{predefined.message}</p>
                <Button
                  onClick={() => handleSendPredefined(predefined)}
                  className="w-full"
                  size="sm"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Post This Message
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Custom Message */}
        <Card>
          <CardHeader>
            <CardTitle>Custom Message</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Message Type</label>
              <div className="flex gap-2">
                {(['info', 'warning', 'success', 'error'] as const).map((type) => (
                  <Button
                    key={type}
                    variant={messageType === type ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMessageType(type)}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Message Text</label>
              <Textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Enter your custom message..."
                rows={4}
                className="resize-none"
              />
            </div>

            <Button
              onClick={handleSendCustom}
              disabled={!customMessage.trim()}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              Post Custom Message
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MessageManager;
