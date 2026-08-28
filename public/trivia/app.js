/* Quick Draw Trivia — two phones on one local network, no server.

   Pairing works by exchanging a compacted WebRTC session description as a QR
   code. Normally a signalling server shuttles those blobs between peers; here
   the players' cameras are the signalling channel, which is why the game needs
   no internet — only a network path between the two handsets.

   The full SDP is ~1.5 KB, far too dense to scan reliably, so packSdp() keeps
   only the five fields that actually vary (ICE credentials, DTLS fingerprint,
   DTLS role, candidate addresses) and unpackSdp() rebuilds the rest from a
   fixed template. That lands a payload around 200 chars — a 53x53 QR. */
(function () {
'use strict';

var $ = function (id) { return document.getElementById(id); };
var ROUND_LEN = 10;

/* Two phones must build byte-identical rounds. That holds only if they run the
   same round-building logic AND the same question bank, so both are folded into
   one string that is exchanged at connect time and checked before play. Bump
   PROTO whenever round building or the message shape changes; the bank half
   updates itself. A phone serving a stale cached build previously paired fine
   and then silently played a different game — that is what this prevents. */
var PROTO = 2;

function hashStr(str, h) {
  h = h || 5381;
  for (var i = 0; i < str.length; i++) h = (h * 33 ^ str.charCodeAt(i)) >>> 0;
  return h;
}

function bankVersion() {
  var b = window.QUESTIONS, h = 5381;
  for (var i = 0; i < b.length; i++) h = hashStr(JSON.stringify(b[i]), h);
  return b.length + '-' + h.toString(36);
}

var APP_VERSION;   // assigned below, once CATS exists

/* Fingerprint of an actual built round, so a divergence is caught even if two
   builds somehow agree on APP_VERSION. */
function roundSum(qs) {
  return hashStr(qs.map(function (q) { return q.prompt + '|' + q.correct; }).join('~')).toString(36);
}
var LIMIT = 15000;      // ms allowed per question
var REVEAL_MS = 4500;   // how long the answer stays on screen
var GRACE_MS = 2500;    // extra wait for a straggling opponent message

/* ------------------------------------------------------------------ *
 *  Screens
 * ------------------------------------------------------------------ */
var SCREENS = ['home', 'how', 'role', 'show', 'scan', 'wait', 'lobby', 'pick', 'wheel', 'play', 'end'];

/* Wheel order is also the segment order, so it must stay stable: both phones
   animate the same wheel to the same landing angle from the shared seed. */
var CATS = ['Geography', 'History', 'Science', 'Music', 'Screen',
            'Sports', 'Food', 'Books', 'Odds & Ends', 'R&B Lyrics'];
var MIXED = 'Mixed';
var WHEEL_COLORS = ['#3ddc97', '#4dabf7', '#ffd43b', '#ff6b6b', '#b197fc',
                    '#63e6be', '#ffa94d', '#74c0fc', '#f783ac', '#a9e34b'];

/* CATS is folded into the version because its order decides where the wheel
   lands: two builds sharing a bank but ordering categories differently would
   spin to different segments, which the bank hash alone would not catch. */
APP_VERSION = 'p' + PROTO + '.' + bankVersion() + '.' + hashStr(CATS.join('|')).toString(36);
function go(name) {
  SCREENS.forEach(function (s) { $('s-' + s).classList.toggle('on', s === name); });
  window.scrollTo(0, 0);
}

function banner(host, msg, ok) {
  var el = $(host);
  if (!el) return;
  el.innerHTML = msg ? '<div class="banner' + (ok ? ' ok' : '') + '"></div>' : '';
  if (msg) el.firstChild.textContent = msg;
}

/* ------------------------------------------------------------------ *
 *  Deterministic round building
 *  Both phones derive the identical 10 questions, and the identical
 *  shuffle of each question's four options, from one shared seed.
 * ------------------------------------------------------------------ */
function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function shuffle(arr, r) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(r() * (i + 1));
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

function buildRound(seed, cat) {
  var bank = window.QUESTIONS, r = rng(seed);

  // Pool order derives from bank order, so both phones filter identically.
  var pool = [];
  bank.forEach(function (q, i) { if (!cat || cat === MIXED || q[3] === cat) pool.push(i); });
  // Defensive: a category thinner than a full round tops up from the whole bank.
  if (pool.length < ROUND_LEN) {
    bank.forEach(function (q, i) { if (pool.indexOf(i) < 0) pool.push(i); });
  }

  var idx = shuffle(pool, r).slice(0, ROUND_LEN);
  return idx.map(function (qi) {
    var q = bank[qi];
    var order = shuffle([0, 1, 2, 3], r);
    return {
      prompt: q[0],
      cat: q[3],
      opts: order.map(function (o) { return q[1][o]; }),
      correct: order.indexOf(q[2])
    };
  });
}

function points(choice, ms, correct) {
  if (choice !== correct) return 0;
  return Math.max(100, Math.round(1000 * (1 - Math.min(ms, LIMIT) / LIMIT)));
}

/* ------------------------------------------------------------------ *
 *  Compact SDP codec
 * ------------------------------------------------------------------ */
var SETUP_OUT = { actpass: 'A', active: 'a', passive: 'p' };
var SETUP_IN = { A: 'actpass', a: 'active', p: 'passive' };

function b64(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function unb64(str) {
  var s = atob(str), out = new Uint8Array(s.length);
  for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function packSdp(sdp) {
  function one(re) { var m = sdp.match(re); return m ? m[1] : ''; }
  var ufrag = one(/a=ice-ufrag:(\S+)/);
  var pwd = one(/a=ice-pwd:(\S+)/);
  var fpHex = one(/a=fingerprint:sha-256 (\S+)/i).replace(/:/g, '');
  var setup = SETUP_OUT[one(/a=setup:(\S+)/)] || 'A';

  var fpBytes = new Uint8Array(32);
  for (var i = 0; i < 32; i++) fpBytes[i] = parseInt(fpHex.substr(i * 2, 2), 16) || 0;

  // Only host/srflx IPv4 (or mDNS .local) candidates survive; IPv6 addresses are
  // long enough to push the QR two versions denser for a case a hotspot or LAN
  // will essentially never need.
  var seen = {}, cands = [];
  var re = /a=candidate:\S+ (\d+) (udp|tcp) \d+ (\S+) (\d+) typ (\S+)([^\r\n]*)/gi, m;
  while ((m = re.exec(sdp))) {
    var comp = m[1], proto = m[2].toLowerCase(), ip = m[3], port = m[4], typ = m[5], rest = m[6];
    if (comp !== '1') continue;
    if (typ !== 'host' && typ !== 'srflx') continue;
    if (proto === 'tcp' && !/tcptype passive/.test(rest)) continue;
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip) && !/\.local$/i.test(ip)) continue;
    var key = ip + ':' + port + proto;
    if (seen[key]) continue;
    seen[key] = 1;
    cands.push({ ip: ip, port: port, p: proto === 'tcp' ? 't' : 'u' });
  }
  // Routable literals beat mDNS names: the peer can use them without a
  // multicast lookup, which some networks drop.
  cands.sort(function (a, b) { return (/\.local$/i.test(a.ip) ? 1 : 0) - (/\.local$/i.test(b.ip) ? 1 : 0); });
  cands = cands.slice(0, 6);

  return ['QD1', ufrag, pwd, b64(fpBytes), setup,
    cands.map(function (c) { return c.ip + ',' + c.port + ',' + c.p; }).join(';')].join('|');
}

function unpackSdp(code, type) {
  var parts = String(code).trim().split('|');
  if (parts[0] !== 'QD1' || parts.length < 6) throw new Error('That does not look like a Quick Draw code.');
  var ufrag = parts[1], pwd = parts[2], fp = parts[3], setup = SETUP_IN[parts[4]] || 'actpass';

  var bytes = unb64(fp), hex = [];
  for (var i = 0; i < bytes.length; i++) hex.push(('0' + bytes[i].toString(16)).slice(-2).toUpperCase());

  var lines = [
    'v=0', 'o=- 4611731400430051336 2 IN IP4 127.0.0.1', 's=-', 't=0 0',
    'a=group:BUNDLE 0', 'a=msid-semantic: WMS',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
    'c=IN IP4 0.0.0.0',
    'a=ice-ufrag:' + ufrag,
    'a=ice-pwd:' + pwd,
    'a=fingerprint:sha-256 ' + hex.join(':'),
    'a=setup:' + setup,
    'a=mid:0',
    'a=sctp-port:5000',
    'a=max-message-size:262144'
  ];
  (parts[5] ? parts[5].split(';') : []).forEach(function (c, n) {
    var f = c.split(',');
    if (f.length < 3) return;
    if (f[2] === 't') {
      lines.push('a=candidate:' + (n + 1) + ' 1 tcp ' + (1518280447 - n) + ' ' + f[0] + ' ' + f[1] + ' typ host tcptype passive');
    } else {
      lines.push('a=candidate:' + (n + 1) + ' 1 udp ' + (2130706431 - n) + ' ' + f[0] + ' ' + f[1] + ' typ host');
    }
  });
  lines.push('a=end-of-candidates');
  return { type: type, sdp: lines.join('\r\n') + '\r\n' };
}

/* ------------------------------------------------------------------ *
 *  Peer connection
 * ------------------------------------------------------------------ */
var P = { pc: null, dc: null, role: null, stream: null, watchdog: 0,
          theirVersion: null, mismatch: false };

function gatherDone(pc) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise(function (res) {
    var settled = false;
    function fin() { if (!settled) { settled = true; res(); } }
    var t = setTimeout(fin, 3500);
    pc.addEventListener('icegatheringstatechange', function () {
      if (pc.iceGatheringState === 'complete') { clearTimeout(t); fin(); }
    });
  });
}

/* Asking for the camera up front does double duty: the scanner needs it a few
   seconds later anyway, and once a page holds a media permission Chrome stops
   masking host candidates behind mDNS names, which makes the direct connection
   markedly more likely to come up. */
function primeCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.resolve();
  return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(function (s) { s.getTracks().forEach(function (t) { t.stop(); }); })
    .catch(function () { });
}

