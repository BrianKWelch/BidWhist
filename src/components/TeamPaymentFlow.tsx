import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, ArrowLeft, Check } from 'lucide-react';
import { Team } from '@/contexts/AppContext';

interface TeamPaymentFlowProps {
  team: Team;
  onMarkPaid: () => void;
  onPayLater: () => void;
  onBack: () => void;
}

const TeamPaymentFlow: React.FC<TeamPaymentFlowProps> = ({
  team,
  onMarkPaid,
  onPayLater,
  onBack
}) => {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Payment for {team.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm text-gray-600 mb-2">Team Details:</div>
          <div className="font-semibold">{team.name}</div>
          <div className="text-sm text-gray-600">
            Phone: {team.phoneNumber} | City: {team.city}
          </div>
          <div className="text-sm font-medium mt-2">
            Total Amount Due: ${team.totalOwed || 0}
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium">Payment Status:</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 border rounded-lg">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {team.player1FirstName} {team.player1LastName}
                </span>
                <Badge 
                  variant={team.player1PaymentStatus === 'paid' ? 'default' : 'secondary'}
                  className={team.player1PaymentStatus === 'paid' ? 'bg-green-500' : ''}
                >
                  {team.player1PaymentStatus === 'paid' ? 'Paid' : 'Pending'}
                </Badge>
              </div>
            </div>
            
            <div className="p-3 border rounded-lg">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {team.player2FirstName} {team.player2LastName}
                </span>
                <Badge 
                  variant={team.player2PaymentStatus === 'paid' ? 'default' : 'secondary'}
                  className={team.player2PaymentStatus === 'paid' ? 'bg-green-500' : ''}
                >
                  {team.player2PaymentStatus === 'paid' ? 'Paid' : 'Pending'}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            onClick={onMarkPaid}
            className="flex-1 flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Mark as Paid
          </Button>
          <Button
            onClick={onPayLater}
            variant="outline"
            className="flex-1"
          >
            Pay Later
          </Button>
          <Button
            onClick={onBack}
            variant="ghost"
            size="icon"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default TeamPaymentFlow;