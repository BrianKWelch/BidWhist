import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Send, Mail, MessageSquare, Info } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { sendEmail, sendSMSBatch } from '@/api/messaging';
import InstructionsModal from './InstructionsModal';

interface MessageSenderProps {
  recipients: string[];
  defaultMessage?: string;
  title?: string;
}

const MessageSender: React.FC<MessageSenderProps> = ({ 
  recipients, 
  defaultMessage = '', 
  title = 'Send Message' 
}) => {
  const [message, setMessage] = useState(defaultMessage);
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const handleSendEmail = async () => {
    if (!message.trim() || recipients.length === 0) {
      toast({ 
        title: 'Error', 
        description: 'Please enter a message and ensure there are recipients',
        variant: 'destructive'
      });
      return;
    }

    setSending(true);
    try {
      const emailData = {
        to: recipients,
        subject: subject || 'Tournament Message',
        text: message,
        html: `<p>${message.replace(/\n/g, '<br>')}</p>`
      };
      
      await sendEmail(emailData);
      
      toast({ 
        title: 'Emails Sent!', 
        description: `Successfully sent to ${recipients.length} recipients` 
      });
      
      setMessage('');
      setSubject('');
    } catch (error) {
      console.error('Email error:', error);
      toast({ 
        title: 'Email Error', 
        description: 'Failed to send emails. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSending(false);
    }
  };

  const handleSendSMS = async () => {
    if (!message.trim() || recipients.length === 0) {
      toast({ 
        title: 'Error', 
        description: 'Please enter a message and ensure there are recipients',
        variant: 'destructive'
      });
      return;
    }

    setSending(true);
    try {
      const smsData = {
        to: recipients,
        body: message
      };
      
      const results = await sendSMSBatch(smsData);
      
      toast({ 
        title: 'SMS Messages Sent!', 
        description: `Sent ${results.length} SMS messages from 317-250-6454`,
        variant: 'default'
      });
      
      setMessage('');
    } catch (error) {
      console.error('SMS error:', error);
      toast({ 
        title: 'SMS Error', 
        description: 'Failed to send SMS messages. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              {title}
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowInstructions(true)}
              className="text-blue-600 hover:text-blue-700"
            >
              <Info className="w-4 h-4 mr-1" />
              SMS Setup
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Recipients ({recipients.length})</Label>
            <div className="text-sm text-gray-600 max-h-20 overflow-y-auto border rounded p-2">
              {recipients.length > 0 ? recipients.join(', ') : 'No recipients selected'}
            </div>
          </div>

          <div>
            <Label>Subject (for email)</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject"
            />
          </div>

          <div>
            <Label>Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter your message"
              rows={6}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSendEmail}
              disabled={sending || recipients.length === 0}
              className="flex-1"
            >
              <Mail className="w-4 h-4 mr-2" />
              {sending ? 'Sending...' : 'Send Email'}
            </Button>
            
            <Button
              onClick={handleSendSMS}
              disabled={sending || recipients.length === 0}
              variant="outline"
              className="flex-1"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              {sending ? 'Sending...' : 'Send SMS'}
            </Button>
          </div>

          <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
            <strong>From:</strong> 317-250-6454 • <strong>Note:</strong> Configure Twilio credentials for real SMS delivery
          </div>
        </CardContent>
      </Card>

      <InstructionsModal 
        open={showInstructions} 
        onClose={() => setShowInstructions(false)} 
      />
    </>
  );
};

export default MessageSender;