function newPeer() {
  var pc = new RTCPeerConnection({ iceServers: [] });
  pc.onconnectionstatechange = function () {
    if (pc !== P.pc) return;
    if (pc.connectionState === 'failed') pairFailed();
  };
  return pc;
}

function wireChannel(dc) {
  P.dc = dc;
  dc.onopen = function () {
    clearTimeout(P.watchdog);
    send({ t: 'hi', name: G.me.name, v: APP_VERSION });
    onConnected();
  };
  dc.onmessage = function (e) {
    var msg; try { msg = JSON.parse(e.data); } catch (err) { return; }
    handleMsg(msg);
  };
  dc.onclose = function () { onDrop(); };
}

function send(obj) {
  if (P.dc && P.dc.readyState === 'open') {
    try { P.dc.send(JSON.stringify(obj)); } catch (e) { }
  }
}

function armWatchdog() {
  clearTimeout(P.watchdog);
  P.watchdog = setTimeout(pairFailed, 30000);
}

function pairFailed() {
  if (P.dc && P.dc.readyState === 'open') return;
  go('wait');
  $('wait-title').textContent = 'Could not connect';
  $('wait-sub').textContent = '';
  banner('wait-err',
    'The phones could not reach each other. Check that both are on the same Wi-Fi network, ' +
    'and note that many public and airline networks block phone-to-phone traffic.');
}

