/// <reference lib="webworker" />
import { scanSlice } from '@/lib/leagueRecover';

self.onmessage = (ev: MessageEvent) => {
  const msg = ev.data;
  if (msg?.type !== 'scan') return;
  scanSlice(msg.params, msg.first, msg.step, msg.maxMs, m => (self as unknown as Worker).postMessage(m));
};
