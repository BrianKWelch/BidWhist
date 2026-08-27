/* Quick Draw Trivia self-test.
 *
 * Serves public/ over loopback, drives two real browser contexts through the
 * full QR pairing handshake (using the app's paste fallback, so no camera is
 * needed) and plays a complete ten-question game, asserting that both phones
 * agree on every score.
 *
 * Not wired into npm scripts — Playwright is not a dependency of this project.
 * To run it:
 *
 *     npm i --no-save playwright && npx playwright install chromium
 *     node tools/trivia-selftest.cjs
 *
 * If Chromium is already on disk, point at it instead of installing:
 *
 *     CHROMIUM_PATH=/path/to/chrome node tools/trivia-selftest.cjs
 *
 * WebRtcHideLocalIpsWithMdns is disabled below because mDNS .local candidates
 * cannot resolve inside a container. On a real phone the camera permission the
 * app requests achieves the same thing.
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'public');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404); return res.end('nope');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream',
                       'Service-Worker-Allowed': '/' });
  res.end(fs.readFileSync(f));
});


// The paste fallback sits inside a collapsed <details>; open it before filling.
async function pasteCode(page, code) {
  await page.evaluate(() => {
    document.querySelectorAll('#s-scan details').forEach(d => { d.open = true; });
  });
  await page.fill('#pastecode', code);
  await page.click('#b-paste');
}

const log = [];
function ok(name, cond, extra) {
  log.push((cond ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  — ' + extra : ''));
  if (!cond) process.exitCode = 1;
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/trivia/`;

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: [
      // Force real loopback/LAN candidates instead of mDNS names, which cannot
      // resolve inside this container. On a phone the camera permission the app
      // requests achieves the same thing.
      '--disable-features=WebRtcHideLocalIpsWithMdns',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
    ],
  });

  const ctxA = await browser.newContext({ permissions: ['camera'] });
  const ctxB = await browser.newContext({ permissions: ['camera'] });
  const A = await ctxA.newPage();
  const B = await ctxB.newPage();
  const errs = [];
  [['A', A], ['B', B]].forEach(([n, p]) => {
    p.on('pageerror', e => errs.push(n + ': ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push(n + ' console: ' + m.text()); });
  });

  await A.goto(url); await B.goto(url);

  // --- deterministic round building must agree across the two engines ---
  const seed = 123456789;
  const rA = await A.evaluate(s => window.__qd.buildRound(s), seed);
  const rB = await B.evaluate(s => window.__qd.buildRound(s), seed);
  ok('same seed builds identical round on both phones', JSON.stringify(rA) === JSON.stringify(rB));
  ok('round is 10 questions', rA.length === 10, 'got ' + rA.length);
  ok('option shuffle actually moves the answer off index 0',
     rA.some(q => q.correct !== 0), 'corrects: ' + rA.map(q => q.correct).join(''));
  ok('each question keeps 4 distinct options',
     rA.every(q => new Set(q.opts).size === 4));
  ok('no duplicate questions in a round',
     new Set(rA.map(q => q.prompt)).size === 10);

  // --- category filtering ---
  const cats = await A.evaluate(() => window.__qd.CATS);
  ok('nine categories on the wheel', cats.length === 9, cats.join(', '));

  const catRounds = await A.evaluate(cs => cs.map(c => ({
    cat: c,
    qs: window.__qd.buildRound(99, c).map(q => q.cat),
  })), cats);
  ok('every category yields a full round drawn only from that category',
     catRounds.every(r => r.qs.length === 10 && r.qs.every(c => c === r.cat)),
     catRounds.filter(r => r.qs.some(c => c !== r.cat)).map(r => r.cat).join(',') || 'all clean');

  const catBoth = await Promise.all([A, B].map(pg =>
    pg.evaluate(() => JSON.stringify(window.__qd.buildRound(2024, 'Sports').map(q => q.prompt)))));
  ok('a category round is identical on both phones', catBoth[0] === catBoth[1]);

  const mixed = await A.evaluate(() => {
    const M = window.__qd.MIXED;
    return new Set(window.__qd.buildRound(7, M).map(q => q.cat)).size;
  });
  ok('mixed bag draws across categories', mixed > 1, mixed + ' categories in one mixed round');

  const bogus = await A.evaluate(() => window.__qd.buildRound(5, 'NotARealCategory').length);
  ok('an unknown category still produces a full round', bogus === 10, String(bogus));

  // --- scoring curve ---
  const pts = await A.evaluate(() => ({
    instant: window.__qd.points(2, 0, 2),
    half:    window.__qd.points(2, 7500, 2),
    late:    window.__qd.points(2, 14900, 2),
    wrong:   window.__qd.points(1, 100, 2),
    timeout: window.__qd.points(-1, 15000, 2),
  }));
  ok('instant correct answer scores 1000', pts.instant === 1000, JSON.stringify(pts));
  ok('halfway answer scores about half', pts.half === 500, String(pts.half));
  ok('a correct answer never scores below 100', pts.late === 100, String(pts.late));
  ok('wrong answer scores 0', pts.wrong === 0);
  ok('timeout scores 0', pts.timeout === 0);

  // --- SDP codec round-trips ---
  const codecOK = await A.evaluate(() => {
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel('x');
    return pc.createOffer().then(o => {
      const packed = window.__qd.packSdp(o.sdp);
      const back = window.__qd.unpackSdp(packed, 'offer');
      const g = (s, re) => (s.match(re) || [])[1];
      const same = g(o.sdp, /a=ice-ufrag:(\S+)/) === g(back.sdp, /a=ice-ufrag:(\S+)/)
        && g(o.sdp, /a=ice-pwd:(\S+)/) === g(back.sdp, /a=ice-pwd:(\S+)/)
        && g(o.sdp, /a=fingerprint:sha-256 (\S+)/i).toUpperCase() === g(back.sdp, /a=fingerprint:sha-256 (\S+)/i).toUpperCase();
      pc.close();
      return { same, len: packed.length };
    });
  });
  ok('packed SDP round-trips ICE creds and fingerprint intact', codecOK.same);
  ok('packed payload stays QR-friendly (<400 chars)', codecOK.len < 400, codecOK.len + ' chars');

  // --- pairing handshake ---
  await A.fill('#myname', 'Ana');
  await A.click('#b-friend');
  await A.click('#b-host');
  await A.waitForFunction(() => document.getElementById('mycode').value.startsWith('QD1|'), null, { timeout: 20000 });
  const offer = await A.inputValue('#mycode');
  ok('host produced an offer code', offer.startsWith('QD1|'), offer.length + ' chars');
  ok('offer code carries at least one ICE candidate',
     (offer.split('|')[5] || '').length > 0, 'candidates: ' + (offer.split('|')[5] || '(none)'));

  await B.fill('#myname', 'Bo');
  await B.click('#b-friend');
  await B.click('#b-join');
  await B.waitForSelector('#s-scan.on', { timeout: 10000 });
  await pasteCode(B, offer);
  await B.waitForFunction(() => document.getElementById('mycode').value.startsWith('QD1|'), null, { timeout: 20000 });
  const answer = await B.inputValue('#mycode');
  ok('joiner produced an answer code', answer.startsWith('QD1|'), answer.length + ' chars');

  await A.click('#b-show-next');
  await A.waitForSelector('#s-scan.on', { timeout: 10000 });
  await pasteCode(A, answer);

  await A.waitForSelector('#s-lobby.on', { timeout: 30000 });
  await B.waitForSelector('#s-lobby.on', { timeout: 30000 });
  ok('data channel opened — both phones reached the lobby', true);

  const stateA = await A.evaluate(() => window.__qd.P.pc.connectionState);
  ok('peer connection is connected', stateA === 'connected', stateA);
  ok('host sees the joiner name', (await A.textContent('#lob-them')).trim() === 'Bo');
  ok('joiner sees the host name', (await B.textContent('#lob-them')).trim() === 'Ana');
  ok('only the host gets the start button',
     !(await A.locator('#b-start').isHidden()) && (await B.locator('#b-start').isHidden()));

  // --- host picks a category; both phones must land on the same one ---
  await A.click('#b-start');
  await A.waitForSelector('#s-pick.on', { timeout: 10000 });
  const tiles = await A.locator('#cats .cat').count();
  ok('picker offers surprise + mixed + every category', tiles === cats.length + 2, tiles + ' tiles');
  await B.waitForFunction(() => /picking a category/.test(document.getElementById('lob-sub').textContent),
    null, { timeout: 6000 });
  ok('joiner is told the host is choosing', true, await B.textContent('#lob-sub'));

  // "Surprise me" is the first tile — it must spin the wheel on BOTH phones.
  await A.locator('#cats .cat').first().click();
  await A.waitForSelector('#s-wheel.on', { timeout: 8000 });
  await B.waitForSelector('#s-wheel.on', { timeout: 8000 });
  ok('random pick shows the wheel on both phones', true);

  // Compare the declared target, not getComputedStyle(): the latter reports the
  // interpolated matrix mid-spin, which two phones milliseconds apart never match.
  const rot = await Promise.all([A, B].map(pg => pg.evaluate(() =>
    document.getElementById('wheel').style.transform)));
  ok('both wheels spin to the identical target angle',
     rot[0] === rot[1] && /rotate\(-?\d/.test(rot[0]) && rot[0] !== 'rotate(0deg)', rot[0]);
  ok('wheel is visible for a random pick',
     !(await A.locator('#wheelbox').isHidden()));

  await A.waitForSelector('#s-play.on', { timeout: 20000 });
  await B.waitForSelector('#s-play.on', { timeout: 20000 });

  const chosen = await Promise.all([A, B].map(pg => pg.evaluate(() => window.__qd.G.cat)));
  ok('both phones agree on the spun category', chosen[0] === chosen[1], chosen.join(' / '));
  ok('the spun category is a real wheel segment', cats.includes(chosen[0]), chosen[0]);

  const allSame = await A.evaluate(() =>
    window.__qd.G.qs.every(q => q.cat === window.__qd.G.cat));
  ok('every question in the round matches the spun category', allSame);

  // The picker tiles and the in-game category label are both .cat; guard
  // against the picker's styling leaking onto the label.
  const chipStyle = await A.evaluate(() => {
    const cs = getComputedStyle(document.getElementById('qcat'));
    return { bg: cs.backgroundColor, pad: cs.paddingTop, border: cs.borderTopWidth };
  });
  ok('in-game category label is not styled as a picker tile',
     chipStyle.bg === 'rgba(0, 0, 0, 0)' && chipStyle.pad === '0px' && chipStyle.border === '0px',
     JSON.stringify(chipStyle));

  const seedsMatch = await A.evaluate(() => JSON.stringify(window.__qd.G.qs.map(q => q.prompt)))
    === await B.evaluate(() => JSON.stringify(window.__qd.G.qs.map(q => q.prompt)));
  ok('both phones are playing the identical question list', seedsMatch);

  let liveSeen = false;
  for (let i = 0; i < 10; i++) {
    await A.waitForFunction(n => window.__qd.G.i === n && !window.__qd.G.myAns, i, { timeout: 20000 });
    await B.waitForFunction(n => window.__qd.G.i === n && !window.__qd.G.myAns, i, { timeout: 20000 });

    const correct = await A.evaluate(() => window.__qd.G.qs[window.__qd.G.i].correct);
    await A.locator('#opts .opt').nth(correct).click();

    // Ana has answered but Bo has not: Bo's board should already show her lock.
    if (i === 0) {
      await B.waitForFunction(() => /locked/.test(document.getElementById('lk-them').textContent), null, { timeout: 6000 });
      liveSeen = true;
      ok('opponent lock-in shows live before you answer', true,
         await B.textContent('#lk-them'));
      const leaked = await B.evaluate(() =>
        [...document.querySelectorAll('#opts .opt')].some(o => /right|wrong/.test(o.className)));
      ok('opponent lock does not leak which option they picked', !leaked);
    }

    await B.waitForTimeout(300);
    const bCorrect = await B.evaluate(() => window.__qd.G.qs[window.__qd.G.i].correct);
    // Bo gets the first six right, then misses the rest.
    const bPick = i < 6 ? bCorrect : (bCorrect + 1) % 4;
    await B.locator('#opts .opt').nth(bPick).click();

    await A.waitForFunction(() => window.__qd.G.revealed, null, { timeout: 20000 });
    await B.waitForFunction(() => window.__qd.G.revealed, null, { timeout: 20000 });

    if (i === 0) {
      const chips = await A.evaluate(() =>
        [...document.querySelectorAll('#opts .opt')].map(o =>
          [...o.querySelectorAll('.chip')].map(c => c.className.replace('chip ', '')).join('+')));
      ok('reveal shows who picked what', chips.join('|').includes('me'), chips.join(' | '));
    }
  }

  await A.waitForSelector('#s-end.on', { timeout: 25000 });
  await B.waitForSelector('#s-end.on', { timeout: 25000 });

  const scoreA = await A.evaluate(() => ({ me: window.__qd.G.me.score, them: window.__qd.G.them.score }));
  const scoreB = await B.evaluate(() => ({ me: window.__qd.G.me.score, them: window.__qd.G.them.score }));
  ok('both phones agree on the final scores',
     scoreA.me === scoreB.them && scoreA.them === scoreB.me,
     `A saw ${JSON.stringify(scoreA)}, B saw ${JSON.stringify(scoreB)}`);
  ok('Ana (all 10 right) outscores Bo (6 right)', scoreA.me > scoreA.them,
     `${scoreA.me} vs ${scoreA.them}`);
  ok('Bo scored on his six correct answers', scoreA.them > 0, String(scoreA.them));
  ok('winner line names the winner',
     (await A.textContent('#endline')).includes('You win'), await A.textContent('#endline'));
  ok('loser sees the winner named',
     (await B.textContent('#endline')).includes('Ana'), await B.textContent('#endline'));
  ok('result strip has one pip per question',
     (await A.locator('#strip .pip').count()) === 10);
  ok('live opponent feedback was exercised', liveSeen);
  ok('no page errors anywhere', errs.length === 0, errs.slice(0, 5).join(' / '));

  await browser.close();
  server.close();
  console.log('\n' + log.join('\n'));
  const failed = log.filter(l => l.startsWith('FAIL')).length;
  console.log(`\n${log.length - failed}/${log.length} checks passed`);
})().catch(e => { console.error('HARNESS ERROR:', e); process.exit(1); });