function teardown() {
  clearTimeout(P.watchdog);
  clearTimers();
  stopScan();
  if (P.dc) { try { P.dc.onclose = null; P.dc.close(); } catch (e) { } }
  if (P.pc) { try { P.pc.onconnectionstatechange = null; P.pc.close(); } catch (e) { } }
  P.pc = P.dc = null; P.role = null;
  P.theirVersion = null; P.mismatch = false;
}

/* ------------------------------------------------------------------ *
 *  QR display and scanning
 * ------------------------------------------------------------------ */
function drawQR(text) {
  var q = window.qrcode(0, 'L');
  q.addData(text);
  q.make();
  var n = q.getModuleCount(), quiet = 4, total = n + quiet * 2;
  var cv = $('qr'), scale = Math.max(2, Math.floor(760 / total));
  cv.width = cv.height = total * scale;
  var g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = '#000';
  for (var r = 0; r < n; r++) {
    for (var c = 0; c < n; c++) {
      if (q.isDark(r, c)) g.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
    }
  }
}

var scanRAF = 0, scanCB = null, scanCanvas = null;

function startScan(onCode) {
  scanCB = onCode;
  banner('scan-err', '');
  var video = $('cam');
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } } })
    .then(function (stream) {
      P.stream = stream;
      video.srcObject = stream;
      return video.play();
    })
    .then(function () {
      if (!scanCanvas) scanCanvas = document.createElement('canvas');
      tick();
    })
    .catch(function () {
      banner('scan-err', 'No camera access. Open the section below and paste their code instead.');
    });

  function tick() {
    scanRAF = requestAnimationFrame(tick);
    var video = $('cam');
    if (!video.videoWidth) return;
    var w = 480, h = Math.round(video.videoHeight / video.videoWidth * 480);
    scanCanvas.width = w; scanCanvas.height = h;
    var g = scanCanvas.getContext('2d', { willReadFrequently: true });
    g.drawImage(video, 0, 0, w, h);
    var img = g.getImageData(0, 0, w, h);
    var found = window.jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
    if (found && found.data && found.data.indexOf('QD1|') === 0) {
      var cb = scanCB;
      stopScan();
      if (cb) cb(found.data);
    }
  }
}

function stopScan() {
  if (scanRAF) cancelAnimationFrame(scanRAF);
  scanRAF = 0; scanCB = null;
  if (P.stream) { P.stream.getTracks().forEach(function (t) { t.stop(); }); P.stream = null; }
  var v = $('cam');
  if (v) v.srcObject = null;
}

/* ------------------------------------------------------------------ *
 *  Pairing flows
 * ------------------------------------------------------------------ */
function showMyCode(code, title, sub, step, nextLabel, onNext) {
  drawQR(code);
  $('mycode').value = code;
  $('show-title').textContent = title;
  $('show-sub').textContent = sub;
  $('show-step').textContent = step;
  var b = $('b-show-next');
  b.textContent = nextLabel;
  b.classList.toggle('hide', !onNext);
  b.onclick = onNext || null;
  go('show');
}

