import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { supabase } from '@/supabaseClient';
import { toast } from '@/hooks/use-toast';
import { BadgeVisitor } from '@/types/badgeVisitor';

export interface VisitorLogTableRef {
  refresh: () => void;
}

const VisitorLogTable = React.forwardRef<VisitorLogTableRef>((_props, ref) => {
  const [visitors, setVisitors] = useState<BadgeVisitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchVisitors = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('badge_visitors')
      .select('*')
      .order('created_at', { ascending: false });
    setLoading(false);

    if (error) {
      console.error(error);
      toast({
        title: 'Could not load visitor log',
        description: error.message.includes('does not exist')
          ? 'The badge_visitors table doesn’t exist yet — run docs/badge_visitors_schema.sql in Supabase first.'
          : error.message,
        variant: 'destructive',
      });
      return;
    }
    setVisitors(data || []);
  };

  useEffect(() => {
    fetchVisitors();
  }, []);

  React.useImperativeHandle(ref, () => ({ refresh: fetchVisitors }));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visitors;
    return visitors.filter((v) =>
      [v.name, v.title, v.company, v.location, v.badge_type, v.event_name, v.notes]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q))
    );
  }, [visitors, search]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from('badge_visitors').delete().eq('id', id);
    setDeletingId(null);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      return;
    }
    setVisitors((prev) => prev.filter((v) => v.id !== id));
  };

  const handleExport = () => {
    if (!filtered.length) {
      toast({ title: 'Nothing to export', description: 'The visitor log is empty.' });
      return;
    }
    const header = ['Name', 'Title', 'Company', 'Location', 'Badge Type', 'Event', 'Notes', 'Scanned At'];
    const rows = filtered.map((v) => [
      v.name || '',
      v.title || '',
      v.company || '',
      v.location || '',
      v.badge_type || '',
      v.event_name || '',
      v.notes || '',
      new Date(v.created_at).toLocaleString(),
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Visitors');
    const dateStamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `conference_visitors_${dateStamp}.xlsx`);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Visitor Log ({visitors.length})</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search visitors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
          />
          <Button variant="outline" size="sm" onClick={fetchVisitors} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export to Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Badge Type</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Scanned</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell>{v.title}</TableCell>
                  <TableCell>{v.company}</TableCell>
                  <TableCell>{v.location}</TableCell>
                  <TableCell>{v.badge_type}</TableCell>
                  <TableCell>{v.event_name}</TableCell>
                  <TableCell className="max-w-xs truncate" title={v.notes || ''}>{v.notes}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(v.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(v.id)}
                      disabled={deletingId === v.id}
                    >
                      {deletingId === v.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && !filtered.length && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No visitors scanned yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
});

VisitorLogTable.displayName = 'VisitorLogTable';

export default VisitorLogTable;
