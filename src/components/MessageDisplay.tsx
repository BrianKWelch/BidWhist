import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Clock } from 'lucide-react';

interface Message {
  id: string;
  to: string;
  message: string;
  timestamp: Date;
}

interface MessageDisplayProps {
  messages: Message[];
}

export const MessageDisplay: React.FC<MessageDisplayProps> = ({ messages }) => {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (messages.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No messages yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((message) => (
        <Card key={message.id} className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-600" />
                <Badge variant="secondary" className="text-xs">
                  To: {message.to}
                </Badge>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatTime(message.timestamp)}
              </div>
            </div>
            <p className="text-sm leading-relaxed">{message.message}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};