function hostFlow() {
  banner('pair-err', '');
  primeCamera().then(function () {
    P.role = 'host';
    P.pc = newPeer();
    wireChannel(P.pc.createDataChannel('game', { ordered: true }));
    return P.pc.createOffer()
      .then(function (o) { return P.pc.setLocalDescription(o); })
      .then(function () { return gatherDone(P.pc); });
  }).then(function () {
    showMyCode(packSdp(P.pc.localDescription.sdp),
      'Have them scan this', 'Turn your brightness up and hold the phone steady.',
      'Step 1 of 2', 'Scan their reply', function () {
        $('scan-title').textContent = 'Scan their reply';
        $('scan-step').textContent = 'Step 2 of 2';
        $('scan-sub').textContent = "Point at the other phone's screen.";
        go('scan');
        startScan(takeAnswer);
        $('b-paste').onclick = function () { takeAnswer($('pastecode').value); };
      });
  }).catch(function (e) {
    banner('pair-err', 'Could not start hosting: ' + e.message);
    go('role');
  });

  function takeAnswer(code) {
    try {
      P.pc.setRemoteDescription(unpackSdp(code, 'answer')).then(function () {
        $('wait-title').textContent = 'Connecting…';
        $('wait-sub').textContent = 'Finding the other phone on your network.';
        banner('wait-err', '');
        go('wait');
        armWatchdog();
      }).catch(function (e) { banner('scan-err', 'That code was not accepted: ' + e.message); go('scan'); });
    } catch (e) {
      banner('scan-err', e.message);
      go('scan');
    }
  }
}

function joinFlow() {
  banner('pair-err', '');
  primeCamera().then(function () {
    P.role = 'join';
    P.pc = newPeer();
    P.pc.ondatachannel = function (e) { wireChannel(e.channel); };
    $('scan-title').textContent = 'Scan their code';
    $('scan-step').textContent = 'Step 1 of 2';
    $('scan-sub').textContent = "Point at the host phone's screen.";
    go('scan');
    startScan(takeOffer);
    $('b-paste').onclick = function () { takeOffer($('pastecode').value); };
  });

  function takeOffer(code) {
    var desc;
    try { desc = unpackSdp(code, 'offer'); }
    catch (e) { banner('scan-err', e.message); go('scan'); return; }

    P.pc.setRemoteDescription(desc)
      .then(function () { return P.pc.createAnswer(); })
      .then(function (a) { return P.pc.setLocalDescription(a); })
      .then(function () { return gatherDone(P.pc); })
      .then(function () {
        armWatchdog();
        showMyCode(packSdp(P.pc.localDescription.sdp),
          'Now show them this', 'The game starts as soon as they scan it.',
          'Step 2 of 2', '', null);
      })
      .catch(function (e) { banner('scan-err', 'That code was not accepted: ' + e.message); go('scan'); });
  }
}

function checkVersions() {
  P.mismatch = P.theirVersion !== APP_VERSION;
  if (P.mismatch) showMismatch();
  else {
    $('lobby-err').classList.add('hide');
    $('b-start').disabled = false;
  }
}

function showMismatch() {
  $('lobby-err-msg').textContent =
    'These two phones are running different versions of the game, so they would ' +
    'get different questions. Update whichever phone is out of date, then pair again.';
  $('lobby-err').classList.remove('hide');
  $('b-start').disabled = true;
  go('lobby');
}

/* Clears the precache and the worker outright, so the next load is guaranteed
   to come from the network rather than a stale cached build. */
function hardReload() {
  var step = Promise.resolve();
  if (window.caches) {
    step = caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return caches.delete(k); }));
    }).catch(function () { });
  }
  step.then(function () {
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      return navigator.serviceWorker.getRegistrations().then(function (regs) {
        return Promise.all(regs.map(function (r) { return r.unregister(); }));
      }).catch(function () { });
    }
  }).then(function () { location.reload(); }, function () { location.reload(); });
}

function onConnected() {
  stopScan();
  $('lob-me').textContent = G.me.name;
  $('lob-them').textContent = G.them.name;
  $('b-start').classList.toggle('hide', P.role !== 'host');
  $('lob-sub').textContent = P.role === 'host'
    ? 'Ten questions, fifteen seconds each. Answer fast — points drop the longer you take.'
    : 'Waiting for ' + G.them.name + ' to pick a category…';
  go('lobby');
}

function onDrop() {
  if (G.mode !== 'duo') return;
  if ($('s-play').classList.contains('on')) {
    banner('drop', 'Opponent disconnected — showing the score so far.');
    setTimeout(finish, 1200);
  } else if ($('s-end').classList.contains('on')) {
    /* already finished; nothing to do */
  } else {
    teardown();
    banner('pair-err', 'The other phone disconnected.');
    go('role');
  }
}

