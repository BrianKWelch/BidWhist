import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { CheckSquare, Square, Send, MessageSquare } from 'lucide-react';

interface PhoneEntry {
  phone: string;
  name: string;
  teamName: string;
}

interface SendResult {
  to: string;
  name: string;
  status: 'sent' | 'failed';
  error?: string;
}

function toE164(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return `+${d}`;
}

export const SmsBlast: React.FC = () => {
  const { teams, tournaments, getActiveTournament } = useAppContext();

  const [functionUrl, setFunctionUrl] = useState(() => localStorage.getItem('sms_fn_url') || '');
  const [tournamentId, setTournamentId] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<SendResult[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const active = getActiveTournament();
    if (active) setTournamentId(active.id);
  }, [getActiveTournament]);

  useEffect(() => {
    localStorage.setItem('sms_fn_url', functionUrl);
  }, [functionUrl]);

  const phoneEntries = useMemo((): PhoneEntry[] => {
    const filtered = tournamentId
      ? teams.filter(t => t.registeredTournaments?.includes(tournamentId))
      : teams;
    const seen = new Set<string>();
    const entries: PhoneEntry[] = [];
    filtered.forEach(team => {
      const players = [
        { phone: team.player1_phone, name: `${team.player1FirstName || ''} ${team.player1LastName || ''}`.trim() },
        { phone: team.player2_phone, name: `${team.player2FirstName || ''} ${team.player2LastName || ''}`.trim() },
      ];
      players.forEach(({ phone, name }) => {
        if (!phone) return;
        const digits = phone.replace(/\D/g, '');
        if (digits.length < 10) return;
        if (seen.has(digits)) return;
        seen.add(digits);
        entries.push({ phone: digits, name: name || digits, teamName: team.name });
      });
    });
    return entries.sort((a, b) => a.name.localeCompare(b.name));
  }, [teams, tournamentId]);

  useEffect(() => {
    setSelected(new Set(phoneEntries.map(e => e.phone)));
  }, [phoneEntries]);

  const selectAll = () => setSelected(new Set(phoneEntries.map(e => e.phone)));
  const selectNone = () => setSelected(new Set());
  const toggleOne = (phone: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone); else next.add(phone);
      return next;
    });
  };

  const charCount = message.length;
  const segments = charCount > 0 ? Math.ceil(charCount / 160) : 1;
  const canSend = !!functionUrl && message.trim().length > 0 && selected.size > 0 && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    const preview = message.length > 60 ? message.slice(0, 60) + '...' : message;
    const ok = window.confirm(`Send to ${selected.size} numbers?\n\n"${preview}"`);
    if (!ok) return;

    setSending(true);
    setResults([]);
    const phones = [...selected].map(toE164);
    const phoneToEntry = new Map(phoneEntries.map(e => [toE164(e.phone), e]));

    try {
      const res = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ numbers: JSON.stringify(phones), message: message.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const mapped: SendResult[] = (data.results || []).map((r: any) => ({
        to: r.to,
        name: phoneToEntry.get(r.to)?.name || r.to,
        status: r.status,
        error: r.error,
      }));
      setResults(mapped);
      const sentCount = mapped.filter(r => r.status === 'sent').length;
      toast({ title: `Sent ${sentCount} of ${phones.length} messages` });
    } catch (err: any) {
      toast({ title: 'Send failed', description: err.message, variant: 'destructive' });
    }
    setSending(false);
  };

  const formatPhone = (digits: string) =>
    digits.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-xl mx-auto space-y-4">

        <div className="flex items-center gap-2 pt-2">
          <MessageSquare className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold">SMS Blast</h1>
        </div>

        {/* Twilio Function URL */}
        <div className="bg-white rounded-lg p-4 border space-y-2">
          <Label htmlFor="fn-url">Twilio Function URL</Label>
          <Input
            id="fn-url"
            placeholder="https://your-service-XXXX.twil.io/send-sms"
            value={functionUrl}
            onChange={e => setFunctionUrl(e.target.value)}
            className="font-mono text-sm"
          />
          {!functionUrl && (
            <p className="text-xs text-amber-600">Paste your Twilio Function URL to enable sending.</p>
          )}
        </div>

        {/* Tournament filter */}
        <div className="bg-white rounded-lg p-4 border space-y-2">
          <Label>Tournament</Label>
          <Select value={tournamentId} onValueChange={setTournamentId}>
            <SelectTrigger>
              <SelectValue placeholder="All tournaments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All tournaments</SelectItem>
              {tournaments.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Message */}
        <div className="bg-white rounded-lg p-4 border space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="msg">Message</Label>
            <span className={`text-xs ${charCount > 160 ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
              {charCount}/160{segments > 1 ? ` · ${segments} segments` : ''}
            </span>
          </div>
          <Textarea
            id="msg"
            placeholder="Type your message here..."
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={3}
          />
        </div>

        {/* Recipients */}
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
            <span className="text-sm font-medium text-gray-700">
              {selected.size} of {phoneEntries.length} selected
            </span>
            <div className="flex gap-3">
              <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">Select all</button>
              <span className="text-gray-300">|</span>
              <button onClick={selectNone} className="text-xs text-blue-600 hover:underline">None</button>
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y">
            {phoneEntries.length === 0 ? (
              <p className="text-sm text-gray-400 p-4 text-center">
                No players with phone numbers in this tournament.
              </p>
            ) : (
              phoneEntries.map(entry => (
                <div
                  key={entry.phone}
                  onClick={() => toggleOne(entry.phone)}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 select-none"
                >
                  {selected.has(entry.phone)
                    ? <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                    : <Square className="w-4 h-4 text-gray-300 shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{entry.name}</p>
                    <p className="text-xs text-gray-400">{formatPhone(entry.phone)}</p>
                  </div>
                  <span className="text-xs text-gray-400 truncate max-w-[90px]">{entry.teamName}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Send */}
        <Button
          onClick={handleSend}
          disabled={!canSend}
          className="w-full"
          size="lg"
          style={canSend ? { backgroundColor: '#1d4ed8', color: 'white' } : {}}
        >
          <Send className="w-4 h-4 mr-2" />
          {sending
            ? 'Sending...'
            : `Send to ${selected.size} Number${selected.size !== 1 ? 's' : ''}`}
        </Button>

        {/* Results */}
        {results.length > 0 && (
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="px-4 py-2 border-b bg-gray-50">
              <span className="text-sm font-medium">Results</span>
              <span className="text-xs text-gray-400 ml-2">
                {results.filter(r => r.status === 'sent').length} sent ·{' '}
                {results.filter(r => r.status === 'failed').length} failed
              </span>
            </div>
            <div className="divide-y max-h-64 overflow-y-auto">
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={r.status === 'sent' ? 'text-green-600' : 'text-red-500'}>
                    {r.status === 'sent' ? '✓' : '✗'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{r.name}</p>
                    {r.error && <p className="text-xs text-red-500 truncate">{r.error}</p>}
                  </div>
                  <Badge
                    variant={r.status === 'sent' ? 'default' : 'destructive'}
                    className="text-xs shrink-0"
                  >
                    {r.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
