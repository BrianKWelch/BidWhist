import React, { useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BadgeScanner from '@/components/badge/BadgeScanner';
import VisitorLogTable, { VisitorLogTableRef } from '@/components/badge/VisitorLogTable';

const BadgeVisitors: React.FC = () => {
  const logRef = useRef<VisitorLogTableRef>(null);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto max-w-4xl p-4">
        <h1 className="mb-4 text-2xl font-bold">Conference Visitor Log</h1>
        <Tabs defaultValue="scan">
          <TabsList>
            <TabsTrigger value="scan">Scan Badge</TabsTrigger>
            <TabsTrigger value="log">Visitor Log</TabsTrigger>
          </TabsList>
          <TabsContent value="scan" className="mt-4">
            <BadgeScanner onSaved={() => logRef.current?.refresh()} />
          </TabsContent>
          <TabsContent value="log" className="mt-4">
            <VisitorLogTable ref={logRef} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BadgeVisitors;