/* ------------------------------------------------------------------ *
 *  Game
 * ------------------------------------------------------------------ */
var G = {
  mode: 'solo', me: { name: 'You', score: 0 }, them: { name: 'Them', score: 0 },
  qs: [], cat: MIXED, i: 0, myAns: null, theirAns: null, t0: 0, results: [],
  qTimer: 0, graceTimer: 0, revealTimer: 0, lowTimer: 0, revealed: false
};

function handleMsg(m) {
  if (m.t === 'hi') {
    G.them.name = (m.name || 'Them').slice(0, 14);
    $('lob-them').textContent = G.them.name;
    $('nm-them').textContent = G.them.name;
    $('fn-them').textContent = G.them.name;
    // A build with no version field at all is an older one, and mismatches.
    P.theirVersion = m.v || 'legacy';
    checkVersions();
  } else if (m.t === 'cat') {
    var waiting = G.them.name + ' is picking a category…';
    $('lob-sub').textContent = waiting;
    $('end-wait').textContent = waiting;
  } else if (m.t === 'start') {
    if (P.mismatch) { showMismatch(); return; }
    G.mode = 'duo';
    beginGame(m.seed, m.cat, m.spin);
    // Belt and braces: if our locally built round somehow differs from the
    // host's, stop rather than play a divergent game.
    if (m.sum && roundSum(G.qs) !== m.sum) {
      P.mismatch = true;
      clearTimers();
      showMismatch();
    }
  } else if (m.t === 'ans') {
    if (m.i !== G.i || G.theirAns) return;
    G.theirAns = { choice: m.choice, ms: m.ms };
    paintLock('them', G.theirAns.ms);
    maybeReveal();
  } else if (m.t === 'next') {
    clearTimers();
    G.i = m.i;
    renderQuestion();
  } else if (m.t === 'end') {
    clearTimers();
    finish();
  }
}

function clearTimers() {
  clearTimeout(G.qTimer); clearTimeout(G.graceTimer);
  clearTimeout(G.revealTimer); clearTimeout(G.lowTimer);
}

function beginGame(seed, cat, spin) {
  clearTimers();
  banner('drop', '');
  $('end-wait').textContent = '';
  G.cat = cat || MIXED;
  G.qs = buildRound(seed, G.cat);
  G.i = 0;
  G.me.score = 0; G.them.score = 0;
  G.results = [];
  $('nm-me').textContent = G.me.name;
  $('nm-them').textContent = G.them.name;
  $('pc-them').classList.toggle('hide', G.mode === 'solo');
  $('sc-me').textContent = '0'; $('sc-them').textContent = '0';

  presentCategory(seed, G.cat, spin, function () {
    go('play');
    renderQuestion();
  });
}

/* The wheel screen doubles as the category reveal: a direct pick just holds the
   name for a beat so the other phone sees what is coming, a random pick spins
   first. Both phones drive it from the same seed, so they stay in step. */
function presentCategory(seed, cat, spin, done) {
  var box = $('wheelbox'), label = $('catbig');
  go('wheel');
  label.classList.remove('pop');

  if (!spin) {
    box.classList.add('hide');
    label.textContent = cat === MIXED ? 'Mixed bag' : cat;
    void label.offsetWidth;
    label.classList.add('pop');
    G.revealTimer = setTimeout(done, 1900);
    return;
  }

  box.classList.remove('hide');
  drawWheel();
  label.textContent = '';

  var idx = CATS.indexOf(cat);
  if (idx < 0) idx = 0;
  var seg = 360 / CATS.length;
  var r = rng(seed ^ 0x5bf03635);
  var turns = 5 + Math.floor(r() * 3);
  var jitter = (r() - 0.5) * seg * 0.55;   // don't always stop dead centre
  var target = 360 * turns - (idx * seg + seg / 2) + jitter;

  var cv = $('wheel');
  cv.style.transition = 'none';
  cv.style.transform = 'rotate(0deg)';
  void cv.offsetWidth;
  cv.style.transition = 'transform 4200ms cubic-bezier(.15,.86,.24,1)';
  cv.style.transform = 'rotate(' + target + 'deg)';

  G.revealTimer = setTimeout(function () {
    label.textContent = cat;
    void label.offsetWidth;
    label.classList.add('pop');
    G.revealTimer = setTimeout(done, 1500);
  }, 4300);
}

