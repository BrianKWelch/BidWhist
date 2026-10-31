import React, { useMemo, useRef, useState } from 'react';
import type { Game, Team, Tournament, TournamentSchedule } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { History } from 'lucide-react';
import { leagueTeamNo } from '@/lib/league';
import { findOriginalSeason, planRestore, recoveryDiagnostics, recoveryTarget, type RestorePlan, type SearchHit, type SearchProgress } from '@/lib/leagueRecover';

const BRAND = '#213A5B';
const MAX_SEARCH_MS = 60_000;

const fmtWhen = (ms: number) => new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const makeWorker = () => new Worker(new URL('../lib/leagueRecover.worker.ts', import.meta.url), { type: 'module' });

interface Props {
  league: Tournament;
  schedule: TournamentSchedule | null;
  games: Game[];
  teams: Team[];
  plannedWeeks: number;
  onRestored: () => Promise<void>;
}

/**
 * Shown only when a later generation has overwritten weeks of an earlier one.
 * Replays the original generation from its timestamp seed, proves it by
 * reproducing the surviving weeks, then puts the lost weeks back as issued.
 */
export const LeagueRestoreCard: React.FC<Props> = ({ league, schedule, games, teams, plannedWeeks, onRestored }) => {
  const target = useMemo(() => recoveryTarget(schedule, plannedWeeks), [schedule, plannedWeeks]);
  const [phase, setPhase] = useState<'idle' | 'searching' | 'found' | 'none' | 'restoring'>('idle');
  const [progress, setProgress] = useState<SearchProgress | null>(null);
  const [diag, setDiag] = useState('');
  const [hit, setHit] = useState<SearchHit | null>(null);
  const [plan, setPlan] = useState<RestorePlan | null>(null);
  const [confirm, setConfirm] = useState(false);
  const cancel = useRef({ cancelled: false });
  const dismissKey = target ? `leagueRestoreDismissed:${league.id}:${target.laterTags.join(',')}:${target.lostWeeks.join(',')}` : '';
  const [dismissed, setDismissed] = useState(() => { try { return !!dismissKey && localStorage.getItem(dismissKey) === '1'; } catch { return false; } });

  // After a restore, weeks the original generation never covered are not "lost"; they are added with Generate Weeks.
  const originalEnd = (() => { try { return target ? Number(localStorage.getItem(`leagueRestoreOriginalEnd:${league.id}:${target.tag}`) || 0) : 0; } catch { return 0; } })();
  if (!target || !schedule || dismissed || (originalEnd > 0 && target.lostWeeks.every(w => w > originalEnd))) return null;
  const dismiss = () => { try { localStorage.setItem(dismissKey, '1'); } catch { /* ignore */ } setDismissed(true); };
  const no = (id: string) => leagueTeamNo(teams, id);
  const teamIdsInOriginal = [...new Set(target.verified.flatMap(v => [...v.sideA, ...v.sideB]))];
  const unregistered = teamIdsInOriginal.filter(id => !teams.find(t => String(t.id) === id)?.registeredTournaments?.includes(league.id));
  const diagnostics = () => recoveryDiagnostics(target, plannedWeeks, teamIdsInOriginal.map(id => {
    const t = teams.find(tt => String(tt.id) === id);
    return { id, no: no(id), name: t?.name ?? '', registered: !unregistered.includes(id) };
  }));

  const search = async () => {
    cancel.current = { cancelled: false };
    setPhase('searching'); setHit(null); setPlan(null); setConfirm(false);
    const span = target.endWeek - target.startWeek + 1;
    // The season may have been planned shorter or longer when it was first generated; every candidate is tried at each step.
    const weeksCandidates = [...new Set([span - 1, span, span + 1, span - 2, span + 2].filter(n => n >= 1))];
    const found = await findOriginalSeason(
      { n: teamIdsInOriginal.length, weeksCandidates, startWeek: target.startWeek, tagMs: target.tagMs, verified: target.verified },
      { maxMs: MAX_SEARCH_MS, onProgress: setProgress, signal: cancel.current, workerFactory: makeWorker },
    );
    if (cancel.current.cancelled) { setPhase('idle'); return; }
    if (!found) { setPhase('none'); return; }
    setHit(found);
    try { localStorage.setItem(`leagueRestoreOriginalEnd:${league.id}:${target.tag}`, String(Math.max(...found.season.weeks.map(w => w.week)))); } catch { /* ignore */ }
    setPlan(planRestore(league.id, schedule, games, target, found.season));
    setPhase('found');
  };

  const apply = async () => {
    if (!plan || !hit) return;
    if (!confirm) { setConfirm(true); return; }
    setPhase('restoring');
    try {
      const { supabase } = await import('../supabaseClient');
      const rows = plan.insert.map(m => ({ id: m.id, team_a: m.teamA, team_b: m.teamB, round: m.round, tournament_id: league.id, table_number: m.table ?? 0, is_bye: false, is_same_city: false }));
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabase.from('matches').insert(rows.slice(i, i + 200));
        if (error) throw new Error(`Insert matches: ${error.message}`);
      }
      for (const r of plan.reattach) {
        const { error } = await supabase.from('games').update({ matchId: r.matchId }).eq('id', r.gameId);
        if (error) throw new Error(`Move score ${r.gameId}: ${error.message}`);
      }
      for (let i = 0; i < plan.deleteIds.length; i += 200) {
        const { error } = await supabase.from('matches').delete().in('id', plan.deleteIds.slice(i, i + 200));
        if (error) throw new Error(`Delete matches: ${error.message}`);
      }
      for (const id of unregistered) {
        const { data: reg } = await supabase.from('team_registrations').select('team_id').eq('team_id', id).eq('tournament_id', league.id);
        if (!reg || reg.length === 0) {
          const { error } = await supabase.from('team_registrations').insert([{ team_id: id, tournament_id: league.id }]);
          if (error) throw new Error(`Register team ${no(id)}: ${error.message}`);
        }
      }
      await onRestored();
      toast({
        title: `Weeks ${plan.weeks.join(', ')} restored`,
        description: `${plan.insert.length} original games back in place` +
          (plan.reattach.length ? `; ${plan.reattach.length} score(s) moved onto their original game` : '') +
          (plan.unmatched.length ? `; ${plan.unmatched.length} score(s) kept under a game that is not in the original schedule (see Data check)` : '') +
          (unregistered.length ? `; re-registered team(s) ${unregistered.map(no).join(', ')}` : '') + '.',
      });
      setPhase('idle'); setHit(null); setPlan(null); setConfirm(false);
    } catch (e) {
      toast({ title: 'Restore failed', description: String(e), variant: 'destructive' });
      setPhase('found');
    }
  };

  const pct = progress ? Math.min(100, Math.round((progress.checkedMs / progress.maxMs) * 100)) : 0;
  return (
    <Card className="border-amber-300 bg-amber-50/40" data-testid="league-restore">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4 text-amber-700" /> Restore original schedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-gray-800">
        <p>
          Weeks <strong>{target.lostWeeks.join(', ')}</strong> {target.laterTags.length > 0 ? <>were rebuilt by a regenerate on {fmtWhen(parseInt(target.laterTags[0], 36))} and no longer match</> : <>are missing from</>} the
          schedule issued on {fmtWhen(target.tagMs)}. Weeks {target.verified.map(v => v.week).join(', ')} are still the originals.
        </p>
        <p className="text-gray-600">
          The original schedule can be brought back exactly. The season generator is replayed from the moment it first ran until it reproduces
          weeks {target.verified.map(v => v.week).join(', ')} game for game; the same run then gives weeks {target.lostWeeks.join(', ')} precisely as players first saw them.
          Scores already entered for those weeks are moved onto the matching original game.
          {unregistered.length > 0 && <> Team(s) {unregistered.map(no).join(', ')} are in the original schedule but not registered any more; restoring re-registers them.</>}
        </p>
        {phase === 'idle' && (
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={search} className="text-white" style={{ backgroundColor: BRAND }}>Find original schedule</Button>
            <Button variant="outline" onClick={dismiss}>Dismiss (the current schedule is intended)</Button>
            <Button variant="ghost" size="sm" onClick={() => setDiag(diagnostics())}>Copy diagnostics</Button>
          </div>
        )}
        {diag && (
          <div className="space-y-1">
            <div className="text-xs text-gray-600">Diagnostics (select all and copy, or use the button):</div>
            <textarea readOnly className="w-full h-24 text-[10px] font-mono border rounded p-1" value={diag} onFocus={e => e.currentTarget.select()} data-testid="restore-diag" />
            <Button variant="outline" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(diag); toast({ title: 'Diagnostics copied' }); } catch { toast({ title: 'Select the text and copy it by hand', variant: 'destructive' }); } }}>Copy to clipboard</Button>
          </div>
        )}
        {phase === 'searching' && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-gray-200 rounded overflow-hidden"><div className="h-full bg-amber-500" style={{ width: `${pct}%` }} /></div>
              <span className="text-xs text-gray-600 tabular-nums">{progress ? `${(progress.checkedMs / 1000).toFixed(1)} s / ${(progress.maxMs / 1000).toFixed(0)} s` : 'starting…'}</span>
            </div>
            <div className="text-xs text-gray-600">
              Searching on {progress?.workers ?? '…'} CPU core(s), trying every plausible season length at each step. A hit normally comes within the first few seconds of the bar; the full bar is the long way of saying no. Keep this tab open.
            </div>
            <Button variant="outline" size="sm" onClick={() => { cancel.current.cancelled = true; }}>Cancel</Button>
          </div>
        )}
        {phase === 'none' && (
          <div className="space-y-2">
            <div className="text-red-700">No replay reproduced weeks {target.verified.map(v => v.week).join(', ')}.</div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={search}>Try again</Button>
              <Button variant="outline" size="sm" onClick={() => setDiag(diagnostics())}>Show diagnostics to send for help</Button>
            </div>
          </div>
        )}
        {phase === 'found' && hit && plan && plan.weeks.length === 0 && (
          <div className="space-y-2">
            <div className="text-orange-800">The original generation reproduced weeks {target.verified.map(v => v.week).join(', ')} but never covered week(s) {target.lostWeeks.join(', ')}, so there is nothing to put back. Use "Total weeks" to add them.</div>
            <Button variant="outline" size="sm" onClick={dismiss}>Dismiss</Button>
          </div>
        )}
        {(phase === 'found' || phase === 'restoring') && hit && plan && plan.weeks.length > 0 && (
          <div className="space-y-3">
            <div className="text-green-800 font-medium">Found. Weeks {target.verified.map(v => v.week).join(', ')} reproduced exactly from a {hit.weeks}-week generation; the original weeks {plan.weeks.join(', ')} are ready.</div>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse">
                <thead><tr className="bg-gray-100"><th className="px-2 py-1 text-left">Week</th><th className="px-2 py-1 text-left">Side A</th><th className="px-2 py-1 text-left">Side B</th></tr></thead>
                <tbody>
                  {hit.season.weeks.filter(w => plan.weeks.includes(w.week)).map(w => (
                    <tr key={w.week} className="border-t">
                      <td className="px-2 py-1 font-medium">{w.week}</td>
                      <td className="px-2 py-1">{w.sideA.map(no).sort((x, y) => Number(x) - Number(y)).join(', ')}</td>
                      <td className="px-2 py-1">{w.sideB.map(no).sort((x, y) => Number(x) - Number(y)).join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="text-xs text-gray-700 list-disc pl-5 space-y-0.5">
              <li>{plan.insert.length} original games go back; {plan.deleteIds.length} games from the regenerate are removed.</li>
              {target.lostWeeks.some(w => !plan.weeks.includes(w)) && <li className="text-orange-700">Week(s) {target.lostWeeks.filter(w => !plan.weeks.includes(w)).join(', ')} were never part of the original generation (it ran weeks {hit.season.weeks[0].week} to {hit.season.weeks[hit.season.weeks.length - 1].week}). Add them afterwards with "Generate Weeks" below; existing weeks are not touched by that.</li>}
              <li>{plan.reattach.length} score(s) entered since are moved onto their original game.</li>
              {plan.unmatched.length > 0 && <li className="text-orange-700">{plan.unmatched.length} score(s) are between teams that were not in the same room that week in the original schedule. They are kept as they are and listed in Data check: {plan.unmatched.map(u => `Week ${u.week} ${no(u.teamA)} v ${no(u.teamB)}`).join('; ')}.</li>}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={apply} disabled={phase === 'restoring'} className="text-white" style={{ backgroundColor: confirm ? '#b91c1c' : BRAND }}>
                {phase === 'restoring' ? 'Restoring…' : confirm ? `Yes, restore weeks ${plan.weeks.join(', ')} now` : `Restore weeks ${plan.weeks.join(', ')}`}
              </Button>
              {confirm && phase !== 'restoring' && <Button variant="outline" onClick={() => setConfirm(false)}>Cancel</Button>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LeagueRestoreCard;