function drawWheel() {
  var cv = $('wheel'), g = cv.getContext('2d');
  var n = CATS.length, seg = Math.PI * 2 / n;
  var cx = cv.width / 2, cy = cv.height / 2, rad = cx - 4;
  g.clearRect(0, 0, cv.width, cv.height);
  for (var i = 0; i < n; i++) {
    // -90deg puts segment 0 at the top, under the pointer.
    var a0 = -Math.PI / 2 + i * seg, a1 = a0 + seg;
    g.beginPath();
    g.moveTo(cx, cy);
    g.arc(cx, cy, rad, a0, a1);
    g.closePath();
    g.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
    g.fill();
    g.strokeStyle = 'rgba(22,20,58,.55)';
    g.lineWidth = 3;
    g.stroke();

    g.save();
    g.translate(cx, cy);
    var mid = a0 + seg / 2;
    g.rotate(mid);
    // Labels in the left half would come out upside down; spin them round and
    // run the text inward from the rim instead.
    var flipped = Math.cos(mid) < 0;
    if (flipped) g.rotate(Math.PI);
    g.fillStyle = '#16143a';
    g.textAlign = flipped ? 'left' : 'right';
    g.textBaseline = 'middle';
    var label = CATS[i], size = 42;
    // Shrink anything too long for the wedge rather than letting it overflow.
    // Track the size in a variable: parseInt on a font string returns the
    // weight, not the pixel size, which would make this loop never end.
    do {
      g.font = '700 ' + size + 'px ui-rounded,-apple-system,"Segoe UI",Roboto,system-ui,sans-serif';
      size -= 2;
    } while (g.measureText(label).width > rad - 78 && size > 20);
    g.fillText(label, flipped ? -(rad - 26) : rad - 26, 0);
    g.restore();
  }
}

function renderQuestion() {
  clearTimers();
  G.myAns = null; G.theirAns = null; G.revealed = false;
  var q = G.qs[G.i];

  $('qnum').textContent = 'Question ' + (G.i + 1) + ' of ' + ROUND_LEN;
  $('qcat').textContent = q.cat;
  $('qtext').textContent = q.prompt;
  $('status').innerHTML = '';
  $('lk-me').textContent = ''; $('lk-them').textContent = '';
  $('pc-me').classList.remove('locked'); $('pc-them').classList.remove('locked');

  var box = $('opts');
  box.className = 'opts';
  box.innerHTML = '';
  q.opts.forEach(function (text, n) {
    var b = document.createElement('button');
    b.className = 'opt';
    b.innerHTML = '<span class="k"></span><span class="lbl"></span><span class="chips"></span>';
    b.querySelector('.k').textContent = 'ABCD'[n];
    b.querySelector('.lbl').textContent = text;
    b.onclick = function () { pick(n); };
    box.appendChild(b);
  });

  var fill = $('tfill');
  $('tbar').classList.remove('low');
  fill.style.transition = 'none';
  fill.style.transform = 'scaleX(1)';
  void fill.offsetWidth;
  fill.style.transition = 'transform ' + LIMIT + 'ms linear';
  fill.style.transform = 'scaleX(0)';

  G.t0 = performance.now();
  G.lowTimer = setTimeout(function () { $('tbar').classList.add('low'); }, LIMIT - 5000);
  G.qTimer = setTimeout(function () { pick(-1); }, LIMIT);
}

function pick(choice) {
  if (G.myAns) return;
  clearTimeout(G.qTimer); clearTimeout(G.lowTimer);
  var ms = Math.min(performance.now() - G.t0, LIMIT);
  G.myAns = { choice: choice, ms: ms };

  var box = $('opts');
  box.classList.add('locked');
  if (choice >= 0) box.children[choice].classList.add('picked');
  $('tfill').style.transition = 'none';
  $('tfill').style.transform = getComputedStyle($('tfill')).transform;

  paintLock('me', ms, choice < 0);
  send({ t: 'ans', i: G.i, choice: choice, ms: ms });

  if (G.mode === 'duo' && !G.theirAns) {
    $('status').innerHTML = '<span class="dim">Waiting for ' + esc(G.them.name) + '…</span>';
    var theirClock = Math.max(0, LIMIT - ms) + GRACE_MS;
    G.graceTimer = setTimeout(function () {
      if (!G.theirAns) { G.theirAns = { choice: -1, ms: LIMIT }; paintLock('them', LIMIT, true); maybeReveal(); }
    }, theirClock);
  }
  maybeReveal();
}

function paintLock(who, ms, timedOut) {
  var el = $('lk-' + who), card = $('pc-' + who);
  el.textContent = timedOut ? 'out of time' : 'locked ' + (ms / 1000).toFixed(1) + 's';
  card.classList.remove('locked');
  void card.offsetWidth;
  card.classList.add('locked');
}

function maybeReveal() {
  if (G.revealed) return;
  if (!G.myAns) return;
  if (G.mode === 'duo' && !G.theirAns) return;
  G.revealed = true;
  clearTimers();
  reveal();
}

function reveal() {
  var q = G.qs[G.i];
  var myPts = points(G.myAns.choice, G.myAns.ms, q.correct);
  var theirPts = G.mode === 'duo' ? points(G.theirAns.choice, G.theirAns.ms, q.correct) : 0;
  G.me.score += myPts;
  if (G.mode === 'duo') G.them.score += theirPts;

  var box = $('opts');
  for (var n = 0; n < box.children.length; n++) {
    var el = box.children[n];
    if (n === q.correct) el.classList.add('right');
    else if (n === G.myAns.choice) el.classList.add('wrong');
    else el.classList.add('muted');

    var chips = el.querySelector('.chips');
    if (n === G.myAns.choice) chips.appendChild(chip('me', 'you'));
    if (G.mode === 'duo' && G.theirAns.choice === n) chips.appendChild(chip('them', G.them.name.slice(0, 6)));
  }

  countTo($('sc-me'), G.me.score);
  if (G.mode === 'duo') countTo($('sc-them'), G.them.score);

  var line;
  if (G.mode === 'duo') {
    line = '<span class="' + (myPts ? 'gain' : 'miss') + ' pts">' +
      (myPts ? '+' + myPts : 'no points') + '</span>' +
      ' <span class="dim">you</span> &nbsp;·&nbsp; ' +
      '<span class="' + (theirPts ? 'gain' : 'miss') + ' pts">' +
      (theirPts ? '+' + theirPts : 'no points') + '</span>' +
      ' <span class="dim">' + esc(G.them.name) + '</span>';
  } else {
    line = '<span class="' + (myPts ? 'gain' : 'miss') + ' pts">' +
      (myPts ? '+' + myPts : 'no points') + '</span>';
  }
  $('status').innerHTML = line;

  G.results.push({ mine: myPts, theirs: theirPts });

  if (P.role === 'host' || G.mode === 'solo') {
    G.revealTimer = setTimeout(function () {
      if (G.i + 1 >= ROUND_LEN) { send({ t: 'end' }); finish(); }
      else { G.i++; send({ t: 'next', i: G.i }); renderQuestion(); }
    }, REVEAL_MS);
  }
}

function chip(cls, text) {
  var s = document.createElement('span');
  s.className = 'chip ' + cls;
  s.textContent = text;
  return s;
}

function countTo(el, target) {
  var from = parseInt(el.textContent.replace(/,/g, ''), 10) || 0;
  if (from === target) return;
  var t0 = performance.now(), dur = 550;
  (function step(now) {
    var k = Math.min(1, (now - t0) / dur);
    var eased = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(from + (target - from) * eased).toLocaleString();
    if (k < 1) requestAnimationFrame(step);
  })(t0);
}

function finish() {
  clearTimers();
  var mine = G.me.score, theirs = G.them.score;
  var right = G.results.filter(function (r) { return r.mine > 0; }).length;

  $('fn-me').textContent = G.me.name;
  $('fn-them').textContent = G.them.name;
  $('fs-me').textContent = mine.toLocaleString();
  $('fs-them').textContent = theirs.toLocaleString();
  $('fx-me').textContent = right + ' of ' + G.results.length + ' right';
  $('fx-them').textContent = G.results.filter(function (r) { return r.theirs > 0; }).length +
    ' of ' + G.results.length + ' right';
  $('fc-them').classList.toggle('hide', G.mode === 'solo');

  var strip = $('strip');
  strip.innerHTML = '';
  G.results.forEach(function (r, n) {
    var d = document.createElement('div');
    var cls = G.mode === 'solo'
      ? (r.mine > 0 ? 'w' : 'l')
      : (r.mine > r.theirs ? 'w' : r.mine < r.theirs ? 'l' : 't');
    d.className = 'pip ' + cls;
    d.textContent = n + 1;
    strip.appendChild(d);
  });

  $('fc-me').classList.toggle('win', G.mode === 'solo' || mine > theirs);
  $('fc-them').classList.toggle('win', G.mode === 'duo' && theirs > mine);

  if (G.mode === 'solo') {
    $('trophy').textContent = right >= 8 ? '🏆' : right >= 5 ? '👏' : '🎯';
    $('endline').textContent = mine.toLocaleString() + ' points';
  } else if (mine > theirs) {
    $('trophy').textContent = '🏆';
    $('endline').textContent = 'You win';
  } else if (theirs > mine) {
    $('trophy').textContent = '🥈';
    $('endline').textContent = G.them.name + ' wins';
  } else {
    $('trophy').textContent = '🤝';
    $('endline').textContent = "It's a tie";
  }

  $('b-again').classList.toggle('hide', G.mode === 'duo' && P.role !== 'host');
  go('end');
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

/* ------------------------------------------------------------------ *
 *  Wiring
 * ------------------------------------------------------------------ */
function myName() {
  var v = ($('myname').value || '').trim().slice(0, 14);
  return v || 'You';
}

function buildPicker() {
  var box = $('cats');
  if (box.childNodes.length) return;

  function add(label, note, cls, onTap) {
    var b = document.createElement('button');
    b.className = 'cat' + (cls ? ' ' + cls : '');
    b.innerHTML = '<span class="cl"></span><span class="cn"></span>';
    b.querySelector('.cl').textContent = label;
    b.querySelector('.cn').textContent = note;
    b.onclick = onTap;
    box.appendChild(b);
    return b;
  }

  var counts = {};
  window.QUESTIONS.forEach(function (q) { counts[q[3]] = (counts[q[3]] || 0) + 1; });

  add('Surprise me', 'spin the wheel', 'wide rand', function () {
    startRound(CATS[Math.floor(Math.random() * CATS.length)], true);
  });
  add('Mixed bag', 'all ' + window.QUESTIONS.length + ' questions', 'wide mixed', function () {
    startRound(MIXED, false);
  });
  CATS.forEach(function (c) {
    add(c, counts[c] + ' questions', '', function () { startRound(c, false); });
  });
}

function openPicker() {
  buildPicker();
  $('pick-title').textContent = G.mode === 'solo' ? 'Pick a category' : 'Pick a category';
  $('pick-sub').textContent = G.mode === 'solo'
    ? 'Ten questions from whichever you choose.'
    : 'Whatever you pick, ' + G.them.name + ' plays the same ten questions.';
  if (G.mode === 'duo') send({ t: 'cat' });
  go('pick');
}

function startRound(cat, spin) {
  if (G.mode === 'duo' && P.mismatch) { showMismatch(); return; }
  var seed = (Math.random() * 0xffffffff) >>> 0;
  if (G.mode === 'duo') {
    send({ t: 'start', seed: seed, cat: cat, spin: spin, sum: roundSum(buildRound(seed, cat)) });
  }
  beginGame(seed, cat, spin);
}

$('b-friend').onclick = function () { G.me.name = myName(); banner('pair-err', ''); go('role'); };
$('b-solo').onclick = function () {
  G.me.name = myName(); G.mode = 'solo'; P.role = null;
  openPicker();
};
$('b-pick-back').onclick = function () { go(G.mode === 'solo' ? 'home' : 'lobby'); };
$('b-how').onclick = function () { go('how'); };
$('b-how-back').onclick = function () { go('home'); };
$('b-role-back').onclick = function () { teardown(); go('home'); };
$('b-host').onclick = function () { hostFlow(); };
$('b-join').onclick = function () { joinFlow(); };
$('b-show-cancel').onclick = function () { teardown(); go('role'); };
$('b-scan-cancel').onclick = function () { teardown(); go('role'); };
$('b-wait-cancel').onclick = function () { teardown(); go('role'); };
$('b-lobby-quit').onclick = function () { teardown(); go('home'); };
$('b-copy').onclick = function () {
  var ta = $('mycode');
  ta.select();
  if (navigator.clipboard) navigator.clipboard.writeText(ta.value).catch(function () { });
  else { try { document.execCommand('copy'); } catch (e) { } }
  $('b-copy').textContent = 'Copied';
  setTimeout(function () { $('b-copy').textContent = 'Copy code'; }, 1500);
};
$('b-start').onclick = function () { G.mode = 'duo'; openPicker(); };
$('b-again').onclick = function () { openPicker(); };
$('b-home').onclick = function () { teardown(); go('home'); };

try {
  var saved = localStorage.getItem('qd.name');
  if (saved) $('myname').value = saved;
  $('myname').addEventListener('change', function () {
    try { localStorage.setItem('qd.name', $('myname').value.trim()); } catch (e) { }
  });
} catch (e) { }

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', function () {
    // updateViaCache:'none' keeps the browser from serving sw.js from HTTP
    // cache, which is what lets a stale build linger for days.
    // Whether a worker was ALREADY driving this page decides update vs first
    // install. Reading controller later is no good: clients.claim() sets it
    // during a first install too, which would reload every new visitor once.
    var wasControlled = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(function (reg) {
      reg.addEventListener('updatefound', function () {
        var fresh = reg.installing;
        if (!fresh) return;
        fresh.addEventListener('statechange', function () {
          // The worker calls skipWaiting/claim, so it takes over at once — but
          // this page still holds the old scripts. Reload once to pick them up.
          if (fresh.state === 'activated' && wasControlled) {
            try {
              if (!sessionStorage.getItem('qd.updated')) {
                sessionStorage.setItem('qd.updated', '1');
                location.reload();
              }
            } catch (e) { location.reload(); }
          }
        });
      });
    }).catch(function () { });
  });
}

$('ver').textContent = 'v' + APP_VERSION;
$('b-reload').onclick = hardReload;

/* Exposed so the Playwright harness can drive a two-context handshake without
   a camera; the UI itself never calls these. */
window.__qd = {
  packSdp: packSdp, unpackSdp: unpackSdp, buildRound: buildRound, points: points,
  CATS: CATS, MIXED: MIXED, APP_VERSION: APP_VERSION, roundSum: roundSum,
  drawWheel: drawWheel, G: G, P: P
};

})();
