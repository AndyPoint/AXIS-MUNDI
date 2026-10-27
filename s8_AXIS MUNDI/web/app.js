/* SYSTEM 8 · Control room 1.3
   One archive, one radial grammar. Every level looks the same: the focus in the centre, three rings of structure,
   an outer field of files. Zooming re-centres the rings on a child — dots become spokes, spokes become names,
   names become thumbnails. Graph = the same rings with bundled links. Patch = the node room for wiring material into tools.
   Left panel = what exists (system, library). Right panel = what you can do (selection, tools, run, node inspector). */
(() => {
  'use strict';

  // ───────────────────────────────────────── basics
  const $ = s => document.querySelector(s);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const ease = u => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
  const DPR = () => Math.min(2, window.devicePixelRatio || 1);
  const TAU = Math.PI * 2;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const keep = {
    get(k, d) { try { const v = localStorage.getItem('s8cr.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('s8cr.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fdate = t => { const d = new Date(t * 1000); return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); };
  const fmon = t => { const d = new Date(t * 1000); return MON[d.getMonth()] + ' ' + d.getFullYear(); };
  const fsize = kb => kb < 1024 ? fmt(Math.max(1, kb)) + ' KB' : kb < 1048576 ? (kb / 1024).toFixed(kb < 10240 ? 1 : 0) + ' MB' : (kb / 1048576).toFixed(1) + ' GB';
  const ago = t => { const s = Date.now() / 1000 - t; return s < 90 ? 'just now' : s < 5400 ? Math.round(s / 60) + ' min ago' : s < 129600 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' days ago'; };
  const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const nextFrame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

  const KLAB = { note: 'MD notes', skill: 'Skills', source: 'PDF + text', photo: 'Photos', ai: 'AI images', video: 'Videos', screen: 'Screenshots', m3d: '3D files', cad: 'CAD files', audio: 'Audio', code: 'Code' };
  const KONE = { note: 'Note', skill: 'Skill', source: 'Source', photo: 'Photo', ai: 'AI image', video: 'Video', screen: 'Screenshot', m3d: '3D file', cad: 'CAD file', audio: 'Audio', code: 'Code' };
  const KALIAS = { ai: 'ai', image: 'ai', mj: 'ai', photo: 'photo', photos: 'photo', note: 'note', notes: 'note', md: 'note', pdf: 'source', source: 'source', text: 'source', book: 'source', video: 'video', videos: 'video', screen: 'screen', screenshot: 'screen', '3d': 'm3d', m3d: 'm3d', model: 'm3d', cad: 'cad', skill: 'skill', skills: 'skill', audio: 'audio', sound: 'audio', code: 'code' };
  const GRID_ORDER = ['note', 'skill', 'source', 'm3d', 'cad', 'code', 'audio', 'video', 'ai', 'screen', 'photo'];
  const IMG_KINDS = new Set(['photo', 'ai', 'screen']);
  const VISUAL = new Set(['photo', 'ai', 'screen', 'video', 'm3d', 'cad']);
  // shape grammar (1.2): circle = text-based file, square = material
  const TEXTK = new Set(['note', 'skill', 'source', 'code']);
  const shp = k => (TEXTK.has(D.kinds[k]) ? ' ci' : '');
  const VIEWS = [['rings', 'Rings'], ['graph', 'Graph'], ['patch', 'Patch'], ['year', 'Year'], ['field', 'Field']];

  // ───────────────────────────────────────── state
  const S = {
    live: false, token: '', mode: 'rings', view: 'rings', item: -1, list: -1, hist: [], sel: -1,
    q: '', match: null, mcount: 0, mlist: null, date: null, hiddenK: null,
    left: false, right: false, tools: [], tasks: [], progress: null, caps: {}, status: null,
    theme: 'auto', weight: keep.get('weight', 'sqrt'),
    year: 0, ctxList: null, sidecars: new Map(), openLog: null,
    lenses: [], activeLens: 0, flags: new Map(), deadlines: new Map(), dl: new Map(), groups: [],
  };
  let D = null, C = null, W = 0, H = 0;
  const field = $('#field'), fx = field.getContext('2d');
  const dom = $('#dom');

  // ───────────────────────────────────────── data store
  function groupBy(N, keyArr, M) {
    const start = new Uint32Array(M + 1);
    for (let i = 0; i < N; i++) start[keyArr[i] + 1]++;
    for (let m = 0; m < M; m++) start[m + 1] += start[m];
    const pos = start.slice(0, M), items = new Int32Array(N);
    for (let i = 0; i < N; i++) items[pos[keyArr[i]]++] = i;
    return { start, items };
  }
  function makeStore(J) {
    const ta = (T, a) => (a instanceof T ? a : T.from(a));
    const N = J.n.length;
    const st = {
      N, demo: !!J.demo, scale: J.scale || 1, at: J.at, machine: J.machine, kinds: J.kinds, sectors: J.sectors, roots: J.roots || [],
      dirs: J.dirs, dirRoot: J.dirRoot, works: J.works.map(w => ({ n: w.n })), n: J.n,
      d: ta(Uint32Array, J.d), k: ta(Uint8Array, J.k), s: ta(Uint8Array, J.s), w: ta(Uint32Array, J.w), t: ta(Uint32Array, J.t), z: ta(Uint32Array, J.z),
      x: J.x instanceof Map ? J.x : new Map(Object.entries(J.x || {}).map(([i, v]) => [+i, v])),
    };
    const K = st.kinds.length, SC = st.sectors.length, WC = st.works.length;
    st.kindIx = Object.fromEntries(st.kinds.map((k, i) => [k, i]));
    const floor = 946684800; let tmin = Infinity, tmax = 0;
    for (let i = 0; i < N; i++) { const t = st.t[i]; if (t >= floor && t < tmin) tmin = t; if (t > tmax) tmax = t; }
    if (!isFinite(tmin)) tmin = floor; if (tmax <= tmin) tmax = tmin + 86400;
    st.tmin = tmin; st.tmax = tmax;
    st.kindCount = new Uint32Array(K); st.secCount = new Uint32Array(SC); st.workCount = new Uint32Array(WC); st.workSec = new Uint32Array(WC * SC);
    st.workT0 = new Uint32Array(WC).fill(4294967295); st.workT1 = new Uint32Array(WC);
    st.yr = new Uint16Array(N); st.mo = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const k = st.k[i], s = st.s[i], w = st.w[i], t = st.t[i];
      st.kindCount[k]++; st.secCount[s]++; st.workCount[w]++; st.workSec[w * SC + s]++;
      if (t > st.workT1[w]) st.workT1[w] = t; if (t < st.workT0[w]) st.workT0[w] = t;
      const dd = new Date(t * 1000); st.yr[i] = dd.getFullYear(); st.mo[i] = dd.getMonth();
    }
    st.byKind = groupBy(N, st.k, K);
    st.byWork = groupBy(N, st.w, WC);
    st.dirLow = st.dirs.map((rel, i) => ((st.roots[st.dirRoot[i]] || {}).name + '/' + rel).toLowerCase());
    st.dirParts = st.dirs.map(rel => (rel ? rel.split('/') : []));
    st.workLow = st.works.map(w => w.n.toLowerCase());
    st.notes = []; const ni = st.kindIx.note, si = st.kindIx.skill;
    for (let i = 0; i < N; i++) if (st.k[i] === ni || st.k[i] === si) st.notes.push(i);
    st.nameMap = new Map();
    for (const i of st.notes) {
      const x = st.x.get(i) || {};
      const base = st.n[i] === 'SKILL.md' ? (x.ti || '').toLowerCase() : st.n[i].replace(/\.md$/i, '').toLowerCase();
      if (base && !st.nameMap.has(base)) st.nameMap.set(base, i);
      if (x.ti && !st.nameMap.has(x.ti.toLowerCase())) st.nameMap.set(x.ti.toLowerCase(), i);
      for (const a of x.al || []) if (!st.nameMap.has(String(a).toLowerCase())) st.nameMap.set(String(a).toLowerCase(), i);
    }
    const want = new Set();
    for (const i of st.notes) for (const l of (st.x.get(i) || {}).ln || []) { const b = l.split('/').pop().toLowerCase(); if (!st.nameMap.has(b) && /\.[a-z0-9]{2,5}$/.test(b)) want.add(b); }
    if (want.size) for (let i = 0; i < N && want.size; i++) { const lw = st.n[i].toLowerCase(); if (want.has(lw)) { st.nameMap.set(lw, i); want.delete(lw); } }
    return st;
  }
  const kindOf = i => D.kinds[D.k[i]];
  const extOf = i => { const n = D.n[i], p = n.lastIndexOf('.'); return p < 0 ? '' : n.slice(p + 1).toLowerCase(); };
  const titleOf = i => { const x = D.x.get(i); if (x && x.ti) return x.ti; const n = D.n[i]; return kindOf(i) === 'note' ? n.replace(/\.md$/i, '') : n; };
  const pathOf = i => { const di = D.d[i], root = D.roots[D.dirRoot[di]] || { path: '' }, rel = D.dirs[di]; return String(root.path).replace(/[\\/]$/, '') + '/' + (rel ? rel + '/' : '') + D.n[i]; };
  const workName = w => (D.works[w] || { n: '' }).n;
  function promptFromName(n) {
    const s = n.replace(/\.[a-z0-9]+$/i, '').replace(new RegExp(UUID.source, 'gi'), ' ').replace(/https?_+\S*?(?=_[a-z]{3,}|$)/gi, ' ').replace(/_/g, ' ');
    return s.replace(/\s+\d{1,2}$/, '').replace(/\s+/g, ' ').trim();
  }
  const promptOf = i => { const x = D.x.get(i); if (x && x.pr) return x.pr; if (kindOf(i) === 'ai' && UUID.test(D.n[i])) return promptFromName(D.n[i]); return ''; };
  const resolveLink = l => { const b = String(l).split('/').pop().toLowerCase(); const v = D.nameMap.get(b); return v === undefined ? D.nameMap.get(b.replace(/\.md$/, '')) : v; };
  function backlinks(i) {
    if (!D.back) { D.back = new Map(); for (const n of D.notes) for (const l of (D.x.get(n) || {}).ln || []) { const t = resolveLink(l); if (t !== undefined && t !== n) { const a = D.back.get(t); if (a) a.push(n); else D.back.set(t, [n]); } } }
    return D.back.get(i) || [];
  }
  function linkedOf(i) {
    const out = [], x = D.x.get(i);
    if (x && x.ln) for (const l of x.ln) { const t = resolveLink(l); if (t !== undefined && t !== i) out.push(t); }
    if (x && x.sc >= 0) out.push(x.sc);
    for (const b of backlinks(i)) out.push(b);
    return [...new Set(out)].slice(0, 200);
  }
  function byTime() {
    if (!D.byTime) {
      const N = D.N, a = new Int32Array(N), t = D.t, K2 = 2097152;
      if (N < K2) { const keys = new Float64Array(N); for (let i = 0; i < N; i++) keys[i] = t[i] * K2 + i; keys.sort(); for (let q = 0; q < N; q++) a[N - 1 - q] = keys[q] % K2; }
      else { for (let i = 0; i < N; i++) a[i] = i; a.sort((p, q) => t[q] - t[p]); }
      D.byTime = a;
    }
    return D.byTime;
  }
  const itemTip = i => [titleOf(i), KONE[kindOf(i)] + ' · ' + workName(D.w[i]) + ' · ' + fdate(D.t[i])];

  // ───────────────────────────────────────── colours, theme
  function readColors() {
    const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
    C = { g: v('--g'), s: v('--s'), l: v('--l'), d: v('--d'), t: v('--t'), a: v('--a'), k: (D ? D.kinds : []).map(k => v('--k-' + k) || v('--d')),
      b1: v('--b1'), b1t: v('--b1t'), b1h: v('--b1h'), b2: v('--b2'), b2t: v('--b2t'), b3: v('--b3'), b3t: v('--b3t') };
    C.tint = [0.34, 0.66, 1].map(t => C.k.map(c => mixHex(C.g, c, t)));
    C.miss = mixHex(C.g, C.l, 0.9);
  }
  function hexRgb(h) { h = String(h).trim().replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mixHex(a, b, t) { const A = hexRgb(a), B = hexRgb(b); return '#' + A.map((x, j) => Math.round(x + (B[j] - x) * t).toString(16).padStart(2, '0')).join(''); }
  const themeMeta = document.querySelector('meta[name="s8-theme"]');
  const HOST_THEME = themeMeta ? null : document.documentElement.getAttribute('data-theme');
  S.theme = keep.get('theme', themeMeta ? themeMeta.getAttribute('content') : 'auto');
  function applyTheme() {
    const r = document.documentElement;
    if (S.theme === 'auto') { if (HOST_THEME) r.setAttribute('data-theme', HOST_THEME); else r.removeAttribute('data-theme'); } else r.setAttribute('data-theme', S.theme);
    if (D) { readColors(); invalidate(); Inset.draw(); renderLegend(); }
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S.theme === 'auto') applyTheme(); });
  let FONTS = '';
  const FONT = () => FONTS || (FONTS = getComputedStyle(document.body).fontFamily);

  // ───────────────────────────────────────── bridge api
  const API = {
    url: p => p + (p.includes('?') ? '&' : '?') + 'k=' + encodeURIComponent(S.token),
    async get(p) { const r = await fetch(API.url(p), { cache: 'no-store' }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); return j; },
    async post(p, b) {
      try { const r = await fetch(p, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-S8-Token': S.token }, body: JSON.stringify(b || {}) }); const j = await r.json().catch(() => ({ ok: false })); if (!r.ok && !j.error) j.error = 'HTTP ' + r.status; return j; }
      catch (e) { return { ok: false, error: 'Bridge not reachable' }; }
    },
    file: i => '/f/' + i + '?k=' + encodeURIComponent(S.token),
    thumb: i => '/t/' + i + '?k=' + encodeURIComponent(S.token),
  };

  // ───────────────────────────────────────── search
  function parseQuery(q) {
    const P = { terms: [], neg: [], kinds: [], exts: [], y0: 0, y1: 0, sec: [], secX: [], tags: [], work: [], workX: [], dir: [] };
    const re = /(-?)(?:([a-z]+):)?(?:"([^"]+)"|(\S+))/gi; let m;
    while ((m = re.exec(q))) {
      const neg = m[1] === '-', key = (m[2] || '').toLowerCase(), val = (m[3] || m[4] || '').toLowerCase();
      if (!val) continue;
      if (key === 'kind' || key === 'k') P.kinds.push(KALIAS[val] || val);
      else if (key === 'ext') P.exts.push(val.replace(/^\./, ''));
      else if (key === 'year' || key === 'y') { const [a, b] = val.split(/[-–]/); P.y0 = +a || 0; P.y1 = +(b || a) || 0; }
      else if (key === 'in') (m[3] ? P.secX : P.sec).push(val);
      else if (key === 'work' || key === 'project') (m[3] ? P.workX : P.work).push(val);
      else if (key === 'dir' || key === 'folder') P.dir.push(val.replace(/^\/+|\/+$/g, ''));
      else if (!key && val[0] === '#' && val.length > 1) P.tags.push(val.slice(1));
      else (neg ? P.neg : P.terms).push(key ? key + ':' + val : val);
    }
    return P;
  }
  function ensureHay() {
    if (!D.nLow) D.nLow = D.n.map(s => s.toLowerCase());
    if (!D.exHay) { D.exHay = new Map(); for (const [i, x] of D.x) { const h = [x.pr, x.ti, (x.tg || []).join(' '), (x.al || []).join(' '), x.de].filter(Boolean).join(' ').toLowerCase(); if (h) D.exHay.set(i, h); } }
  }
  function runSearch() {
    const q = S.q.trim(), df = S.date;
    if (!q && !df) { S.match = null; S.mcount = 0; S.mlist = null; afterSearch(); return; }
    const r = computeMatch(q, df);
    S.match = r.m; S.mcount = r.c; S.mlist = null;
    afterSearch();
  }
  function computeMatch(q, df) {
    const P = q ? parseQuery(q) : null;
    ensureHay();
    const N = D.N, m = new Uint8Array(N); let c = 0;
    const kindSet = P && P.kinds.length ? new Set(P.kinds.map(k => D.kindIx[k]).filter(v => v != null)) : null;
    const secSet = P && (P.sec.length || P.secX.length) ? new Set(D.sectors.map((s, i) => (P.sec.every(v => s.id.toLowerCase().includes(v) || s.name.toLowerCase().includes(v)) && P.secX.every(v => s.id.toLowerCase() === v || s.name.toLowerCase() === v) ? i : -1)).filter(i => i >= 0)) : null;
    const workOk = P && (P.work.length || P.workX.length) ? Uint8Array.from(D.workLow, w => (P.work.every(v => w.includes(v)) && P.workX.every(v => w === v) ? 1 : 0)) : null;
    const dirOk = P && P.dir.length ? Uint8Array.from(D.dirLow, x => { const pth = '/' + x + '/'; return P.dir.every(v => pth.includes('/' + v + '/')) ? 1 : 0; }) : null;
    const yt0 = P && P.y0 ? new Date(P.y0, 0, 1) / 1000 : 0, yt1 = P && P.y1 ? new Date(P.y1 + 1, 0, 1) / 1000 : 0;
    const terms = P ? P.terms : [], neg = P ? P.neg : [];
    const dirHit = terms.map(tm => Uint8Array.from(D.dirLow, x => (x.includes(tm) ? 1 : 0)));
    const workHit = terms.map(tm => Uint8Array.from(D.workLow, x => (x.includes(tm) ? 1 : 0)));
    const negDir = neg.map(tm => Uint8Array.from(D.dirLow, x => (x.includes(tm) ? 1 : 0)));
    const exts = P && P.exts.length ? P.exts : null, tags = P && P.tags.length ? P.tags : null;
    const nl = D.nLow, eh = D.exHay;
    for (let i = 0; i < N; i++) {
      if (kindSet && !kindSet.has(D.k[i])) continue;
      if (secSet && !secSet.has(D.s[i])) continue;
      if (workOk && !workOk[D.w[i]]) continue;
      if (dirOk && !dirOk[D.d[i]]) continue;
      const t = D.t[i];
      if (yt0 && (t < yt0 || t >= yt1)) continue;
      if (df && !df.ranges.some(r => t >= r[0] && t < r[1])) continue;
      if (exts && !exts.includes(extOf(i))) continue;
      let ok = true;
      if (terms.length) {
        const n = nl[i], di = D.d[i], wi = D.w[i], e = eh.get(i);
        for (let j = 0; j < terms.length; j++) { const tm = terms[j]; if (n.includes(tm) || dirHit[j][di] || workHit[j][wi] || (e && e.includes(tm))) continue; ok = false; break; }
      }
      if (ok && neg.length) { const n = nl[i], e = eh.get(i), di = D.d[i]; for (let j = 0; j < neg.length; j++) if (n.includes(neg[j]) || negDir[j][di] || (e && e.includes(neg[j]))) { ok = false; break; } }
      if (ok && tags) { const x = D.x.get(i); if (!x || !x.tg || !tags.every(tg => x.tg.some(v => { v = String(v).toLowerCase(); return v === tg || v.startsWith(tg + '/') || v.startsWith(tg + '-'); }))) ok = false; }
      if (ok) { m[i] = 1; c++; }
    }
    return { m, c };
  }
  function matchList() {
    if (!S.match) return byTime();
    if (!S.mlist) { const bt = byTime(), m = S.match, a = new Int32Array(S.mcount); let j = 0; for (let q = 0; q < bt.length; q++) if (m[bt[q]]) a[j++] = bt[q]; S.mlist = a; }
    return S.mlist;
  }
  function afterSearch() {
    $('#qn').textContent = S.match ? fmt(S.mcount) + ' of ' + fmt(D.N) : '';
    $('#qx').hidden = !S.q;
    $('#ql').hidden = !(S.q.trim() && S.mcount && S.mode === 'rings');
    for (const v of [Rings, Graph, ...S.lenses.map(L => L.v)]) v.matchPrefix();
    if (['field', 'list', 'year'].includes(S.mode)) renderDom();
    invalidate(); renderTrail();
  }
  let searchT = 0;

  // ───────────────────────────────────────── the fractal tree
  // A node holds at most leafMax files; anything larger splits again: sector → work → folder → kind → year → month → time chunk.
  const CAP = 36;
  function buildTree(items, o) {
    const leafMax = o.leafMax || 30, K = D.kinds.length, N = D.N;
    const nodes = [], order = new Int32Array(items.length);
    const leafOf = new Int32Array(N).fill(-1), itemX = new Float64Array(N), pos = new Int32Array(N).fill(-1);
    let op = 0;
    const mk = (label, type, parent, extra) => {
      const nd = { id: nodes.length, label, type, parent: parent ? parent.id : -1, depth: parent ? parent.depth + 1 : 0, kids: null, leaf: false, a: 0, b: 0, n: 0, x0: 0, x1: 1, t0: 0, t1: 0, kc: null };
      if (extra) Object.assign(nd, extra);
      nodes.push(nd); return nd;
    };
    const groups = (arr, keyFn) => { const m = new Map(); for (let q = 0; q < arr.length; q++) { const i = arr[q], k = keyFn(i); const g = m.get(k); if (g) g.push(i); else m.set(k, [i]); } return m; };
    const folderKey = (i, lvl) => { const parts = D.dirParts[D.d[i]]; const off = parts.length && parts[0].toLowerCase() === D.workLow[D.w[i]] ? 1 : 0; const p = parts[off + lvl]; return p === undefined ? '' : p; };
    const capList = (list, mkOther) => { if (list.length <= CAP) return list; const head = list.slice(0, CAP - 1), rest = list.slice(CAP - 1); let ra = []; for (const r of rest) ra = ra.concat(r.arr); head.push(mkOther(ra, rest.length)); return head; };
    function catSplit(arr, nd, ctx) {
      if (nd.type === 'root') {
        const m = groups(arr, i => D.s[i]);
        return { type: 'sector', list: [...m.keys()].sort((a, b) => a - b).map(s => ({ label: D.sectors[s].name, arr: m.get(s), ctx: {}, extra: { key: s } })) };
      }
      if (nd.type === 'sector' || ctx.byWork) {
        const m = groups(arr, i => D.w[i]);
        let list = [...m.entries()].map(([w, a]) => ({ label: D.works[w].n, arr: a, ctx: { fl: 0 }, extra: { key: w } })).sort((p, q) => q.arr.length - p.arr.length);
        list = capList(list, (ra, n) => ({ label: 'Other works · ' + n, arr: ra, ctx: { byWork: true }, extra: { type: 'other' } }));
        return { type: 'work', list };
      }
      return null;
    }
    function folderSplit(arr, ctx) {
      if (ctx.noFolder) return null;
      let lvl = ctx.fl || 0;
      for (let guard = 0; guard < 10; guard++) {
        const m = groups(arr, i => folderKey(i, lvl));
        if (m.size === 1) { if (m.has('')) return null; lvl++; continue; }
        if (m.size > 12 && arr.length / m.size < 2.5) return null;
        let list = [...m.entries()].map(([k, a]) => ({ label: k || 'Files here', arr: a, ctx: k ? { ...ctx, fl: lvl + 1 } : { ...ctx, noFolder: true } }))
          .sort((p, q) => (p.label === 'Files here') - (q.label === 'Files here') || q.arr.length - p.arr.length);
        list = capList(list, (ra, n) => ({ label: 'Other folders · ' + n, arr: ra, ctx: { ...ctx, fl: lvl }, extra: { type: 'other' } }));
        return { type: 'folder', list };
      }
      return null;
    }
    function kindSplit(arr, ctx) {
      if (ctx.kindDone) return null;
      const m = groups(arr, i => D.k[i]); if (m.size < 2) return null;
      return { type: 'kind', list: GRID_ORDER.map(kn => D.kindIx[kn]).filter(k => m.has(k)).map(k => ({ label: KLAB[D.kinds[k]], arr: m.get(k), ctx: { ...ctx, kindDone: true }, extra: { key: k } })) };
    }
    function timeSplit(arr, ctx) {
      const my = groups(arr, i => D.yr[i]);
      if (my.size >= 2) return { type: 'year', time: true, list: [...my.keys()].sort((a, b) => a - b).map(y => ({ label: String(y), arr: my.get(y), ctx: { ...ctx, kindDone: true } })) };
      const mm = groups(arr, i => D.yr[i] * 12 + D.mo[i]);
      if (mm.size >= 2) return { type: 'month', time: true, list: [...mm.keys()].sort((a, b) => a - b).map(k => ({ label: MON[k % 12] + ' ' + Math.floor(k / 12), arr: mm.get(k), ctx: { ...ctx, kindDone: true } })) };
      const s2 = Array.from(arr).sort((p, q) => D.t[p] - D.t[q]);
      const k = Math.min(CAP, Math.ceil(s2.length / leafMax)), size = Math.ceil(s2.length / k), list = [];
      for (let c = 0; c < k; c++) {
        const a = s2.slice(c * size, (c + 1) * size); if (!a.length) continue;
        const d0 = new Date(D.t[a[0]] * 1000), d1 = new Date(D.t[a[a.length - 1]] * 1000);
        const lab = d0.toDateString() === d1.toDateString() ? d0.getDate() + ' ' + MON[d0.getMonth()] + ' · ' + (c * size + 1) + '–' + (c * size + a.length)
          : d0.getMonth() === d1.getMonth() ? d0.getDate() + '–' + d1.getDate() + ' ' + MON[d1.getMonth()] : d0.getDate() + ' ' + MON[d0.getMonth()] + ' – ' + d1.getDate() + ' ' + MON[d1.getMonth()];
        list.push({ label: lab, arr: a, ctx: { ...ctx, kindDone: true, noFolder: true } });
      }
      return list.length >= 2 ? { type: 'chunk', time: true, list } : null;
    }
    const weightOf = (n, root) => (root ? (S.weight === 'count' ? n : S.weight === 'equal' ? 1 : Math.sqrt(n)) : Math.sqrt(n));
    function place(nd, arr, ctx) {
      nd.n = arr.length; nd.a = op;
      const kc = new Uint32Array(K); let t0 = 4294967295, t1 = 0;
      for (let q = 0; q < arr.length; q++) { const i = arr[q]; kc[D.k[i]]++; const t = D.t[i]; if (t < t0) t0 = t; if (t > t1) t1 = t; }
      nd.kc = kc; nd.t0 = t0; nd.t1 = t1;
      let split = catSplit(arr, nd, ctx);
      if (!split && nd.type !== 'root' && arr.length > leafMax) split = folderSplit(arr, ctx) || kindSplit(arr, ctx) || timeSplit(arr, ctx);
      if (!split || !split.list.length) {
        const s2 = Array.from(arr).sort((p, q) => D.t[p] - D.t[q]);
        nd.leaf = true;
        for (let j = 0; j < s2.length; j++) { const i = s2[j]; order[op] = i; pos[i] = op; op++; leafOf[i] = nd.id; itemX[i] = nd.x0 + (j + 0.5) / s2.length * (nd.x1 - nd.x0); }
        nd.b = op; return;
      }
      let ws = split.list.map(g => (split.time ? g.arr.length : weightOf(g.arr.length, nd.type === 'root')));
      if (nd.type === 'root' && ws.length > 1) { const s0 = ws.reduce((a, b) => a + b, 0) || 1; ws = ws.map(w => Math.max(w / s0, 0.06)); }
      const sum = ws.reduce((a, b) => a + b, 0) || 1;
      let x = nd.x0; nd.kids = [];
      split.list.forEach((g, j) => { const c = mk(g.label, split.type, nd, g.extra); c.x0 = x; c.x1 = x + (nd.x1 - nd.x0) * ws[j] / sum; x = c.x1; nd.kids.push(c.id); place(c, g.arr, g.ctx || {}); });
      nd.b = op;
    }
    const root = mk(o.name || 'All', 'root', null);
    place(root, items, {});
    return { nodes, order, leafOf, itemX, pos, root, leafMax };
  }
  function ancestorAt(T, id, depth) { let n = T.nodes[id]; while (n && n.depth > depth) n = T.nodes[n.parent]; return n ? n.id : 0; }
  function chain(T, id) { const out = []; let n = T.nodes[id]; while (n) { out.unshift(n.id); n = n.parent >= 0 ? T.nodes[n.parent] : null; } return out; }

  // ───────────────────────────────────────── radial view (rings and graph share it)
  // band radii as fractions of R. The rings keep slim bands, because the names of what the bands hold live on the outer ring; the graph keeps its wide bands.
  const mkBc = B => x => { if (x <= -1) return 0; if (x >= 4) return B[5] + (x - 4) * 0.04; const i = Math.floor(x + 1), f = x + 1 - i; return B[i] + (B[i + 1] - B[i]) * f; };
  const BC_G = mkBc([0, 0.2, 0.325, 0.43, 0.515, 0.56]), BC_R = mkBc([0, 0.19, 0.345, 0.385, 0.415, 0.432]), RING_F0 = 0.447;
  // the rings' outer ring: project rule, folder names, project names, then the tools orbit
  function ringGeo() {
    const av = Math.min(W - 40, H - 112) / 2, tools = W >= 600 && S.tools.length > 0, LB = clamp(av * 0.145, 34, 74);
    const R = Math.max(90, (av - LB - (tools ? 64 : 30)) / 0.985), F1R = 0.985 * R;
    return { R, LB, tools, rArc: F1R + 6, rFold: F1R + 13, rProj: F1R + 13 + LB + 11, rTool: F1R + 13 + LB + 35 };
  }
  const angDist = (a, b) => { let d = (a - b) % TAU; if (d < 0) d += TAU; return d > Math.PI ? TAU - d : d; };
  // fixed chrome the outer ring must not draw over
  function obstacles() {
    const out = [];
    for (const sel of ['#search', '#inset', '#legend']) { const e = $(sel); if (!e || e.hidden) continue; const b = e.getBoundingClientRect(); if (b.width && b.height) out.push([b.left - 6, b.top - 6, b.width + 12, b.height + 12]); }
    return out;
  }
  const overlaps = (O, x, y, w, h) => O.some(o => x < o[0] + o[2] && x + w > o[0] && y < o[1] + o[3] && y + h > o[1]);
  const TH = new Map();
  function canThumb(i) {
    const kn = kindOf(i); if (!S.live) return VISUAL.has(kn);
    if (IMG_KINDS.has(kn)) return true;
    if (kn === 'video') return !!(S.caps.ffmpeg || S.caps.quicklook);
    return !!S.caps.quicklook && (kn === 'm3d' || kn === 'cad' || kn === 'source');
  }
  function thumbFor(i) {
    if (!canThumb(i)) return null;
    let t = TH.get(i);
    if (t) { TH.delete(i); TH.set(i, t); return t.ok ? t.img : null; }
    if (S.live) { const img = new Image(); t = { img, ok: false }; img.onload = () => { t.ok = true; invalidate(); }; img.onerror = () => { t.err = true; }; img.src = API.thumb(i); }
    else { const cv = document.createElement('canvas'); cv.width = 192; cv.height = 120; window.S8DEMO.paint(cv.getContext('2d'), i, 192, 120, kindOf(i), workName(D.w[i])); t = { img: cv, ok: true }; }
    TH.set(i, t); if (TH.size > 900) TH.delete(TH.keys().next().value);
    return t.ok ? t.img : null;
  }
  function drawCover(ctx, img, x, y, w, h) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height; if (!iw || !ih) return;
    const s = Math.max(w / iw, h / ih), sw = w / s, sh = h / s;
    ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
  }
  function fitText(ctx, s, w) { if (w <= 8) return ''; s = String(s); if (ctx.measureText(s).width <= w) return s; while (s.length > 1 && ctx.measureText(s + '…').width > w) s = s.slice(0, -1); return s.length > 1 ? s + '…' : ''; }
  function tanText(ctx, txt, cx, cy, r, ang) {
    ctx.save(); ctx.translate(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
    let rot = ang + Math.PI / 2; if (Math.sin(ang) > 0.0001) rot -= Math.PI;
    ctx.rotate(rot); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, 0, 0); ctx.restore();
  }
  function radText(ctx, txt, cx, cy, r, ang) {
    ctx.save(); ctx.translate(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
    const left = Math.cos(ang) < 0;
    ctx.rotate(left ? ang + Math.PI : ang); ctx.textAlign = left ? 'right' : 'left'; ctx.textBaseline = 'middle'; ctx.fillText(txt, 0, 0); ctx.restore();
  }
  function annulus(ctx, cx, cy, rIn, rOut, a0, a1) {
    ctx.beginPath();
    if (a1 - a0 >= TAU - 1e-6) { ctx.arc(cx, cy, rOut, 0, TAU); ctx.moveTo(cx + rIn, cy); ctx.arc(cx, cy, rIn, 0, TAU, true); }
    else { ctx.arc(cx, cy, rOut, a0, a1); ctx.arc(cx, cy, rIn, a1, a0, true); ctx.closePath(); }
  }
  function smoothPath(P, pts) {
    P.moveTo(pts[0][0], pts[0][1]);
    for (let q = 1; q < pts.length - 1; q++) { const mx = (pts[q][0] + pts[q + 1][0]) / 2, my = (pts[q][1] + pts[q + 1][1]) / 2; P.quadraticCurveTo(pts[q][0], pts[q][1], mx, my); }
    P.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  }

  function Radial(name, graph) {
    const F0 = graph ? 0.575 : RING_F0, F1 = 0.985, Bc = graph ? BC_G : BC_R;
    const PXR = graph ? F0 : 0.62; // where the room per file is measured: the stages (blocks → spokes → names → thumbnails) follow it
    const v = {
      name, graph, tree: null, focus: 0, tr: null, rot: 0, hover: null,
      arcs: [], leaves: [], cellInfo: null, mpre: null, anim: 0, snapT: 0, wacc: 0,
      wa: 0, ws: TAU, lens: null, home: 0, noCenter: false, flags: [], ringHits: [], ringA: 1, nameMax: 0,
      R() { return graph ? Math.max(110, Math.min(W - 40, H - 150) / 2) : ringGeo().R; },
      center() { return graph ? [W / 2, H / 2 + 10] : [W / 2, H / 2 + 6]; },
      base() { return -Math.PI / 2 + this.rot + this.wa; },
      set(tree) { this.tree = tree; this.focus = 0; this.home = 0; this.tr = null; this.matchPrefix(); },
      matchPrefix() {
        const T = this.tree; if (!T) return;
        if (!S.match) { this.mpre = null; return; }
        const n = T.order.length, p = new Uint32Array(n + 1), m = S.match;
        for (let q = 0; q < n; q++) p[q + 1] = p[q] + m[T.order[q]];
        this.mpre = p;
      },
      matched(nd) { return this.mpre ? this.mpre[nd.b] - this.mpre[nd.a] : nd.n; },
      dom() {
        const N = this.tree.nodes, A = N[this.tr ? this.tr.A : this.focus];
        if (!this.tr) return { d0: A.x0, d1: A.x1, off: A.depth };
        const B = N[this.tr.B], e = ease(clamp(this.tr.p, 0, 1)), wA = A.x1 - A.x0, wB = B.x1 - B.x0;
        if (Math.abs(wA - wB) < 1e-15) { const d0 = lerp(A.x0, B.x0, e); return { d0, d1: d0 + wA, off: lerp(A.depth, B.depth, e) }; }
        const X = (A.x0 * wB - B.x0 * wA) / (wB - wA), w = wA * Math.pow(wB / wA, e), d0 = X - (X - A.x0) * w / wA;
        return { d0, d1: d0 + w, off: lerp(A.depth, B.depth, e) };
      },
      th(x, d) { return this.base() + this.ws * (x - d.d0) / (d.d1 - d.d0); },
      shownFocus() { return this.tr ? (ease(clamp(this.tr.p, 0, 1)) > 0.5 ? this.tr.B : this.tr.A) : this.focus; },

      visit(d, R) {
        const T = this.tree, N = T.nodes, k = this.ws / (d.d1 - d.d0), arcs = [], leaves = [], stack = [0];
        while (stack.length) {
          const nd = N[stack.pop()];
          if (nd.x1 <= d.d0 || nd.x0 >= d.d1) continue;
          const b = nd.depth - d.off, wx = (Math.min(nd.x1, d.d1) - Math.max(nd.x0, d.d0)) * k;
          if (b > -1 && b < 4 && nd.depth > 0) arcs.push(nd);
          if (nd.leaf) { leaves.push(nd); continue; }
          if (b >= 3 && wx * R * PXR < nd.n * (graph ? 0.4 : 1.2) && nd.n > T.leafMax * 2) { leaves.push(nd); continue; }
          for (const c of nd.kids) stack.push(c);
        }
        return { arcs, leaves };
      },

      draw(ctx) {
        const T = this.tree; if (!T) return;
        const d = this.dom(), R = this.R(), [cx, cy] = this.center(), F = FONT();
        const span = d.d1 - d.d0, K = D.kinds.length;
        const { arcs, leaves } = this.visit(d, R);
        this.arcs = []; this.leaves = []; this.cellInfo = null; this.flags = []; this.ringHits = []; this.nameMax = 0;
        const hk = S.hiddenK, m = S.match, A0 = this.base(), A1 = A0 + this.ws;
        ctx.lineWidth = 1;
        // year guides in the field: the newest year at the outer edge, where the ring is longest
        const years = [];
        if (!graph) {
          const y0 = new Date(D.tmin * 1000).getFullYear() + 1, y1 = new Date(D.tmax * 1000).getFullYear(), nY = y1 - y0 + 1, st = nY <= 8 ? 1 : nY <= 16 ? 2 : 5;
          for (let y = y1; y >= y0; y -= st) years.push({ y, r: (F1 - (D.tmax - new Date(y, 0, 1) / 1000) / (D.tmax - D.tmin) * (F1 - F0)) * R });
          ctx.strokeStyle = C.l; ctx.setLineDash([1, 4]);
          for (const yy of years) { ctx.beginPath(); ctx.arc(cx, cy, yy.r, A0, A1); ctx.stroke(); }
          ctx.setLineDash([]);
        }
        ctx.strokeStyle = C.l; ctx.beginPath(); ctx.arc(cx, cy, F0 * R - 1, A0, A1); ctx.stroke();
        if (!T.nodes[0].n) { this.drawEmpty(ctx, R, cx, cy, F); return; }
        // bands
        const hovId = this.hover && (this.hover.type === 'arc' || this.hover.type === 'label') ? this.hover.id : -1;
        for (const nd of arcs) {
          const b = nd.depth - d.off; if (b <= 0.02) continue;
          const alpha = b > 3 ? clamp(4 - b, 0, 1) : 1; if (alpha <= 0.02) continue;
          const rIn = Bc(b - 1) * R + 1, rOut = Bc(b) * R - 1; if (rOut - rIn < 2) continue;
          let a0 = this.th(Math.max(nd.x0, d.d0), d), a1 = this.th(Math.min(nd.x1, d.d1), d);
          if (a1 - a0 < TAU - 1e-6) { const g = Math.min(2 / rIn, (a1 - a0) * 0.25); a0 += g / 2; a1 -= g / 2; }
          if ((a1 - a0) * rOut < 0.7) continue;
          const mt = this.matched(nd), dim = m && !mt, lvl = b < 1.5 ? 1 : b < 2.5 ? 2 : 3, hv = nd.id === hovId;
          ctx.globalAlpha = alpha * (dim ? 0.3 : 1);
          annulus(ctx, cx, cy, rIn, rOut, a0, a1);
          ctx.fillStyle = lvl === 1 ? (hv ? C.b1h : C.b1) : lvl === 2 ? (hv ? C.l : C.b2) : (hv ? C.b2 : C.b3); ctx.fill('evenodd');
          if (hv && lvl > 1) { ctx.strokeStyle = C.t; ctx.stroke(); }
          if ((a1 - a0) * rOut > 6) {
            let a = a0; const tot = nd.n || 1, sw = lvl === 1 ? 6 : 5;
            ctx.lineWidth = sw;
            for (const kn of GRID_ORDER) { const kk = D.kindIx[kn]; if (kk === undefined || !nd.kc[kk]) continue; const da = (a1 - a0) * nd.kc[kk] / tot; ctx.strokeStyle = C.k[kk]; ctx.beginPath(); ctx.arc(cx, cy, rOut - sw / 2, a, a + da); ctx.stroke(); a += da; }
            ctx.lineWidth = 1;
          }
          if (m && mt) { ctx.strokeStyle = lvl === 1 ? C.b1t : C.t; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, rIn + 2, a0, a0 + (a1 - a0) * Math.min(1, mt / nd.n)); ctx.stroke(); ctx.lineWidth = 1; }
          ctx.globalAlpha = 1;
          this.arcs.push({ id: nd.id, rIn, rOut, a0, a1, b, alpha });
        }
        // field
        this.drawField(ctx, d, R, cx, cy, leaves, span, K, hk, m, F);
        if (years.length && this.showYears) {
          ctx.font = '400 9px ' + F; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          const a = A0 + (this.ws < TAU - 1e-6 ? 0.02 : 0);
          for (const yy of years) { const x = cx + Math.cos(a) * yy.r + 3, y = cy + Math.sin(a) * yy.r; const w = ctx.measureText(String(yy.y)).width; ctx.fillStyle = C.g; ctx.fillRect(x - 2, y - 6, w + 4, 12); ctx.fillStyle = C.d; ctx.fillText(String(yy.y), x, y); }
        }
        // links
        this.drawLinks(ctx, d, R, cx, cy);
        // outer ring: project rule, folder names, project names
        this.ringA = graph ? 0 : clamp(1 - this.nameMax * 1.6, 0, 1);
        this.drawRing(ctx, R, cx, cy, F);
        // arc labels (the rings name bands 2–3 on the outer ring instead)
        for (const a of this.arcs) {
          const nd = T.nodes[a.id], len = (a.a1 - a.a0) * (a.rIn + a.rOut) / 2;
          let la = a.alpha;
          if (!graph && a.b >= 1.5) { if (a.b >= 2.5) continue; la *= 1 - this.ringA; }
          if (len < 26 || la < 0.3) continue;
          const mid = (a.a0 + a.a1) / 2, rm = (a.rIn + a.rOut) / 2, thick = a.rOut - a.rIn, big = a.b < 1.5;
          ctx.globalAlpha = la;
          ctx.font = (big ? '700 11px ' : a.b < 2.5 && graph ? '400 11px ' : '400 10px ') + F;
          ctx.fillStyle = big ? C.b1t : a.b < 2.5 ? C.b2t : C.b3t;
          if ('letterSpacing' in ctx) ctx.letterSpacing = big ? '1.1px' : '0px';
          const full = big ? nd.label.toUpperCase() : nd.label;
          let txt = fitText(ctx, full, len - 12);
          if (txt !== full) { ctx.font = (big ? '700 10px ' : '400 10px ') + F; if ('letterSpacing' in ctx) ctx.letterSpacing = big ? '0.5px' : '0px'; txt = fitText(ctx, full, len - 10); }
          const two = big && thick > 24, rName = two ? (graph ? rm + 6 : a.rOut - 9) : rm;
          if (two && !graph && txt !== full) { const lo = (a.a1 - a.a0) * rName; ctx.font = '700 10px ' + F; if ('letterSpacing' in ctx) ctx.letterSpacing = '0.4px'; txt = fitText(ctx, full, lo - 6); }
          const tw = txt ? ctx.measureText(txt).width : 0;
          if (txt) {
            tanText(ctx, txt, cx, cy, rName, mid);
            if (two) { if ('letterSpacing' in ctx) ctx.letterSpacing = '0.6px'; ctx.font = '400 10px ' + F; ctx.globalAlpha = la * 0.7; tanText(ctx, fitText(ctx, fmt(nd.n), (a.a1 - a.a0) * (graph ? rm - 8 : a.rIn + 9) - 12), cx, cy, graph ? rm - 8 : a.rIn + 9, mid); }
          }
          if (!graph && la > 0.5) this.pushFlags(nd, cx, cy, rName, mid, tw);
          if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
          ctx.globalAlpha = 1;
        }
        if (!this.noCenter) this.drawCenter(ctx, R, cx, cy, F);
        this.drawPreview(ctx, R, cx, cy, F);
        if (!D.N) { ctx.fillStyle = C.d; ctx.textAlign = 'center'; ctx.fillText('No items yet — add folders to config.json, then Reindex.', W / 2, H - 120); }
      },

      drawField(ctx, d, R, cx, cy, leaves, span, K, hk, m, F) {
        const T = this.tree, k = this.ws / span, glyphs = [], halftone = [];
        for (const nd of leaves) {
          const px = (Math.min(nd.x1, d.d1) - Math.max(nd.x0, d.d0)) * k * R * PXR / Math.max(1, nd.n);
          if (nd.leaf && (px >= 2.4 || graph)) glyphs.push({ nd, px }); else halftone.push(nd);
        }
        this.showYears = halftone.length > 0 || glyphs.some(g => g.px < 6.5);
        const tmin = D.tmin, tspan = D.tmax - D.tmin;
        // the field as flat blocks: one block per angle × time cell, colour = the kind that dominates, tint = how many files
        if (halftone.length) {
          const nCol = Math.max(this.ws >= TAU - 1e-6 ? 64 : 8, Math.round(this.ws * R * F0 / 6.4)), nRow = Math.max(8, Math.round((F1 - F0) * R / 7.6)), nc = nCol * nRow;
          if (!this.cbuf || this.cbuf.n !== nc || this.cbuf.K !== K) this.cbuf = { n: nc, K, cnt: new Uint32Array(nc), mc: new Uint32Array(nc), kc: new Uint32Array(nc * K), rep: new Int32Array(nc), repT: new Uint32Array(nc) };
          const B = this.cbuf; B.cnt.fill(0); B.mc.fill(0); B.kc.fill(0); B.repT.fill(0); B.rep.fill(-1);
          const order = T.order, X = T.itemX;
          for (const nd of halftone) {
            for (let p = nd.a; p < nd.b; p++) {
              const i = order[p], kk = D.k[i]; if (hk[kk]) continue;
              const x = X[i]; if (x < d.d0 || x >= d.d1) continue;
              const col = Math.min(nCol - 1, Math.floor((x - d.d0) / span * nCol));
              const t = D.t[i], row = Math.min(nRow - 1, Math.floor(clamp((D.tmax - Math.max(t, tmin)) / tspan, 0, 0.9999) * nRow));
              const c = row * nCol + col;
              B.cnt[c]++; B.kc[c * K + kk]++; if (m && m[i]) B.mc[c]++;
              if (t >= B.repT[c]) { B.repT[c] = t; B.rep[c] = i; }
            }
          }
          let cmax = 1; for (let c = 0; c < nc; c++) if (B.cnt[c] > cmax) cmax = B.cnt[c];
          const lmax = Math.log1p(cmax), paths = new Map();
          const rh = (F1 - F0) * R / nRow, base = this.base(), ws = this.ws;
          for (let row = 0; row < nRow; row++) {
            const rI = F0 * R + (graph ? row : nRow - 1 - row) * rh + 0.5, rO = rI + rh - 1, ga = 0.6 / rO;
            for (let col = 0; col < nCol; col++) {
              const c = row * nCol + col, n = B.cnt[c]; if (!n) continue;
              let best = 0, bv = -1; for (let kk = 0; kk < K; kk++) { const v2 = B.kc[c * K + kk]; if (v2 > bv) { bv = v2; best = kk; } }
              const miss = m && !B.mc[c], q = Math.log1p(m ? B.mc[c] : n) / lmax, lv = q < 0.34 ? 0 : q < 0.67 ? 1 : 2;
              const key = miss ? 'm' : lv * 64 + best;
              let P = paths.get(key); if (!P) { P = new Path2D(); paths.set(key, P); }
              const a0 = base + col / nCol * ws + ga, a1 = base + (col + 1) / nCol * ws - ga;
              P.moveTo(cx + Math.cos(a0) * rO, cy + Math.sin(a0) * rO); P.arc(cx, cy, rO, a0, a1); P.arc(cx, cy, rI, a1, a0, true); P.closePath();
            }
          }
          for (const [key, P] of paths) { ctx.fillStyle = key === 'm' ? C.miss : C.tint[Math.floor(key / 64)][key % 64]; ctx.fill(P); }
          this.cellInfo = { nCol, nRow, B };
        }
        if (!glyphs.length) return;
        // glyph leaves: spokes → names → thumbnails
        const r0 = F0 * R + 2, labels = [], thumbs = [];
        const selI = S.sel, hovI = this.hover && this.hover.type === 'leaf' ? this.hover.i : -1;
        for (const { nd, px } of glyphs) {
          const nameA = smooth((px - 6) / 2.5), thumbA = smooth((px - 28) / 10);
          if (nameA > this.nameMax) this.nameMax = nameA;
          const bars = new Map(), heads = new Map(), lw = clamp(px * 0.55, 1.2, 6), hr = clamp(lw * 0.85, 1.6, 4);
          for (let p = nd.a; p < nd.b; p++) {
            const i = T.order[p], kk = D.k[i]; if (hk[kk]) continue;
            const x = T.itemX[i]; if (x < d.d0 || x >= d.d1) continue;
            const ang = this.th(x, d), ca = Math.cos(ang), sa = Math.sin(ang);
            const tn = clamp((D.tmax - Math.max(D.t[i], D.tmin)) / (D.tmax - D.tmin), 0, 1);
            const rt = graph ? r0 + 10 : lerp((F1 - tn * (F1 - F0)) * R, r0 + 9, nameA);
            const hit = !m || m[i], bk = hit ? kk : -1;
            let P = bars.get(bk); if (!P) { P = new Path2D(); bars.set(bk, P); }
            P.moveTo(cx + ca * r0, cy + sa * r0); P.lineTo(cx + ca * Math.max(rt, r0 + 4), cy + sa * Math.max(rt, r0 + 4));
            if (TEXTK.has(D.kinds[kk])) { let H = heads.get(bk); if (!H) { H = new Path2D(); heads.set(bk, H); } const rh = Math.max(rt, r0 + 4) + hr, hx = cx + ca * rh, hy = cy + sa * rh; H.moveTo(hx + hr, hy); H.arc(hx, hy, hr, 0, TAU); }
            let rEnd = rt + 3;
            if (thumbA > 0 && VISUAL.has(kindOf(i))) {
              const rr0 = 0.74 * R, tw = Math.min(120, px * rr0 / (PXR * R) * 0.82), thh = tw / 1.6, ext = Math.abs(ca) * tw / 2 + Math.abs(sa) * thh / 2, rc = Math.max(r0 + 12 + ext, rr0);
              thumbs.push({ i, x: cx + ca * rc - tw / 2, y: cy + sa * rc - thh / 2, w: tw, h: thh, a: thumbA, hit });
              rEnd = rc + ext + 4;
            }
            if (nameA > 0) labels.push({ i, ang, r: rEnd + 4, a: nameA * (hit ? 1 : 0.3), px, strong: i === selI || i === hovI });
            this.leaves.push({ i, ang, r0, r1: Math.max(rEnd, rt + 6), px });
          }
          ctx.lineWidth = lw; ctx.lineCap = 'butt';
          for (const [bk, P] of bars) { ctx.strokeStyle = bk < 0 ? C.miss : C.k[bk]; ctx.stroke(P); }
          for (const [bk, H] of heads) { ctx.fillStyle = bk < 0 ? C.miss : C.k[bk]; ctx.fill(H); }
          ctx.lineWidth = 1;
        }
        for (const t of thumbs) {
          const img = thumbFor(t.i);
          ctx.globalAlpha = t.a * (t.hit ? 1 : 0.3);
          ctx.fillStyle = C.s; ctx.fillRect(t.x, t.y, t.w, t.h);
          if (img) drawCover(ctx, img, t.x, t.y, t.w, t.h);
          else { ctx.fillStyle = C.d; ctx.font = '700 10px ' + F; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(extOf(t.i).toUpperCase(), t.x + t.w / 2, t.y + t.h / 2); }
          ctx.fillStyle = C.k[D.k[t.i]]; ctx.fillRect(t.x, t.y + t.h - 4, t.w, 4);
          if (t.i === selI || t.i === hovI) { ctx.strokeStyle = t.i === selI ? C.a : C.t; ctx.lineWidth = t.i === selI ? 2 : 1; ctx.strokeRect(t.x - 1.5, t.y - 1.5, t.w + 3, t.h + 3); ctx.lineWidth = 1; }
          ctx.globalAlpha = 1;
          this.leaves.push({ i: t.i, box: [t.x, t.y, t.w, t.h] });
        }
        for (const L of labels) {
          ctx.font = (L.strong ? '700 ' : '400 ') + (L.px > 16 ? 11 : 10) + 'px ' + F; ctx.fillStyle = C.t; ctx.globalAlpha = L.a;
          const t = fitText(ctx, titleOf(L.i), Math.max(90, (graph ? F1 * R + 70 : ringGeo().rProj) - L.r));
          if (t) radText(ctx, t, cx, cy, L.r, L.ang);
          ctx.globalAlpha = 1;
        }
        if (selI >= 0) for (const lf of this.leaves) if (lf.i === selI && lf.ang != null) { ctx.strokeStyle = C.a; ctx.beginPath(); ctx.arc(cx + Math.cos(lf.ang) * (lf.r0 + 10), cy + Math.sin(lf.ang) * (lf.r0 + 10), 5, 0, TAU); ctx.stroke(); break; }
      },

      ctrlPoint(nd, d, R, cx, cy) {
        const b = nd.depth - d.off;
        if (b <= 0.5 || nd.x1 <= d.d0 || nd.x0 >= d.d1) return [cx, cy];
        const mid = (Math.max(nd.x0, d.d0) + Math.min(nd.x1, d.d1)) / 2, a = this.th(mid, d), r = Bc(Math.min(b, 3.5) - 0.5) * R;
        return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
      },
      drawLinks(ctx, d, R, cx, cy) {
        const T = this.tree; let edges;
        if (graph) edges = T.edges || [];
        else { if (S.sel < 0 || T.pos[S.sel] < 0) return; edges = []; for (const j of linkedOf(S.sel)) if (T.pos[j] >= 0) edges.push(S.sel, j); }
        if (!edges.length) return;
        const N = T.nodes, focusI = S.sel >= 0 ? S.sel : (this.hover && this.hover.i >= 0 ? this.hover.i : -1);
        const inDom = i => { const x = T.itemX[i]; return x >= d.d0 && x < d.d1; };
        const anchor = i => { const a = this.th(T.itemX[i], d), r = F0 * R - 3; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
        const route = (i, j) => {
          const ii = inDom(i), jj = inDom(j);
          if (!ii && !jj) return null;
          const ci = chain(T, T.leafOf[i]), cj = chain(T, T.leafOf[j]);
          let l = 0; while (l < ci.length && l < cj.length && ci[l] === cj[l]) l++;
          const pts = [ii ? anchor(i) : [cx, cy]];
          if (ii) for (let q = ci.length - 1; q >= l; q--) pts.push(this.ctrlPoint(N[ci[q]], d, R, cx, cy));
          pts.push(this.ctrlPoint(N[ci[l - 1]], d, R, cx, cy));
          if (jj) for (let q = l; q < cj.length; q++) pts.push(this.ctrlPoint(N[cj[q]], d, R, cx, cy));
          pts.push(jj ? anchor(j) : [cx, cy]);
          const n = pts.length, beta = 0.82, p0 = pts[0], pn = pts[n - 1];
          for (let q = 1; q < n - 1; q++) { const t = q / (n - 1); pts[q] = [beta * pts[q][0] + (1 - beta) * (p0[0] + t * (pn[0] - p0[0])), beta * pts[q][1] + (1 - beta) * (p0[1] + t * (pn[1] - p0[1]))]; }
          return { pts, partial: !(ii && jj) };
        };
        const textK = new Set(['note', 'skill', 'source', 'code']);
        const colourOf = (i, j) => { const ki = kindOf(i), kj = kindOf(j); return textK.has(kj) && !textK.has(ki) ? D.k[i] : D.k[j]; };
        const base = new Map(), part = new Path2D(), strong = new Map();
        const add = (M, k, pts) => { let P = M.get(k); if (!P) { P = new Path2D(); M.set(k, P); } smoothPath(P, pts); };
        for (let e = 0; e < edges.length; e += 2) {
          const i = edges[e], j = edges[e + 1], r = route(i, j); if (!r) continue;
          if (i === focusI || j === focusI) add(strong, colourOf(i, j), r.pts);
          else if (r.partial) smoothPath(part, r.pts); else add(base, colourOf(i, j), r.pts);
        }
        ctx.lineWidth = 1;
        ctx.globalAlpha = graph ? (focusI >= 0 ? 0.12 : 0.34) : 0.5;
        for (const [k, P] of base) { ctx.strokeStyle = C.k[k]; ctx.stroke(P); }
        ctx.globalAlpha = graph ? 0.08 : 0.2; ctx.strokeStyle = C.d; ctx.stroke(part);
        ctx.globalAlpha = 1; ctx.lineWidth = 1.6;
        for (const [k, P] of strong) { ctx.strokeStyle = C.k[k]; ctx.stroke(P); }
        ctx.lineWidth = 1;
      },

      drawCenter(ctx, R, cx, cy, F) {
        const nd = this.tree.nodes[this.shownFocus()], r = Bc(0) * R - 2;
        ctx.fillStyle = C.g; ctx.strokeStyle = this.hover && this.hover.type === 'center' && nd.depth > 0 ? C.t : C.l;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); if (this.hover && this.hover.type === 'center' && nd.depth > 0) { ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1; }
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const sp = v2 => { if ('letterSpacing' in ctx) ctx.letterSpacing = v2; };
        if (this.lens && nd.id === this.home) {
          ctx.fillStyle = C.t; ctx.font = '700 14px ' + F;
          const lines = wrap(ctx, this.lens.title, r * 1.6, 2);
          lines.forEach((ln, j) => ctx.fillText(ln, cx, cy - 12 + j * 17 - (lines.length - 1) * 8));
          ctx.font = '400 10px ' + F; ctx.fillStyle = C.d; sp('1px');
          ctx.fillText(fmt(nd.n) + ' · LENS', cx, cy + 14);
          sp('0px');
        } else if (nd.depth === 0) {
          let fs = Math.round(clamp(r * 0.36, 11, 20)); ctx.font = '700 ' + fs + 'px ' + F;
          while (fs > 9 && ctx.measureText(fmt(nd.n)).width > r * 1.7) { fs--; ctx.font = '700 ' + fs + 'px ' + F; }
          ctx.fillStyle = C.t; ctx.fillText(fmt(nd.n), cx, cy - 4);
          ctx.font = '400 10px ' + F; ctx.fillStyle = C.d; sp('1.2px');
          ctx.fillText(graph ? 'LINKED ITEMS' : 'ITEMS', cx, cy + 13);
          if (!graph && r > 50) {
            const running = S.tasks.filter(t => t.state === 'running').length;
            ctx.fillText(running ? running + ' RUNNING' : 'AGENTS IDLE', cx, cy + 27);
            const nT = S.tasks.length; S.tasks.forEach((t, j) => { const a = -Math.PI / 2 + (nT > 1 ? (j / (nT - 1) - 0.5) * 1.4 : 0), rr = r - 11; stateDot(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, t.state); });
          }
          sp('0px');
        } else {
          ctx.fillStyle = C.t; ctx.font = '700 14px ' + F;
          const lines = wrap(ctx, nd.label, r * 1.6, 2);
          lines.forEach((ln, j) => ctx.fillText(ln, cx, cy - 12 + j * 17 - (lines.length - 1) * 8));
          ctx.font = '400 10px ' + F; ctx.fillStyle = C.d; sp('1px');
          ctx.fillText(fmt(nd.n) + ' · ' + fmon(nd.t0) + (fmon(nd.t0) !== fmon(nd.t1) ? ' – ' + fmon(nd.t1) : ''), cx, cy + 14);
          if (r > 50) ctx.fillText('↑ UP · L LIST', cx, cy + 28);
          sp('0px');
        }
        if (!graph && nd.type === 'work') this.pushFlags(nd, cx, cy, 0, 0, 0, cy - r * 0.62);
      },
      drawEmpty(ctx, R, cx, cy, F) {
        const a = this.base() + this.ws / 2, r = (F0 + F1) / 2 * R;
        ctx.font = '400 10px ' + F; ctx.fillStyle = C.d; if ('letterSpacing' in ctx) ctx.letterSpacing = '1.1px';
        tanText(ctx, 'EMPTY · DRAG FILES HERE', cx, cy, r, a);
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        if (!this.noCenter) this.drawCenter(ctx, R, cx, cy, F);
      },
      // red triangles: what needs you in a project (rotating = an agent waits · pulsing = something failed · blinking = deadline near)
      pushFlags(nd, cx, cy, r, mid, tw, yCentre) {
        const f = nd.type === 'work' ? S.flags.get(nd.key) : null; if (!f) return;
        const causes = ['wait', 'fail', 'due'].filter(c => f[c].length); if (!causes.length) return;
        if (yCentre != null) { causes.forEach((c, j) => this.flags.push({ x: cx + (j - (causes.length - 1) / 2) * 13, y: yCentre, f: c })); return; }
        const dir = Math.sin(mid) > 0.0001 ? -1 : 1, start = mid - dir * (tw / 2) / Math.max(r, 1);
        causes.forEach((c, j) => { const a = tw ? start - dir * (9 + j * 13) / r : mid + (j - (causes.length - 1) / 2) * 13 / r; this.flags.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, f: c }); });
      },
      // the outer ring: a black rule over each project, folder names read outward, project names along the circle
      drawRing(ctx, R, cx, cy, F) {
        const A = this.ringA; if (graph || A <= 0.02) return;
        const G = ringGeo(), T = this.tree, O = obstacles(), proj = [], fold = [];
        const hovId = this.hover && (this.hover.type === 'label' || this.hover.type === 'arc') ? this.hover.id : -1;
        for (const a of this.arcs) { const wP = clamp(1 - Math.abs(a.b - 2), 0, 1), wS = clamp(1 - Math.abs(a.b - 3), 0, 1); if (wP > 0.02) proj.push([a, wP]); if (wS > 0.02) fold.push([a, wS]); }
        const dimOf = a => (S.match && !this.matched(T.nodes[a.id]) ? 0.3 : 1);
        ctx.strokeStyle = C.t; ctx.lineWidth = 3;
        for (const [a, w] of proj) { if ((a.a1 - a.a0) * G.rArc < 5) continue; ctx.globalAlpha = A * w * dimOf(a); ctx.beginPath(); ctx.arc(cx, cy, G.rArc, a.a0 + 1.5 / G.rArc, a.a1 - 1.5 / G.rArc); ctx.stroke(); }
        ctx.lineWidth = 1;
        const taken = [], gap = 11.5 / G.rFold, radialP = new Set();
        // projects: along the circle when the name fits, otherwise bold and reading outward
        ctx.font = '700 11px ' + F; if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
        const tang = new Map();
        for (const [a, w] of proj) {
          const nd = T.nodes[a.id], f = nd.type === 'work' ? S.flags.get(nd.key) : null, nf = f ? ['wait', 'fail', 'due'].filter(c => f[c].length).length : 0;
          const full = nd.label.toUpperCase(), len = (a.a1 - a.a0) * G.rProj;
          if (ctx.measureText(full).width <= len - 10 - nf * 13) tang.set(a.id, full); else radialP.add(a.id);
        }
        ctx.font = '700 10px ' + F; if ('letterSpacing' in ctx) ctx.letterSpacing = '0.6px';
        const radOrder = proj.filter(([a]) => radialP.has(a.id)).sort((p, q) => T.nodes[q[0].id].n - T.nodes[p[0].id].n);
        for (const [a, w] of radOrder) {
          const mid = (a.a0 + a.a1) / 2; if (w < 0.5 || taken.some(t => angDist(t, mid) < gap)) continue;
          const nd = T.nodes[a.id], txt = fitText(ctx, nd.label.toUpperCase(), G.LB + 22); if (!txt) continue;
          const tw = ctx.measureText(txt).width, c0 = Math.cos(mid), s0 = Math.sin(mid);
          const xa = cx + c0 * G.rFold, ya = cy + s0 * G.rFold, xb = cx + c0 * (G.rFold + tw), yb = cy + s0 * (G.rFold + tw);
          if (overlaps(O, Math.min(xa, xb) - 4, Math.min(ya, yb) - 6, Math.abs(xb - xa) + 8, Math.abs(yb - ya) + 12)) continue;
          taken.push(mid);
          ctx.globalAlpha = A * w * dimOf(a); ctx.fillStyle = C.t;
          radText(ctx, txt, cx, cy, G.rFold, mid);
          if (a.id === hovId) { const px2 = -s0 * 7, py2 = c0 * 7; ctx.strokeStyle = C.t; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xa + px2, ya + py2); ctx.lineTo(xb + px2, yb + py2); ctx.stroke(); }
          this.ringHits.push({ id: a.id, a: mid, da: 6.5 / G.rFold, r0: G.rFold - 3, r1: G.rFold + tw + 3 });
          if (A > 0.5) { const f = nd.type === 'work' ? S.flags.get(nd.key) : null; if (f) ['wait', 'fail', 'due'].filter(c => f[c].length).forEach((c, j) => { const rr = G.rFold + tw + 9 + j * 13; this.flags.push({ x: cx + c0 * rr, y: cy + s0 * rr, f: c }); }); }
        }
        ctx.font = '400 10px ' + F; if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        fold.sort((p, q) => T.nodes[q[0].id].n - T.nodes[p[0].id].n);
        for (const [a, w] of fold) {
          const mid = (a.a0 + a.a1) / 2; if (taken.some(t => angDist(t, mid) < gap)) continue;
          const nd = T.nodes[a.id], txt = fitText(ctx, nd.label, G.LB); if (!txt) continue;
          const tw = ctx.measureText(txt).width, c0 = Math.cos(mid), s0 = Math.sin(mid);
          const xa = cx + c0 * G.rFold, ya = cy + s0 * G.rFold, xb = cx + c0 * (G.rFold + tw), yb = cy + s0 * (G.rFold + tw);
          if (overlaps(O, Math.min(xa, xb) - 4, Math.min(ya, yb) - 6, Math.abs(xb - xa) + 8, Math.abs(yb - ya) + 12)) continue;
          taken.push(mid);
          ctx.globalAlpha = A * w * dimOf(a); ctx.fillStyle = a.id === hovId ? C.t : C.d;
          radText(ctx, txt, cx, cy, G.rFold, mid);
          this.ringHits.push({ id: a.id, a: mid, da: 6 / G.rFold, r0: G.rFold - 3, r1: G.rFold + tw + 3 });
        }
        ctx.font = '700 11px ' + F; if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
        for (const [a, w] of proj) {
          if (radialP.has(a.id)) continue;
          const nd = T.nodes[a.id], mid = (a.a0 + a.a1) / 2;
          let txt = tang.get(a.id) || '';
          let tw = txt ? ctx.measureText(txt).width : 0;
          if (txt) {
            const ex = Math.abs(Math.sin(mid)) * tw / 2 + 7, ey = Math.abs(Math.cos(mid)) * tw / 2 + 7, x = cx + Math.cos(mid) * G.rProj, y = cy + Math.sin(mid) * G.rProj;
            if (overlaps(O, x - ex, y - ey, ex * 2, ey * 2)) { txt = ''; tw = 0; }
          }
          if (txt) {
            ctx.globalAlpha = A * w * dimOf(a); ctx.fillStyle = C.t;
            tanText(ctx, txt, cx, cy, G.rProj, mid);
            if (a.id === hovId) { ctx.lineWidth = 1; ctx.strokeStyle = C.t; ctx.beginPath(); ctx.arc(cx, cy, G.rProj + (Math.sin(mid) > 0.0001 ? -8 : 8), mid - tw / 2 / G.rProj, mid + tw / 2 / G.rProj); ctx.stroke(); }
            this.ringHits.push({ id: a.id, a: mid, da: (tw / 2 + 4) / G.rProj, r0: G.rProj - 9, r1: G.rProj + 9 });
          }
          if (w > 0.5 && A > 0.5) this.pushFlags(nd, cx, cy, G.rProj, mid, tw);
        }
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        ctx.globalAlpha = 1;
      },
      drawPreview(ctx, R, cx, cy, F) {
        if (this.tr) return;
        const T = this.tree, f = T.nodes[this.focus];
        if (!f.leaf) return;
        const hi = this.hover && this.hover.type === 'leaf' ? this.hover.i : -1;
        const i = hi >= 0 ? hi : (!this.noCenter && S.sel >= 0 && T.pos[S.sel] >= f.a && T.pos[S.sel] < f.b ? S.sel : -1);
        if (i < 0) return;
        const room = (F0 * R - 14) * 2 / Math.SQRT2, w = Math.min(room * 1.18, 420), h = w / 1.6, x = cx - w / 2, y = cy - h / 2 - 8;
        ctx.fillStyle = C.g; ctx.beginPath(); ctx.arc(cx, cy, F0 * R - 8, 0, TAU); ctx.fill();
        if (VISUAL.has(kindOf(i))) {
          const img = thumbFor(i);
          ctx.fillStyle = C.s; ctx.fillRect(x, y, w, h);
          if (img) drawCover(ctx, img, x, y, w, h);
          else { ctx.fillStyle = C.t; ctx.font = '700 40px ' + F; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(extOf(i).toUpperCase(), cx, y + h / 2); }
        } else {
          ctx.fillStyle = C.s; ctx.fillRect(x, y, w, h);
          ctx.fillStyle = C.t; ctx.font = '700 40px ' + F; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(extOf(i).toUpperCase(), cx, cy - 8);
        }
        ctx.fillStyle = C.t; ctx.font = '700 12px ' + F; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(fitText(ctx, titleOf(i), w), cx, y + h + 10);
        ctx.font = '400 10px ' + F; ctx.fillStyle = C.d; if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
        ctx.fillText((KONE[kindOf(i)] + ' · ' + fdate(D.t[i]) + ' · double-click to open').toUpperCase(), cx, y + h + 28);
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      },
      hit(mx, my) {
        if (!this.tree) return null;
        const [cx, cy] = this.center(), R = this.R(), dx = mx - cx, dy = my - cy, r = Math.hypot(dx, dy);
        if (r < Bc(0) * R) return this.noCenter ? null : { type: 'center' };
        for (const lf of this.leaves) if (lf.box && mx >= lf.box[0] && mx <= lf.box[0] + lf.box[2] && my >= lf.box[1] && my <= lf.box[1] + lf.box[3]) return { type: 'leaf', i: lf.i };
        const base = this.base();
        const norm = x => { x = (x - base) % TAU; if (x < 0) x += TAU; return x + base; };
        const a = norm(Math.atan2(dy, dx));
        if (!graph && this.ringA > 0.4 && r > F1 * R + 2) { const ab = Math.atan2(dy, dx); for (const L of this.ringHits) if (r >= L.r0 && r <= L.r1 && angDist(ab, L.a) <= L.da) return { type: 'label', id: L.id }; }
        if (r < F0 * R - 2) {
          for (const ar of this.arcs) if (r >= ar.rIn && r <= ar.rOut && ((ar.a1 - ar.a0) >= TAU - 1e-6 || (a >= ar.a0 && a <= ar.a1))) return { type: 'arc', id: ar.id };
          return null;
        }
        let best = null, bd = 1e9;
        for (const lf of this.leaves) {
          if (lf.ang == null) continue; let da = Math.abs(norm(lf.ang) - a); if (da > Math.PI) da = TAU - da;
          const dist = da * r; if (dist < bd && dist < Math.max(5, lf.px / 2) && r <= lf.r1 + 160) { bd = dist; best = lf; }
        }
        if (best) return { type: 'leaf', i: best.i };
        const ci = this.cellInfo;
        if (ci && r <= F1 * R + 4) {
          const col = Math.floor((a - base) / this.ws * ci.nCol), row0 = Math.floor((r / R - F0) / (F1 - F0) * ci.nRow), row = graph ? row0 : ci.nRow - 1 - row0;
          if (row >= 0 && row < ci.nRow && col >= 0 && col < ci.nCol) { const c = row * ci.nCol + col; if (ci.B.cnt[c]) return { type: 'cell', c, n: ci.B.cnt[c], i: ci.B.rep[c] }; }
        }
        return null;
      },
      nodeOfHit(h) { if (!h) return -1; if (h.type === 'arc' || h.type === 'label') return h.id; if ((h.type === 'leaf' || h.type === 'cell') && h.i >= 0) return this.tree.leafOf[h.i]; return -1; },
      childToward(id) {
        if (id < 0) return -1;
        const T = this.tree, f = T.nodes[this.focus], c = ancestorAt(T, id, f.depth + 1);
        return T.nodes[c].depth === f.depth + 1 && T.nodes[c].parent === this.focus ? c : -1;
      },
      click(h, dbl, ev) {
        if (!h) { select(-1); return; }
        if ((h.type === 'arc' || h.type === 'label') && ev && ev.shiftKey && !graph) { openLens(nodeLens(this, h.id)); return; }
        if (h.type === 'center') { if (this.lens && this.focus === this.home) return; const p = this.tree.nodes[this.focus].parent; if (p >= 0) this.zoomTo(p); else openPanel('right', 'run'); return; }
        if (h.type === 'arc' || h.type === 'label') { if (h.id !== this.focus) this.zoomTo(h.id); return; }
        if (h.type === 'leaf') { if (dbl) openItem(h.i, this.focusList()); else select(h.i); return; }
        if (h.type === 'cell') { const c = this.childToward(this.tree.leafOf[h.i]); if (c >= 0) this.zoomTo(c); }
      },
      focusList() { const nd = this.tree.nodes[this.focus]; return this.tree.order.subarray(nd.a, Math.min(nd.b, nd.a + 60000)); },
      zoomTo(id, ms) {
        if (this.tr) this.commit(true);
        if (id === this.focus) return;
        this.tr = { A: this.focus, B: id, p: 0, auto: true };
        const t0 = performance.now(), dur = ms || 560;
        cancelAnimationFrame(this.anim);
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) { this.commit(); return; }
        const tick = now => { if (!this.tr) return; this.tr.p = clamp((now - t0) / dur, 0, 1); invalidate(); if (this.tr.p >= 1) this.commit(); else this.anim = requestAnimationFrame(tick); };
        this.anim = requestAnimationFrame(tick);
      },
      commit(silent) { if (!this.tr) return; this.focus = this.tr.B; this.tr = null; cancelAnimationFrame(this.anim); if (!silent) onFocus(this); invalidate(); },
      wheel(e) {
        const dy = wheelDelta(e); if (!dy || !this.tree) return;
        if (this.tr && this.tr.auto) return;
        if (!this.tr) {
          if (dy < 0) {
            const f = this.tree.nodes[this.focus], h = this.hit(e.clientX, e.clientY);
            if (f.leaf) { if (h && h.type === 'leaf') { this.wacc -= dy; if (this.wacc > 260) { this.wacc = 0; openItem(h.i, this.focusList()); } } return; }
            const c = this.childToward(this.nodeOfHit(h)); if (c < 0) return;
            this.tr = { A: this.focus, B: c, p: 0 }; this.dir = -1;
          } else {
            const p = this.tree.nodes[this.focus].parent; if (p < 0 || (this.lens && this.focus === this.home)) return;
            this.tr = { A: this.focus, B: p, p: 0 }; this.dir = 1;
          }
        }
        this.tr.p += dy * this.dir * 0.0026;
        if (this.tr.p >= 1) this.commit(); else if (this.tr.p <= 0) this.tr = null;
        clearTimeout(this.snapT); this.snapT = setTimeout(() => this.snap(), 180);
        invalidate();
      },
      snap() {
        if (!this.tr || this.tr.auto) return;
        const to = this.tr.p > 0.38 ? 1 : 0, from = this.tr.p, t0 = performance.now(), dur = 220;
        this.tr.auto = true;
        const tick = now => { if (!this.tr) return; const u = clamp((now - t0) / dur, 0, 1); this.tr.p = lerp(from, to, u); invalidate(); if (u < 1) this.anim = requestAnimationFrame(tick); else if (to === 1) this.commit(); else { this.tr = null; invalidate(); } };
        this.anim = requestAnimationFrame(tick);
      },
      pan(dx, dy, c0, down) {
        const [cx, cy] = this.center();
        const a0 = Math.atan2(down.y - cy, down.x - cx), a1 = Math.atan2(down.y + dy - cy, down.x + dx - cx);
        this.rot = c0.rot + (a1 - a0); invalidate();
      },
      tip(h) {
        if (!h) return null;
        const T = this.tree;
        if (h.type === 'center') { const nd = T.nodes[this.focus]; if (this.lens && nd.id === this.home) return [this.lens.title, 'Lens · ' + fmt(nd.n) + ' items' + (this.lens.q ? ' · ' + this.lens.q : '')]; return nd.depth ? [nd.label, 'Click to go up · L lists everything here'] : ['Agents', S.tasks.map(t => t.name + ' · ' + t.state).join('\n') || 'No tasks']; }
        if (h.type === 'arc' || h.type === 'label') { const nd = T.nodes[h.id]; return [nd.label, fmt(nd.n) + ' items · ' + fmon(nd.t0) + (fmon(nd.t0) !== fmon(nd.t1) ? ' – ' + fmon(nd.t1) : '') + ' · click or scroll to open · shift-click = lens' + flagText(nd)]; }
        if (h.type === 'leaf') return itemTip(h.i);
        if (h.type === 'cell') { const i = h.i; return [fmt(h.n) + (h.n === 1 ? ' item' : ' items'), (i >= 0 ? workName(D.w[i]) + ' · ' + fmon(D.t[i]) + ' · ' : '') + 'click to zoom in here']; }
        return null;
      },
      key(h) { return h ? h.type + (h.id != null ? h.id : '') + (h.i != null ? ':' + h.i : '') + (h.c != null ? ':' + h.c : '') : ''; },
    };
    return v;
  }
  function wrap(ctx, s, w, maxLines) {
    const words = String(s).split(/\s+/), lines = []; let cur = '';
    for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (ctx.measureText(t).width <= w || !cur) cur = t; else { lines.push(cur); cur = wd; } }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) { const l = lines.slice(0, maxLines); l[maxLines - 1] = fitText(ctx, l[maxLines - 1] + ' ' + lines.slice(maxLines).join(' '), w); return l; }
    return lines.map(l => fitText(ctx, l, w));
  }
  function stateDot(ctx, x, y, state) {
    ctx.lineWidth = 1;
    if (state === 'running') { ctx.strokeStyle = C.a; ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.stroke(); ctx.fillStyle = C.a; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill(); }
    else if (state === 'failed' || state === 'queued' || state === 'waiting') { ctx.fillStyle = C.a; ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill(); }
    else { ctx.strokeStyle = state === 'done' ? C.a : C.d; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.stroke(); }
  }

  const Rings = Radial('rings', false);
  const Graph = Radial('graph', true);
  const views = { get rings() { return S.lenses.length ? LensView : Rings; }, graph: Graph };
  // the ring view you are working in: the active lens slice, or the whole archive
  const RV = () => (S.lenses.length ? (S.lenses[S.activeLens] || S.lenses[0]).v : Rings);
  const treeFor = i => { const v = RV(); return v.tree && v.tree.pos[i] >= 0 ? v.tree : Rings.tree; };

  // ───────────────────────────────────────── tools orbit: marks on a circle, names follow it
  const toolWork = t => {
    if (t._w !== undefined && t._wN === D.N) return t._w;
    const nm = t.name.toLowerCase().trim(); let w = D.workLow.indexOf(nm);
    if (w < 0 && nm.length >= 4) w = D.workLow.findIndex(x => x.startsWith(nm + ' ') || x === nm);
    t._w = w; t._wN = D.N; return w;
  };
  const Orbit = {
    hover: null, items: [],
    draw(ctx, cx, cy, F, rot, A) {
      this.items = [];
      const list = S.tools, G = ringGeo(); if (!list.length || !G.tools || A <= 0.02) return;
      const O = obstacles(), sel = S.sel, rT = G.rTool, rN0 = G.rTool + 13, lanes = [[], []];
      ctx.font = '400 10px ' + F;
      list.forEach((t, j) => {
        const a = -Math.PI / 2 + rot + (j + 0.5) / list.length * TAU, x = cx + Math.cos(a) * rT, y = cy + Math.sin(a) * rT;
        if (overlaps(O, x - 8, y - 8, 16, 16)) return;
        const can = sel >= 0 && compatible(t, sel), hv = this.hover && this.hover.tool === t;
        const ty = Patch.ports({ type: 'tool', tool: t.id }).ins[0], round = ty === 'text';
        ctx.globalAlpha = A;
        ctx.fillStyle = ty ? typeColor(ty) : (t.usable ? C.d : C.l);
        if (round) { ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill(); } else ctx.fillRect(x - 4.5, y - 4.5, 9, 9);
        if (can || (hv && this.hover.part === 'mark')) { ctx.strokeStyle = C.a; ctx.lineWidth = 2; if (round) { ctx.beginPath(); ctx.arc(x, y, 8.5, 0, TAU); ctx.stroke(); } else ctx.strokeRect(x - 7, y - 7, 14, 14); ctx.lineWidth = 1; }
        if ('letterSpacing' in ctx) ctx.letterSpacing = '1.1px';
        const lab = t.name.toUpperCase(), w = ctx.measureText(lab).width;
        let rN = rN0, lane = -1;
        for (let k = 0; k < 2 && lane < 0; k++) {
          const rr = rN0 + k * 13, half = (w / 2 + 6) / rr, nx = cx + Math.cos(a) * rr, ny = cy + Math.sin(a) * rr;
          const ex = Math.abs(Math.sin(a)) * w / 2 + Math.abs(Math.cos(a)) * 6, ey = Math.abs(Math.cos(a)) * w / 2 + Math.abs(Math.sin(a)) * 6;
          if (nx - ex < 6 || nx + ex > W - 6 || ny - ey < 50 || ny + ey > H - 6) continue;
          if (lanes[k].some(L => angDist(L[0], a) < L[1] + half) || overlaps(O, nx - ex, ny - ey, ex * 2, ey * 2)) continue;
          lane = k; rN = rr; lanes[k].push([a, half]);
        }
        let named = false;
        if (lane >= 0) {
          const proj = toolWork(t) >= 0, hn = hv && this.hover.part === 'name';
          ctx.fillStyle = hn ? C.t : t.usable || proj ? C.d : C.l; tanText(ctx, lab, cx, cy, rN, a); named = true;
          if (hn && proj) { ctx.strokeStyle = C.t; ctx.lineWidth = 1; const ro = rN + (Math.sin(a) > 0.0001 ? -7 : 7); ctx.beginPath(); ctx.arc(cx, cy, ro, a - w / 2 / rN, a + w / 2 / rN); ctx.stroke(); }
        }
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        this.items.push({ t, a, x, y, rN, da: named ? (w / 2 + 3) / rN : 0 });
      });
      ctx.globalAlpha = 1;
    },
    hit(mx, my, cx, cy) {
      for (const it of this.items) if (Math.abs(mx - it.x) < 9 && Math.abs(my - it.y) < 9) return { type: 'tool', tool: it.t, part: 'mark' };
      const r = Math.hypot(mx - cx, my - cy), a = Math.atan2(my - cy, mx - cx);
      for (const it of this.items) if (it.da && Math.abs(r - it.rN) < 8 && angDist(a, it.a) < it.da) return { type: 'tool', tool: it.t, part: 'name' };
      return null;
    },
    click(h, ev) {
      const w = toolWork(h.tool);
      if (h.part === 'name' && w >= 0) { if (ev && ev.shiftKey) openLens({ title: workName(w), q: 'work:"' + workName(w) + '"' }); else focusWork(w); return; }
      useTool(h.tool, S.sel);
    },
    tip(h) {
      const t = h.tool, w = toolWork(t);
      if (h.part === 'name' && w >= 0) return [t.name, 'Project · click to zoom into its material · shift-click = lens · the square opens the tool'];
      return [t.name, t.usable ? (S.sel >= 0 && compatible(t, S.sel) ? 'Click to open the selection' : 'Click to open') : 'No address yet · set it in config.json'];
    },
  };
  // zoom to the biggest place a project lives in the view you are in
  function focusWork(w) {
    const v = RV(), T = v.tree; let best = -1, bn = 0;
    for (const nd of T.nodes) if (nd.type === 'work' && nd.key === w && nd.n > bn) { best = nd.id; bn = nd.n; }
    if (best < 0 && v !== Rings) { openLens({ title: workName(w), q: 'work:"' + workName(w) + '"' }); return; }
    if (best < 0) return toast(workName(w) + ' has no files in this view');
    if (S.view !== 'rings' || S.item >= 0 || S.list >= 0) go('rings', {});
    v.zoomTo(best);
  }

  // ───────────────────────────────────────── flags: red triangles for what needs you
  const Flags = {
    els: [],
    sync(list) {
      const box = $('#flags'); if (!box) return;
      while (this.els.length < list.length) { const e = document.createElement('i'); box.appendChild(e); this.els.push(e); }
      this.els.forEach((e, j) => { const f = list[j]; if (!f) { e.style.display = 'none'; return; } e.style.display = ''; e.className = 'fl ' + f.f; e.style.left = f.x + 'px'; e.style.top = f.y + 'px'; });
    },
  };
  const DUE_DAYS = 14;
  const worksNamed = name => { const n = String(name || '').toLowerCase().trim(), out = []; if (!n) return out; D.workLow.forEach((w, j) => { if (w === n) out.push(j); }); return out; };
  const todaySec = () => { const d = S.live ? new Date() : new Date(window.S8DEMO.NOW * 1000); d.setHours(0, 0, 0, 0); return d / 1000; };
  function computeFlags() {
    const F = new Map(); S.flags = F; if (!D) return;
    const add = (w, c, text) => { let f = F.get(w); if (!f) F.set(w, (f = { wait: [], fail: [], due: [] })); f[c].push(text); };
    for (const t of S.tasks) {
      if (!t.work) continue;
      const ws = worksNamed(t.work);
      if (t.state === 'waiting') ws.forEach(w => add(w, 'wait', t.name + ' — ' + (t.need || 'needs you')));
      else if (t.state === 'failed') ws.forEach(w => add(w, 'fail', t.name + (t.last ? ' — ' + t.last : ' failed')));
    }
    if (Patch.P) for (const nd of Patch.P.nodes) if (nd.type === 'gate' && Patch.states[nd.id] === 'waiting') {
      const ws = new Set(); for (const i of Patch.upstream(nd.id)) ws.add(D.w[i]);
      ws.forEach(w => add(w, 'wait', 'Gate in “' + Patch.P.name + '” waits for you'));
    }
    const dl = new Map(), setMin = (w, ds) => { if (!dl.has(w) || ds < dl.get(w)) dl.set(w, ds); };
    for (const [i, x] of D.x) if (x.dl) (x.wk ? worksNamed(x.wk) : [D.w[i]]).forEach(w => setMin(w, x.dl));
    for (const [name, ds] of S.deadlines) for (const w of worksNamed(name)) { if (ds) dl.set(w, ds); else dl.delete(w); }
    S.dl = dl;
    const today = todaySec();
    for (const [w, ds] of dl) {
      const days = Math.round((new Date(ds + 'T00:00:00') / 1000 - today) / 86400);
      if (isNaN(days) || days > DUE_DAYS) continue;
      add(w, 'due', (days < 0 ? 'Deadline passed ' + (-days) + (days === -1 ? ' day ago' : ' days ago') : days === 0 ? 'Deadline today' : 'Deadline in ' + days + (days === 1 ? ' day' : ' days')) + ' · ' + ds);
    }
  }
  const flagText = nd => { const f = nd && nd.type === 'work' ? S.flags.get(nd.key) : null; if (!f) return ''; return ['wait', 'fail', 'due'].flatMap(c => f[c].map(t => '\n▲ ' + t)).join(''); };

  // ───────────────────────────────────────── lenses: up to four filters, each its own zoomable slice
  const LMAX = 4;
  const fmtShort = n => (n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'k' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(n));
  function lensColour(L) { const m = /^kind:([a-z0-9]+)$/i.exec(L.q || ''); const k = m ? D.kindIx[KALIAS[m[1]] || m[1]] : undefined; return k !== undefined ? C.k[k] : C.t; }
  function lensKind(L) { const m = /^kind:([a-z0-9]+)$/i.exec(L.q || ''); return m ? D.kindIx[KALIAS[m[1]] || m[1]] : undefined; }
  function lensItems(L) {
    const set = L.add;
    if (L.items) { if (!set.size) return L.items; const s2 = new Set(L.items); for (const i of set) s2.add(i); return Int32Array.from(s2); }
    const r = L.q ? computeMatch(L.q, null) : null, out = [];
    if (r) { for (let i = 0; i < D.N; i++) if (r.m[i] || set.has(i)) out.push(i); }
    else { for (const i of set) out.push(i); out.sort((a, b) => a - b); }
    return Int32Array.from(out);
  }
  function homeOf(T) { let id = 0; while (!T.nodes[id].leaf && T.nodes[id].kids && T.nodes[id].kids.length === 1) id = T.nodes[id].kids[0]; return id; }
  function buildLens(L) {
    const items = lensItems(L);
    const v = L.v || (L.v = Radial('rings', false));
    v.lens = L; v.set(buildTree(items, { name: L.title, leafMax: 30 })); v.home = v.focus = homeOf(v.tree); v.matchPrefix();
    L.n = items.length;
  }
  function layoutLenses() {
    const n = S.lenses.length, gap = n > 1 ? 0.035 : 0;
    S.lenses.forEach((L, j) => { const v = L.v; v.wa = j * TAU / n + gap / 2; v.ws = TAU / n - gap; v.rot = Rings.rot; v.noCenter = n > 1; v.hover = null; });
    if (S.activeLens >= n) S.activeLens = Math.max(0, n - 1);
  }
  let lensSeq = 1;
  async function openLens(spec) {
    if (!spec) return;
    if (S.lenses.length >= LMAX) { toast('Four lenses at most — close one first'); return; }
    const L = { id: 'L' + lensSeq++, title: spec.title || 'Lens', q: spec.q || '', items: spec.items || null, add: new Set(spec.add || []), gid: spec.gid || null, v: null };
    if (!L.items && !L.q && !L.add.size && !spec.empty) return;
    if (!L.items && L.q) { const r = computeMatch(L.q, null); if (!r.c && !L.add.size) { toast('Nothing matches “' + L.q + '”'); return; } if (r.c > 60000) { toast('Building the lens · ' + fmt(r.c) + ' items'); await nextFrame(); } }
    if (spec.empty) L.items = new Int32Array(0);
    buildLens(L);
    if (S.view !== 'rings' || S.item >= 0 || S.list >= 0) { S.view = 'rings'; S.item = -1; S.list = -1; }
    S.lenses.push(L); S.activeLens = S.lenses.length - 1; layoutLenses();
    render();
  }
  function closeLens(j) { S.lenses.splice(j, 1); layoutLenses(); render(); }
  function clearLenses() { if (!S.lenses.length) return; S.lenses = []; S.activeLens = 0; render(); }
  async function addToLens(j, i) {
    const L = S.lenses[j]; if (!L || i < 0) return;
    if (L.v.tree.pos[i] >= 0) { toast(titleOf(i) + ' is already in ' + L.title); return; }
    L.add.add(i); if (L.n > 60000) { toast('Adding to ' + L.title + ' …'); await nextFrame(); }
    buildLens(L); layoutLenses(); invalidate(); renderLegend(); if (S.right) renderRight();
    toast('Added to ' + L.title + (L.gid ? ' · save the group to keep it' : ''));
  }
  // a node as a search expression, so a lens or a saved group stays a rule instead of a frozen list
  function nodeExpr(T, id) {
    const parts = [], dir = [], qv = v2 => '"' + String(v2).replace(/"/g, '') + '"';
    for (const nid of chain(T, id).slice(1)) {
      const nd = T.nodes[nid];
      if (nd.type === 'sector') parts.push('in:' + qv(D.sectors[nd.key].name));
      else if (nd.type === 'work') parts.push('work:' + qv(D.works[nd.key].n));
      else if (nd.type === 'folder' && nd.label !== 'Files here') dir.push(nd.label);
      else if (nd.type === 'kind') parts.push('kind:' + D.kinds[nd.key]);
      else if (nd.type === 'year') parts.push('year:' + nd.label);
      else return null;
    }
    if (dir.length) parts.push('dir:' + qv(dir.join('/')));
    return parts.join(' ');
  }
  function nodeLens(v, id) {
    const T = v.tree, nd = T.nodes[id]; if (!nd) return null;
    const ex = v.lens && v.lens.items ? null : nodeExpr(T, id), base = v.lens ? v.lens.q : '';
    const title = nd.depth ? nd.label : v.lens ? v.lens.title : 'All';
    if (ex !== null && !(v.lens && v.lens.add.size)) { const q = [base, ex].filter(Boolean).join(' '); if (q) return { title, q }; }
    return { title, items: T.order.slice(nd.a, nd.b) };
  }
  const LensView = {
    name: 'rings',
    get tree() { return RV().tree; }, get focus() { return RV().focus; }, get tr() { return RV().tr; }, get home() { return RV().home; },
    get rot() { return Rings.rot; }, hover: null, flags: [],
    get ringA() { return Math.min(...S.lenses.map(L => L.v.ringA)); },
    R() { return Rings.R(); }, center() { return Rings.center(); },
    zoomTo(id, ms) { RV().zoomTo(id, ms); },
    up() { const v = RV(); if (v.focus === v.home) return; const p = v.tree.nodes[v.focus].parent; if (p >= 0) v.zoomTo(p); },
    sliceAt(mx, my) {
      const n = S.lenses.length; if (n <= 1) return 0;
      const [cx, cy] = this.center(); let a = Math.atan2(my - cy, mx - cx) - (-Math.PI / 2 + Rings.rot); a %= TAU; if (a < 0) a += TAU;
      return Math.min(n - 1, Math.floor(a / (TAU / n)));
    },
    draw(ctx) {
      const n = S.lenses.length, [cx, cy] = this.center(), R = this.R(), F = FONT();
      S.lenses.forEach((L, j) => { L.v.hover = this.hover && this.hover.s === j ? this.hover : null; L.v.draw(ctx); });
      this.flags = S.lenses.flatMap(L => L.v.flags);
      if (n > 1) this.drawCentre(ctx, R, cx, cy, F);
      if (this.drop != null && S.lenses[this.drop]) { const v = S.lenses[this.drop].v, rr = 0.985 * R + 3; ctx.strokeStyle = C.a; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, rr, v.base(), v.base() + v.ws); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, RING_F0 * R - 4, v.base(), v.base() + v.ws); ctx.stroke(); ctx.lineWidth = 1; }
    },
    drawCentre(ctx, R, cx, cy, F) {
      const n = S.lenses.length, r = BC_R(0) * R - 2, base = -Math.PI / 2 + Rings.rot;
      S.lenses.forEach((L, j) => {
        const a0 = base + j * TAU / n + 0.03, a1 = base + (j + 1) * TAU / n - 0.03, mid = (a0 + a1) / 2, v = L.v, nd = v.tree.nodes[v.shownFocus()];
        const hv = this.hover && this.hover.type === 'lcenter' && this.hover.s === j;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, a0, a1); ctx.closePath(); ctx.fillStyle = C.g; ctx.fill();
        if (hv) { ctx.strokeStyle = C.t; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1; }
        ctx.fillStyle = lensColour(L); ctx.beginPath(); ctx.arc(cx, cy, r - 2, a0 + 0.02, a1 - 0.02); ctx.lineWidth = 3; ctx.strokeStyle = lensColour(L); ctx.stroke(); ctx.lineWidth = 1;
        // slices are numbered: the key and the trail carry the names
        const lx = cx + Math.cos(mid) * r * 0.52, ly = cy + Math.sin(mid) * r * 0.52, wmax = n === 2 ? r * 1.1 : r * 0.7;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = j === S.activeLens ? C.t : C.d;
        ctx.font = '700 ' + Math.round(clamp(r * 0.32, 12, 18)) + 'px ' + F;
        ctx.fillText(String(j + 1), lx, ly - 6);
        ctx.font = '400 9px ' + F; ctx.fillStyle = C.d; if ('letterSpacing' in ctx) ctx.letterSpacing = '0.6px';
        ctx.fillText(fitText(ctx, fmtShort(nd.n) + (nd.id === v.home ? '' : ' ↑'), wmax), lx, ly + 9);
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      });
    },
    hit(mx, my) {
      const [cx, cy] = this.center(), R = this.R(), r = Math.hypot(mx - cx, my - cy), j = this.sliceAt(mx, my), L = S.lenses[j];
      if (!L) return null;
      if (S.lenses.length > 1 && r < BC_R(0) * R) return { type: 'lcenter', s: j };
      const h = L.v.hit(mx, my); if (h) h.s = j; return h;
    },
    click(h, dbl, ev) {
      if (!h) { select(-1); return; }
      if (h.s != null && h.s !== S.activeLens) { S.activeLens = h.s; renderTrail(); renderLegend(); if (S.right) renderRight(); }
      const v = S.lenses[h.s].v;
      if (h.type === 'lcenter') { if (v.focus !== v.home) { const p = v.tree.nodes[v.focus].parent; if (p >= 0) v.zoomTo(p); } invalidate(); return; }
      v.click(h, dbl, ev);
    },
    wheel(e) {
      const j = this.sliceAt(e.clientX, e.clientY); if (!S.lenses[j]) return;
      if (j !== S.activeLens) { S.activeLens = j; renderTrail(); renderLegend(); if (S.right) renderRight(); }
      S.lenses[j].v.wheel(e);
    },
    pan(dx, dy, c0, down) { Rings.pan(dx, dy, c0, down); for (const L of S.lenses) L.v.rot = Rings.rot; invalidate(); },
    tip(h) {
      if (!h) return null; const L = S.lenses[h.s]; if (!L) return null;
      if (h.type === 'lcenter') { const v = L.v; return [L.title, fmt(L.n) + ' items · ' + (L.q || 'picked files') + (v.focus !== v.home ? ' · click to go up' : '')]; }
      const t = L.v.tip(h); return t ? [t[0], (S.lenses.length > 1 ? L.title + ' · ' : '') + t[1]] : null;
    },
    key(h) { return h ? (h.s != null ? h.s + '/' : '') + h.type + (h.id != null ? h.id : '') + (h.i != null ? ':' + h.i : '') + (h.c != null ? ':' + h.c : '') : ''; },
  };
  function buildTrees() {
    const all = new Int32Array(D.N); for (let i = 0; i < D.N; i++) all[i] = i;
    Rings.set(buildTree(all, { name: 'All', leafMax: 30 }));
    const set = new Set(D.notes), edges = [], ek = new Set();
    for (const i of D.notes) for (const j of linkedOf(i)) { set.add(j); const a = Math.min(i, j), b = Math.max(i, j), key = a * 4194304 + b; if (a !== b && !ek.has(key)) { ek.add(key); edges.push(a, b); } }
    for (const [i, x] of D.x) if (x.sc >= 0) { set.add(i); set.add(x.sc); }
    const gt = buildTree(Int32Array.from([...set]), { name: 'Linked', leafMax: 40 });
    gt.edges = edges; gt.edgeCount = edges.length / 2;
    Graph.set(gt);
  }
  function onFocus(v) { Inset.draw(); renderTrail(); renderLegend(); if (S.right) renderRight(); }

  // ───────────────────────────────────────── colour key beside the rings
  const KEY_GROUPS = [['Text', ['note', 'skill', 'code', 'source']], ['Material', ['photo', 'ai', 'screen', 'video', 'audio', 'm3d', 'cad']]];
  function renderLegend() {
    const L = $('#legend'), v = views[S.mode];
    if (!v || !v.tree || !D) { L.hidden = true; return; }
    const nd = v.tree.nodes[v.focus], closed = keep.get('keyClosed', W < 760);
    L.hidden = false; L.textContent = ''; L.classList.toggle('closed', closed);
    const h = el('button', 'lgh'); h.setAttribute('aria-expanded', String(!closed));
    h.append(el('span', 'lab', 'Key'), el('span', 'cnt lab', fmt(nd.n) + ' items'), el('span', 'tog'));
    h.lastChild.style.cssText = 'width:16px;height:16px;position:relative;flex:none';
    h.lastChild.innerHTML = '<i style="position:absolute;left:3px;right:3px;top:7.5px;height:1px;background:var(--t)"></i>' + (closed ? '<i style="position:absolute;top:3px;bottom:3px;left:7.5px;width:1px;background:var(--t)"></i>' : '');
    h.onclick = () => { keep.set('keyClosed', !closed); renderLegend(); };
    L.appendChild(h);
    const ringsMode = S.mode === 'rings';
    if (ringsMode && S.lenses.length) {
      L.appendChild(el('span', 'lgg lab', 'Lenses · ' + S.lenses.length + ' / ' + LMAX));
      S.lenses.forEach((Ln, j) => {
        const r = el('div', 'lgl' + (j === S.activeLens ? ' on' : '')), b = el('button', 'lgln'), k = lensKind(Ln);
        const sq = el('span', 'sq' + (k !== undefined ? shp(k) : '')); sq.style.background = lensColour(Ln);
        b.append(el('span', 'no', String(j + 1)), sq, el('span', 'nm', Ln.title), el('span', 'n lab', fmt(Ln.n)));
        b.title = (Ln.q || 'Picked files') + (Ln.add.size ? ' · ' + Ln.add.size + ' added by hand' : '');
        b.onclick = () => { S.activeLens = j; renderTrail(); renderLegend(); if (S.right) renderRight(); invalidate(); };
        const sv = el('button', 'lgx lab', Ln.gid ? 'Saved' : 'Save'); sv.title = 'Keep this lens as a virtual group'; sv.onclick = () => saveLens(j);
        const x = el('button', 'lgx lab', '×'); x.setAttribute('aria-label', 'Close lens ' + Ln.title); x.onclick = () => closeLens(j);
        r.append(b, sv, x); L.appendChild(r);
      });
      const clr = el('button', 'lgclr lab', 'Close all lenses'); clr.onclick = clearLenses; L.appendChild(clr);
    }
    for (const [gname, kinds] of KEY_GROUPS) {
      const list = kinds.filter(kn => D.kindIx[kn] !== undefined && D.kindCount[D.kindIx[kn]]);
      if (!list.length) continue;
      L.appendChild(el('span', 'lgg lab', gname));
      for (const kn of list) {
        const isLens = ringsMode && S.lenses.some(Ln => Ln.q === 'kind:' + kn && !Ln.items);
        const k = D.kindIx[kn], n = nd.kc[k] || 0, r = el('button', 'lgr' + (S.hiddenK[k] ? ' off' : '') + (n || isLens ? '' : ' zero') + (isLens ? ' lens' : ''));
        const sq = el('span', 'sq' + shp(k)); sq.style.background = C.k[k];
        const bar = el('span', 'bar'), bi = el('i'); bi.style.width = (nd.n ? 100 * n / nd.n : 0).toFixed(1) + '%'; bi.style.background = C.k[k]; bar.appendChild(bi);
        r.append(sq, el('span', 'nm', KLAB[kn]), el('span', 'n lab', n ? fmt(n) : '—'), bar);
        r.title = ringsMode ? (isLens ? 'Close the ' + KLAB[kn] + ' lens' : 'Open ' + KLAB[kn] + ' as a lens') : (S.hiddenK[k] ? 'Show ' : 'Hide ') + KLAB[kn];
        r.onclick = () => (ringsMode ? toggleKindLens(k) : toggleKind(k));
        L.appendChild(r);
      }
    }
    if (ringsMode) {
      const sc = el('div', 'lgscale'); const ref = D.kindIx.ai !== undefined ? D.kindIx.ai : 0;
      [0, 1, 2].forEach(l => { const i = el('i'); i.style.background = C.tint[l][ref]; sc.appendChild(i); });
      sc.appendChild(el('span', 'lab dim', 'few → many files'));
      L.appendChild(sc);
      L.appendChild(el('span', 'lgn lab', 'Click a kind = lens · up to 4 split the circle · shift-click any ring or name = lens · black ring = sectors · colour band = kind mix · field = files, newest outside · outer names = projects and folders'));
    } else L.appendChild(el('span', 'lgn lab', 'Lines = links, coloured by the linked file · bundled through the rings'));
  }

  // ───────────────────────────────────────── canvas loop
  let raf = 0;
  const invalidate = () => { if (!raf) raf = requestAnimationFrame(frame); };
  function frame() {
    raf = 0;
    const v = views[S.mode];
    if (!v || !D) return;
    const d = DPR();
    fx.setTransform(d, 0, 0, d, 0, 0);
    fx.fillStyle = C.g; fx.fillRect(0, 0, W, H);
    v.draw(fx);
    if (S.mode === 'rings') { const [cx, cy] = Rings.center(); Orbit.draw(fx, cx, cy, FONT(), Rings.rot, 1); } else Orbit.items = [];
    Flags.sync(S.mode === 'rings' || S.mode === 'graph' ? v.flags || [] : []);
  }

  // ───────────────────────────────────────── inset: the whole archive, and where you are in it
  const Inset = {
    cv: $('#inset'),
    draw() {
      const show = D && Rings.tree && !S.lenses.length && ['rings', 'item', 'list'].includes(S.mode) && W >= 760 && !(S.mode === 'rings' && Rings.focus === 0 && !Rings.tr);
      this.cv.hidden = !show; $('#insetL').hidden = !show;
      if (!show) return;
      const dd = DPR(), w = 200, h = 136, cv = this.cv;
      if (cv.width !== w * dd) { cv.width = w * dd; cv.height = h * dd; }
      const c = cv.getContext('2d'); c.setTransform(dd, 0, 0, dd, 0, 0); c.fillStyle = C.g; c.fillRect(0, 0, w, h);
      const T = Rings.tree, cx = w / 2, cy = h / 2, R = 60, th = x => -Math.PI / 2 + Rings.rot + TAU * x;
      c.lineWidth = 1;
      for (const id of T.nodes[0].kids || []) {
        const s = T.nodes[id];
        annulus(c, cx, cy, R * 0.34, R * 0.6, th(s.x0) + 0.012, th(s.x1) - 0.012); c.fillStyle = C.b1; c.fill();
        let ka = th(s.x0) + 0.012; const kspan = th(s.x1) - th(s.x0) - 0.024;
        c.lineWidth = 3; for (const kn of GRID_ORDER) { const kk = D.kindIx[kn]; if (kk === undefined || !s.kc[kk]) continue; const da = kspan * s.kc[kk] / s.n; c.strokeStyle = C.k[kk]; c.beginPath(); c.arc(cx, cy, R * 0.6 - 1.5, ka, ka + da); c.stroke(); ka += da; } c.lineWidth = 1;
        for (const wid of s.kids || []) { const wk = T.nodes[wid]; if ((wk.x1 - wk.x0) * TAU * R < 1.2) continue; annulus(c, cx, cy, R * 0.63, R * 0.8, th(wk.x0) + 0.006, th(wk.x1) - 0.006); c.fillStyle = C.b2; c.fill(); }
      }
      const fid = S.mode === 'item' && S.item >= 0 ? T.leafOf[S.item] : S.mode === 'list' ? S.list : Rings.focus, f = T.nodes[fid];
      if (f && f.depth > 0) {
        const m = th((f.x0 + f.x1) / 2);
        c.strokeStyle = C.a; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, R * 0.88, th(f.x0), Math.max(th(f.x1), th(f.x0) + 0.03)); c.stroke();
        c.lineWidth = 1; c.beginPath(); c.moveTo(cx + Math.cos(m) * R * 0.86, cy + Math.sin(m) * R * 0.86); c.lineTo(cx + Math.cos(m) * R * 1.02, cy + Math.sin(m) * R * 1.02); c.stroke();
      }
      c.fillStyle = C.t; c.font = '700 9px ' + FONT(); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(fmt(D.N), cx, cy);
    },
  };

  // ───────────────────────────────────────── DOM views: list, field, item, year
  function renderDom() {
    dom.textContent = '';
    if (S.mode === 'list') listView();
    else if (S.mode === 'field') fieldView();
    else if (S.mode === 'item') itemView();
    else if (S.mode === 'year') yearView();
    else if (S.mode === 'patch') Patch.view();
  }
  function kindChips(counts) {
    const box = el('div', 'chips');
    GRID_ORDER.forEach(kn => {
      const k = D.kindIx[kn]; if (k === undefined || !counts[k]) return;
      const b = el('button', 'chip kc lab' + (S.hiddenK[k] ? '' : ' on'), KLAB[kn] + ' ' + fmt(counts[k]));
      b.title = S.hiddenK[k] ? 'Show ' + KLAB[kn] : 'Hide ' + KLAB[kn];
      b.onclick = () => toggleKind(k);
      box.appendChild(b);
    });
    return box;
  }
  function listView() {
    const T = RV().tree, nd = T.nodes[S.list] || T.nodes[0];
    const counts = new Uint32Array(D.kinds.length), all = [];
    for (let p = nd.a; p < nd.b; p++) { const i = T.order[p]; if (S.match && !S.match[i]) continue; counts[D.k[i]]++; if (!S.hiddenK[D.k[i]]) all.push(i); }
    const v = el('div', 'vw'), hd = el('div', 'vh');
    hd.appendChild(el('h1', null, nd.depth ? nd.label : 'Everything'));
    hd.appendChild(el('div', 'meta lab', fmt(nd.n) + ' items · ' + fmon(nd.t0) + ' – ' + fmon(nd.t1) + ' · the ring in focus as a list'));
    const cc = el('div', 'chips'), back = el('button', 'chip lab on', '◎ Back to the rings'); back.onclick = () => go('rings', { rf: S.list }); cc.appendChild(back); hd.appendChild(cc);
    hd.appendChild(kindChips(counts));
    v.appendChild(hd);
    const rank = new Int32Array(D.kinds.length); GRID_ORDER.forEach((k, j) => { if (D.kindIx[k] !== undefined) rank[D.kindIx[k]] = j; });
    all.sort((p, q) => rank[D.k[p]] - rank[D.k[q]] || D.t[q] - D.t[p]);
    const groups = []; let cur = null;
    for (const i of all) { if (!cur || cur.k !== D.k[i]) { cur = { k: D.k[i], items: [] }; groups.push(cur); } cur.items.push(i); }
    v.appendChild(gridScroller(groups, Int32Array.from(all), all.length ? null : 'Nothing here matches the search or the visible kinds.'));
    dom.appendChild(v);
  }
  function fieldView() {
    const list0 = matchList(), hk = S.hiddenK;
    const counts = new Uint32Array(D.kinds.length);
    const keepArr = new Int32Array(list0.length); let n = 0;
    for (let q = 0; q < list0.length; q++) { const i = list0[q]; counts[D.k[i]]++; if (!hk[D.k[i]]) keepArr[n++] = i; }
    const list = keepArr.subarray(0, n);
    const v = el('div', 'vw'), hd = el('div', 'vh');
    hd.appendChild(el('h1', null, S.date ? S.date.label : S.q ? 'Search' : 'Field'));
    hd.appendChild(el('div', 'meta lab', S.match ? fmt(S.mcount) + ' of ' + fmt(D.N) + ' items' + (S.q ? ' · “' + S.q + '”' : '') + ' · newest first' : fmt(D.N) + ' items · newest first'));
    if (S.date) { const c = el('div', 'chips'); const b = el('button', 'chip lab on', S.date.label + ' ×'); b.onclick = () => { S.date = null; runSearch(); }; c.appendChild(b); hd.appendChild(c); }
    hd.appendChild(kindChips(counts));
    v.appendChild(hd);
    v.appendChild(gridScroller([{ k: -1, items: list }], list, n ? null : 'No items match. Clear the search or show more kinds.'));
    dom.appendChild(v);
  }
  function gridScroller(groups, list, emptyMsg) {
    const sc = el('div', 'scroll'), inner = el('div', 'vgrid'); sc.appendChild(inner);
    if (emptyMsg) { sc.appendChild(el('p', 'empty', emptyMsg)); return sc; }
    const gap = 16, hdrH = 40;
    let cols = 4, tw = 180, th = 142, secs = [];
    const layout = () => {
      const avail = Math.max(200, sc.clientWidth - parseFloat(getComputedStyle(sc).paddingLeft) - parseFloat(getComputedStyle(sc).paddingRight));
      cols = Math.max(2, Math.floor((avail + gap) / (172 + gap))); tw = (avail - (cols - 1) * gap) / cols; th = tw / 1.6 + 30;
      let y = 8; secs = groups.map(g => { const hasH = g.k >= 0; const s = { g, y0: y, hdr: hasH ? hdrH : 0 }; y += s.hdr + Math.ceil(g.items.length / cols) * (th + gap) + (hasH ? 12 : 0); s.y1 = y; return s; });
      inner.style.height = (y + 120) + 'px';
    };
    const live = new Map();
    const paintRange = () => {
      const top = sc.scrollTop - 300, bot = sc.scrollTop + sc.clientHeight + 300, need = new Set();
      for (const s of secs) {
        if (s.y1 < top || s.y0 > bot) continue;
        if (s.hdr) {
          const key = 'h' + s.g.k; need.add(key);
          if (!live.has(key)) { const h = el('div', 'gh'); h.style.top = s.y0 + 'px'; const kn = D.kinds[s.g.k]; const sw = el('span', 'sw' + shp(s.g.k)); sw.style.background = C.k[s.g.k]; h.append(sw, el('span', 'cl', KLAB[kn]), el('span', 'lab dim', fmt(s.g.items.length))); inner.appendChild(h); live.set(key, h); }
        }
        const r0 = Math.max(0, Math.floor((top - s.y0 - s.hdr) / (th + gap))), r1 = Math.min(Math.ceil(s.g.items.length / cols), Math.ceil((bot - s.y0 - s.hdr) / (th + gap)));
        for (let r = r0; r < r1; r++) for (let c = 0; c < cols; c++) {
          const q = r * cols + c; if (q >= s.g.items.length) break;
          const i = s.g.items[q]; need.add(i);
          let t = live.get(i);
          if (!t) { t = makeTile(i, tw, list); inner.appendChild(t); live.set(i, t); }
          t.style.left = (c * (tw + gap)) + 'px'; t.style.top = (s.y0 + s.hdr + r * (th + gap)) + 'px'; t.style.width = tw + 'px';
        }
      }
      for (const [k, t] of live) if (!need.has(k)) { t.remove(); live.delete(k); }
    };
    let ticking = false;
    sc.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; paintRange(); }); } }, { passive: true });
    const ro = new ResizeObserver(() => { const old = cols; layout(); if (old !== cols) { for (const t of live.values()) t.remove(); live.clear(); } paintRange(); });
    ro.observe(sc);
    requestAnimationFrame(() => { layout(); paintRange(); });
    return sc;
  }
  function makeTile(i, tw, list) {
    const kn = kindOf(i), b = el('button', 'tile' + (i === S.sel ? ' sel' : ''));
    b.dataset.i = i;
    const im = el('div', 'im');
    const textTile = () => { im.textContent = ''; const tx = el('div', 'tx'); tx.append(el('span', 'lab dim', KONE[kn]), el('b', null, titleOf(i)), el('span', 'ext', extOf(i).toUpperCase())); im.appendChild(tx); };
    const visual = IMG_KINDS.has(kn) || kn === 'video' || ((kn === 'm3d' || kn === 'cad') && (S.live ? S.caps.quicklook : true));
    if (visual) {
      if (S.live) { const img = new Image(); img.loading = 'lazy'; img.decoding = 'async'; img.alt = ''; img.src = API.thumb(i); img.onerror = textTile; im.appendChild(img); }
      else { const cv = document.createElement('canvas'), d = DPR(); cv.width = Math.round(tw * d); cv.height = Math.round(tw / 1.6 * d); const c = cv.getContext('2d'); c.scale(d, d); window.S8DEMO.paint(c, i, tw, tw / 1.6, kn, workName(D.w[i])); im.appendChild(cv); }
    } else textTile();
    const kd = el('span', 'kd'); kd.style.background = C.k[D.k[i]]; im.appendChild(kd);
    const cap = el('div', 'cap'); cap.append(el('span', null, kn === 'note' || kn === 'skill' ? titleOf(i) : D.n[i]), el('span', 'dim', fmon(D.t[i])));
    b.append(im, cap);
    b.title = D.n[i];
    b.onclick = () => select(i);
    b.ondblclick = () => openItem(i, list);
    b.onkeydown = e => { if (e.key === 'Enter') { e.stopPropagation(); openItem(i, list); } };
    return b;
  }
  function itemView() {
    const i = S.item, kn = kindOf(i), ext = extOf(i);
    const v = el('div', 'item'), stage = el('div', 'stage'), bar = el('div', 'ibar');
    const T = treeFor(i), leaf = T.nodes[T.leafOf[i]];
    const list = S.ctxList && S.ctxList.indexOf(i) >= 0 ? S.ctxList : T.order.subarray(leaf.a, leaf.b);
    S.ctxList = list;
    const pos = list.indexOf(i);
    const bp = el('button', 'nav p', '‹'), bn = el('button', 'nav n', '›');
    bp.setAttribute('aria-label', 'Previous'); bn.setAttribute('aria-label', 'Next');
    bp.onclick = () => stepItem(-1); bn.onclick = () => stepItem(1);
    bp.disabled = pos <= 0; bn.disabled = pos >= list.length - 1;
    stage.append(bp, bn);
    const content = el('div'); content.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;min-height:0';
    stage.appendChild(content);
    const big3 = () => { const c = el('div', 'card big3'); c.append(el('span', 'lab dim', KONE[kn]), el('div', 'ext', ext.toUpperCase() || '—'), el('div', 'selname', titleOf(i)), el('div', 'dim', 'The deepest zoom is the tool itself — open it below.')); return c; };
    if (S.live) {
      if (IMG_KINDS.has(kn)) { const img = new Image(); img.alt = D.n[i]; img.src = ['heic', 'heif', 'dng', 'cr2', 'cr3', 'nef', 'arw', 'raf', 'orf', 'rw2', 'tif', 'tiff'].includes(ext) ? API.thumb(i) : API.file(i); img.onerror = () => { content.textContent = ''; content.appendChild(big3()); }; content.appendChild(img); }
      else if (kn === 'video') { const vd = document.createElement('video'); vd.src = API.file(i); vd.controls = true; vd.muted = true; vd.loop = true; vd.playsInline = true; vd.autoplay = true; content.appendChild(vd); }
      else if (kn === 'audio' && ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aif', 'aiff'].includes(ext)) { const c = big3(); const au = document.createElement('audio'); au.src = API.file(i); au.controls = true; c.appendChild(au); content.appendChild(c); }
      else if (ext === 'pdf') { const fr = document.createElement('iframe'); fr.src = API.file(i); fr.title = D.n[i]; content.appendChild(fr); }
      else if (kn === 'note' || kn === 'skill' || ['txt', 'html', 'htm', 'py', 'jsx', 'tsx', 'glsl', 'frag', 'tex'].includes(ext)) {
        const c = el('div', 'card doc'); c.textContent = 'Loading …'; content.appendChild(c);
        fetch(API.url('/api/text?i=' + i)).then(r => r.text()).then(txt => { c.textContent = ''; if (kn === 'note' || kn === 'skill') { const m = el('div', 'md'); m.innerHTML = mdRender(txt); bindMd(m); c.appendChild(m); } else { const pre = el('pre'); pre.textContent = txt; c.appendChild(pre); } }).catch(() => { c.textContent = 'Could not read the file.'; });
      } else { const c = big3(); if (kn === 'm3d' || kn === 'cad') { const img = new Image(); img.src = API.thumb(i); img.style.cssText = 'max-width:100%;border:1px solid var(--l)'; img.onerror = () => img.remove(); c.insertBefore(img, c.firstChild); } content.appendChild(c); }
    } else {
      if (VISUAL.has(kn)) {
        const cw = Math.min(1200, W - 200), chh = Math.min(H - 300, cw / 1.6), cv = document.createElement('canvas'), d = DPR();
        const ww = Math.max(240, Math.min(cw, chh * 1.6)), hh = ww / 1.6;
        cv.width = ww * d; cv.height = hh * d; cv.className = 'big'; cv.style.width = ww + 'px'; cv.style.height = hh + 'px';
        const c = cv.getContext('2d'); c.scale(d, d); window.S8DEMO.paint(c, i, ww, hh, kn, workName(D.w[i])); content.appendChild(cv);
      } else if (kn === 'note' || kn === 'skill') { const c = el('div', 'card doc'), m = el('div', 'md'); m.innerHTML = mdRender(kn === 'skill' ? '# ' + titleOf(i) + '\n\n' + ((D.x.get(i) || {}).de || '') + '\n\nSample skill.' : window.S8DEMO.noteText(D, i)); bindMd(m); c.appendChild(m); content.appendChild(c); }
      else { const c = big3(); c.appendChild(el('div', 'dim', 'Sample data — run the bridge to read your real files.')); content.appendChild(c); }
    }
    const left = el('div'); left.style.minWidth = '0';
    left.append(el('div', 'nm', titleOf(i)), el('div', 'lab dim', [KONE[kn], D.sectors[D.s[i]].name, workName(D.w[i]), fdate(D.t[i]), fsize(D.z[i]), (pos + 1) + ' / ' + fmt(list.length)].join(' · ')));
    const pr = promptOf(i); if (pr) { const p = el('div', 'dim'); p.style.cssText = 'margin-top:6px;max-width:760px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'; p.textContent = 'Prompt · ' + pr; p.title = pr; left.appendChild(p); }
    const acts = el('div', 'acts');
    const cmp = S.tools.filter(t => compatible(t, i));
    if (cmp.length) acts.appendChild(el('span', 'lab dim', 'Open in')).style.alignSelf = 'center';
    cmp.forEach((t, j) => { const b = el('button', 'btn cl' + (j === 0 ? ' solid' : ''), t.name); b.onclick = () => useTool(t, i); acts.appendChild(b); });
    const mk = (label, fn) => { const b = el('button', 'btn cl', label); b.onclick = fn; acts.appendChild(b); };
    mk('Default app', () => openDefault(i)); mk('Reveal', () => revealItem(i)); mk('+ Patch', () => Patch.addMaterial(i)); mk('Note', () => { select(i); openPanel('right', 'sel'); });
    bar.append(left, acts);
    v.append(stage, bar);
    dom.appendChild(v);
  }
  function stepItem(dlt) {
    const list = S.ctxList; if (!list) return; const pos = list.indexOf(S.item), j = pos + dlt;
    if (j < 0 || j >= list.length) return;
    S.item = list[j]; S.sel = S.item; render();
  }
  function mdRender(src) {
    src = String(src).replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
    const lines = src.split(/\r?\n/), out = []; let inCode = false, list = false, para = [];
    const flush = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } if (list) { out.push('</ul>'); list = false; } };
    for (const ln of lines) {
      if (/^```/.test(ln)) { flush(); out.push(inCode ? '</code></pre>' : '<pre><code>'); inCode = !inCode; continue; }
      if (inCode) { out.push(esc(ln) + '\n'); continue; }
      const h = ln.match(/^(#{1,3})\s+(.*)$/); if (h) { flush(); out.push('<h' + h[1].length + '>' + inline(h[2]) + '</h' + h[1].length + '>'); continue; }
      const li = ln.match(/^\s*(?:[-*+]|\d+\.)\s+(.*)$/); if (li) { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } if (!list) { out.push('<ul>'); list = true; } out.push('<li>' + inline(li[1]) + '</li>'); continue; }
      if (!ln.trim()) { flush(); continue; }
      if (list) { out.push('</ul>'); list = false; }
      para.push(ln);
    }
    flush(); if (inCode) out.push('</code></pre>');
    return out.join('');
  }
  function inline(s) {
    s = esc(s);
    s = s.replace(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, (m0, t) => { const i = resolveLink(t); if (i !== undefined && IMG_KINDS.has(kindOf(i))) return S.live ? '<img alt="" src="' + API.file(i) + '">' : '<a class="wl" data-i="' + i + '">▣ ' + esc(t) + '</a>'; return '<a class="wl' + (i === undefined ? ' miss' : '') + '" data-t="' + t + '">' + t + '</a>'; });
    s = s.replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (m0, t, a) => { const i = resolveLink(t.replace(/#.*$/, '')); return '<a class="wl' + (i === undefined ? ' miss' : '') + '" data-t="' + t + '">' + (a || t) + '</a>'; });
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/(^|\s)#([\p{L}\p{N}_\-/]+)/gu, '$1<span class="tag">#$2</span>');
    return s;
  }
  function bindMd(root) {
    root.addEventListener('click', e => {
      const a = e.target.closest('a.wl'); if (!a) return; e.preventDefault();
      const i = a.dataset.i !== undefined ? +a.dataset.i : resolveLink(String(a.dataset.t).replace(/#.*$/, ''));
      if (i === undefined || isNaN(i)) toast('No item named “' + a.dataset.t + '” in the index'); else openItem(i);
    });
  }
  function yearView() {
    const now = S.live ? new Date() : new Date(window.S8DEMO.NOW * 1000);
    if (!S.year) S.year = now.getFullYear();
    const y = S.year, t0 = new Date(y, 0, 1) / 1000, t1 = new Date(y + 1, 0, 1) / 1000, K = D.kinds.length;
    const cnt = new Uint32Array(52), ck = new Uint32Array(52 * K), works = Array.from({ length: 52 }, () => new Map());
    const cellOf = t => { const d = new Date(t * 1000), m = d.getMonth(), day = d.getDate(), q = Math.floor(m / 3); return day >= 29 ? q * 13 + 12 : q * 13 + (m % 3) * 4 + Math.floor((day - 1) / 7); };
    const m = S.match, hk = S.hiddenK;
    for (let i = 0; i < D.N; i++) { const t = D.t[i]; if (t < t0 || t >= t1 || hk[D.k[i]] || (m && !m[i])) continue; const c = cellOf(t); cnt[c]++; ck[c * K + D.k[i]]++; const mw = works[c]; mw.set(D.w[i], (mw.get(D.w[i]) || 0) + 1); }
    const nowCell = now.getFullYear() === y ? cellOf(now / 1000) : -1;
    const dls = Array.from({ length: 52 }, () => []);
    for (const [w, ds] of S.dl) { const t = new Date(ds + 'T12:00:00') / 1000; if (t >= t0 && t < t1) dls[cellOf(t)].push(w); }
    const max = Math.max(1, ...cnt);
    const v = el('div', 'vw'), hd = el('div', 'vh');
    const yh = el('div', 'yhead'); const bp = el('button', 'fc cl', '‹'), bn = el('button', 'fc cl', '›'), h1 = el('h1', null, String(y));
    bp.onclick = () => { S.year--; renderDom(); }; bn.onclick = () => { S.year++; renderDom(); }; bp.setAttribute('aria-label', 'Previous year'); bn.setAttribute('aria-label', 'Next year');
    yh.append(bp, h1, bn); hd.appendChild(yh);
    hd.appendChild(el('div', 'meta lab', 'Four quarters · 3 months × 4 weeks + one free week · days 29–31 fall into the free week · ' + fmt(cnt.reduce((a, b) => a + b, 0)) + ' items' + (S.match ? ' matching' : '')));
    v.appendChild(hd);
    const box = el('div', 'year');
    for (let q = 0; q < 4; q++) {
      const g = el('div', 'yq');
      g.appendChild(el('div', 'ql lab', 'Q' + (q + 1)));
      for (let mi = 0; mi < 3; mi++) g.appendChild(el('div', 'ym cl', MON[q * 3 + mi].toUpperCase()));
      g.appendChild(el('div', 'yfree cl', 'FREE'));
      g.appendChild(el('div'));
      for (let c = 0; c < 13; c++) {
        const cell = q * 13 + c, free = c === 12, b = el('button', 'yc' + (free ? ' free' : '') + (cell === nowCell ? ' now' : ''));
        const label = free ? 'Days 29–31' : 'W' + ((c % 4) + 1) + ' · ' + (1 + (c % 4) * 7) + '–' + ((c % 4) === 3 ? 28 : 7 + (c % 4) * 7);
        b.appendChild(el('span', 'wk lab', label));
        if (cnt[cell]) {
          b.appendChild(el('span', 'disp', fmt(cnt[cell])));
          const strip = el('span', 'strip');
          GRID_ORDER.forEach(kn => { const k = D.kindIx[kn]; if (k === undefined) return; const v2 = ck[cell * K + k]; if (!v2) return; const sg = el('i'); sg.style.background = C.k[k]; sg.style.width = (100 * v2 / cnt[cell]) + '%'; strip.appendChild(sg); });
          b.appendChild(strip);
          const top = [...works[cell].entries()].sort((a, c2) => c2[1] - a[1]).slice(0, 2).map(e => workName(e[0]));
          b.appendChild(el('span', 'tw', top.join(' · ')));
          b.style.background = 'color-mix(in srgb, var(--t) ' + Math.round(Math.sqrt(cnt[cell] / max) * 7) + '%, ' + (free ? 'var(--s)' : 'transparent') + ')';
        }
        for (const w of dls[cell]) { const dd = el('span', 'ydl lab'); dd.append(el('i', 'fl due'), el('span', null, workName(w))); b.appendChild(dd); }
        b.title = (cnt[cell] ? fmt(cnt[cell]) + ' items — click to see them' : 'Nothing dated in this cell') + dls[cell].map(w => '\n▲ Deadline · ' + workName(w) + ' · ' + S.dl.get(w)).join('');
        b.onclick = () => {
          const mm = q * 3, ranges = free ? [0, 1, 2].map(o => [new Date(y, mm + o, 29) / 1000, new Date(y, mm + o + 1, 1) / 1000]) : [[new Date(y, mm + Math.floor(c / 4), 1 + (c % 4) * 7) / 1000, new Date(y, mm + Math.floor(c / 4), (c % 4) === 3 ? 29 : 8 + (c % 4) * 7) / 1000]];
          const lab = free ? 'Free week · Q' + (q + 1) + ' ' + y : MON[mm + Math.floor(c / 4)] + ' ' + label.split(' · ')[1] + ' · ' + y;
          S.date = { label: lab, ranges }; runSearch(); go('field', {});
        };
        g.appendChild(b);
      }
      box.appendChild(g);
    }
    v.appendChild(box);
    dom.appendChild(v);
  }

  // ───────────────────────────────────────── patch room: wire material into tools, gates, agents and notes
  const TYPE_OF_KIND = { photo: 'image', ai: 'image', screen: 'image', video: 'video', audio: 'audio', m3d: '3d', cad: '3d', note: 'text', skill: 'text', source: 'text', code: 'text' };
  const EXT_TYPE = {};
  [['image', 'png jpg jpeg webp heic heif gif tif tiff avif'], ['video', 'mp4 mov m4v webm mkv avi'], ['audio', 'wav mp3 aif aiff flac ogg m4a bwproject als'],
    ['3d', 'blend glb gltf obj fbx usd usdz usda usdc abc stl ply uproject umap splat dwg dxf 3dm ifc skp'], ['text', 'md txt pdf epub html jsx tsx py glsl'], ['any', 'toe tox']]
    .forEach(([t, l]) => l.split(' ').forEach(e => { EXT_TYPE[e] = t; }));
  const typeColor = t => (t === 'image' ? C.k[D.kindIx.ai] : t === 'video' ? C.k[D.kindIx.video] : t === 'audio' ? C.k[D.kindIx.audio] : t === '3d' ? C.k[D.kindIx.m3d] : t === 'text' ? C.t : C.d);
  const compat = (a, b) => a === b || a === 'any' || b === 'any';
  const Patch = {
    list: [], cur: 0, sel: null, selWire: -1, cam: { x: 40, y: 20, s: 1 }, states: {}, seq: 1,
    get P() { return this.list[this.cur]; },
    colour(nd) {
      if (nd.type === 'material') return C.k[D.k[nd.i]];
      if (nd.type === 'gate') return C.a;
      if (nd.type === 'tool') { const ty = this.ports(nd).ins[0]; return ty ? typeColor(ty) : C.d; }
      return C.t;
    },
    tidy() {
      const P = this.P, depth = new Map(P.nodes.map(n => [n.id, 0]));
      for (let pass = 0; pass < P.nodes.length; pass++) { let moved = false; for (const w of P.wires) { const d2 = depth.get(w.a) + 1; if (d2 > depth.get(w.b)) { depth.set(w.b, d2); moved = true; } } if (!moved) break; }
      const cols = new Map(); for (const n of P.nodes) { const d2 = depth.get(n.id); if (!cols.has(d2)) cols.set(d2, []); cols.get(d2).push(n); }
      for (const [d2, list] of cols) {
        list.sort((a, b) => a.y - b.y); let y = 0;
        for (const n of list) { n.x = d2 * 264; n.y = y; const e2 = this.world && this.world.querySelector('.pn[data-id="' + n.id + '"]'); y += Math.ceil(((e2 ? e2.offsetHeight : 150) + 24) / 24) * 24; }
      }
      this.cam = { x: 40, y: 20, s: 1 }; this.persist(); this.view();
    },
    duplicate(id) { const P = this.P, n = P.nodes.find(x => x.id === id); if (!n) return; const c = Object.assign({}, n, { id: this.nid(), x: n.x + 24, y: n.y + 24 }); if (c.type === 'gate') c.accepted = false; P.nodes.push(c); this.sel = c.id; this.persist(); this.view(); },
    tool(id) { return S.tools.find(x => x.id === id); },
    ports(nd) {
      if (nd.type === 'material') return { ins: [], outs: [TYPE_OF_KIND[kindOf(nd.i)] || 'any'] };
      if (nd.type === 'tool') { const t = this.tool(nd.tool); const ins = t ? [...new Set((t.exts || []).map(e => EXT_TYPE[e] || 'any'))] : []; return { ins, outs: t && t.outputs ? t.outputs : ins.length ? [ins[0]] : ['any'] }; }
      if (nd.type === 'task') return { ins: ['any'], outs: ['text'] };
      if (nd.type === 'gate') return { ins: ['any'], outs: ['any'] };
      if (nd.type === 'note') return { ins: ['any'], outs: ['text'] };
      return { ins: [], outs: [] };
    },
    title(nd) {
      if (!nd) return '?';
      if (nd.type === 'material') return titleOf(nd.i);
      if (nd.type === 'tool') { const t = this.tool(nd.tool); return t ? t.name : nd.tool; }
      if (nd.type === 'task') { const t = S.tasks.find(x => x.id === nd.task); return t ? t.name : nd.task; }
      if (nd.type === 'gate') return nd.label || 'Gate · you decide';
      if (nd.type === 'note') return nd.title || 'Collect → note';
      return nd.type;
    },
    newPatch(name) { const p = { id: 'p' + Date.now().toString(36), name: name || 'Patch ' + (this.list.length + 1), nodes: [], wires: [] }; this.list.push(p); this.cur = this.list.length - 1; return p; },
    nid() { return 'n' + (this.seq++) + Math.random().toString(36).slice(2, 5); },
    spot() { const n = this.P.nodes.length; return { x: Math.round((-this.cam.x + 60 + (n % 4) * 240) / this.cam.s), y: Math.round((-this.cam.y + 60 + Math.floor(n / 4) * 170 + (n % 2) * 24) / this.cam.s) }; },
    add(spec) { if (!this.P) this.newPatch(); const nd = Object.assign({ id: this.nid() }, this.spot(), spec); this.P.nodes.push(nd); this.sel = nd.id; this.persist(); if (S.mode === 'patch') this.view(); return nd; },
    addMaterial(i) { if (i < 0) return; this.add({ type: 'material', i, key: pathOf(i) }); toast('Added to the patch · ' + titleOf(i)); },
    remove(id) { const P = this.P; P.nodes = P.nodes.filter(n => n.id !== id); P.wires = P.wires.filter(w => w.a !== id && w.b !== id); this.sel = null; this.persist(); this.view(); },
    connect(a, ap, b, bp) {
      const P = this.P, A = P.nodes.find(n => n.id === a), B = P.nodes.find(n => n.id === b);
      if (!A || !B || a === b) return false;
      const ta = this.ports(A).outs[ap], tb = this.ports(B).ins[bp];
      if (!compat(ta, tb)) { toast(this.title(B) + ' takes ' + (this.ports(B).ins.join(' or ') || 'nothing') + ' — ' + this.title(A) + ' gives ' + ta + '. Put a tool between them that turns ' + ta + ' into ' + tb + '.'); return false; }
      if (P.wires.some(w => w.a === a && w.ap === ap && w.b === b && w.bp === bp)) return false;
      if (this.reaches(b, a)) { toast('That wire would make a loop.'); return false; }
      P.wires.push({ a, ap, b, bp }); this.persist(); return true;
    },
    reaches(from, to) { const P = this.P, seen = new Set(), st = [from]; while (st.length) { const x = st.pop(); if (x === to) return true; if (seen.has(x)) continue; seen.add(x); for (const w of P.wires) if (w.a === x) st.push(w.b); } return false; },
    persist() {
      if (S.live) { clearTimeout(this.saveT); this.saveT = setTimeout(() => { if (this.P) API.post('/api/patch', { patch: this.P }); }, 600); }
      else keep.set('patches', this.list);
    },
    async load() {
      let list = null;
      if (S.live) { try { const r = await API.get('/api/patches'); list = r.patches; } catch (e) { list = null; } }
      else list = keep.get('patches', null);
      if (list && list.length) this.list = list.map(p => ({ ...p, nodes: p.nodes.filter(n => this.resolve(n)) }));
      else { const sp = this.sample(); if (!sp.nodes.length) { sp.name = 'Patch 1'; sp.id = 'p1'; } this.list = [sp]; }
      this.cur = 0;
    },
    resolve(n) {
      if (n.type !== 'material') return true;
      if (n.i >= 0 && n.i < D.N && pathOf(n.i) === n.key) return true;
      const name = String(n.key || '').split('/').pop();
      for (let i = 0; i < D.N; i++) if (D.n[i] === name && pathOf(i) === n.key) { n.i = i; return true; }
      return false;
    },
    sample() {
      const p = { id: 'sample', name: 'Mars crater city · scene pipeline', nodes: [], wires: [] };
      const w = D.works.findIndex(x => x.n === 'Mars crater city');
      const pick = (kn, skip) => { if (w < 0) return -1; const st = D.byWork.start, it = D.byWork.items; let c = 0; for (let q = st[w]; q < st[w + 1]; q++) { const i = it[q]; if (kindOf(i) === kn && c++ >= (skip || 0)) return i; } return -1; };
      const ai1 = pick('ai', 3), ai2 = pick('ai', 40), ai3 = pick('ai', 90), m3 = pick('m3d', 0);
      const note = D.notes.find(i => /street plan rules/.test(D.n[i]));
      const N = spec => { const n = Object.assign({ id: 's' + p.nodes.length }, spec); p.nodes.push(n); return n.id; };
      if (ai1 < 0) return p;
      const a = N({ type: 'material', i: ai1, key: pathOf(ai1), x: 0, y: 0 });
      const g = N({ type: 'gate', label: 'Pick the base image', x: 250, y: 30 });
      const sc = N({ type: 'tool', tool: 'sc3ne', x: 500, y: 10 });
      const cu = N({ type: 'tool', tool: 'cutout', x: 750, y: 30 });
      p.wires.push({ a, ap: 0, b: g, bp: 0 }, { a: g, ap: 0, b: sc, bp: 0 }, { a: sc, ap: 0, b: cu, bp: 0 });
      if (m3 >= 0) { const m = N({ type: 'material', i: m3, key: pathOf(m3), x: 0, y: 250 }); const bl = N({ type: 'tool', tool: 'blender', x: 250, y: 270 }); p.wires.push({ a: m, ap: 0, b: bl, bp: 0 }); }
      const nt = N({ type: 'note', title: 'Mars crater city — selected references', x: 500, y: 430 });
      [ai2, ai3].forEach((i, j) => { if (i >= 0) { const m = N({ type: 'material', i, key: pathOf(i), x: 0, y: 440 + j * 180 }); p.wires.push({ a: m, ap: 0, b: nt, bp: 0 }); } });
      if (note !== undefined) { const m = N({ type: 'material', i: note, key: pathOf(note), x: 250, y: 560 }); p.wires.push({ a: m, ap: 0, b: nt, bp: 0 }); }
      const tk = N({ type: 'task', task: 'test', x: 750, y: 450 }); p.wires.push({ a: nt, ap: 0, b: tk, bp: 0 });
      return p;
    },
    view() {
      if (S.mode !== 'patch') return;
      dom.textContent = '';
      if (!this.P) this.newPatch('Patch 1');
      const P = this.P, v = el('div', 'vw patchv');
      const tb = el('div', 'ptb');
      const st = el('div', 'stepper'); const pa = el('button', 'fc cl', '‹'), pb = el('button', 'fc cl', '›'), nm = el('input', 'pname');
      nm.value = P.name; nm.id = 'patch-name'; nm.setAttribute('aria-label', 'Patch name');
      pa.setAttribute('aria-label', 'Previous patch'); pb.setAttribute('aria-label', 'Next patch');
      pa.onclick = () => { this.cur = (this.cur + this.list.length - 1) % this.list.length; this.sel = null; this.view(); renderTrail(); };
      pb.onclick = () => { this.cur = (this.cur + 1) % this.list.length; this.sel = null; this.view(); renderTrail(); };
      nm.onchange = () => { P.name = nm.value.trim() || P.name; this.persist(); renderTrail(); };
      st.append(pa, nm, pb); tb.appendChild(st);
      const mkb = (lab, fn, cls) => { const b = el('button', 'btn cl' + (cls ? ' ' + cls : ''), lab); b.onclick = fn; tb.appendChild(b); return b; };
      mkb('Run', () => this.run(), 'solid'); mkb('Tidy', () => this.tidy()); mkb('+ New patch', () => { this.newPatch(); this.persist(); this.view(); renderTrail(); }); mkb('Library  [', () => openPanel('left'));
      tb.appendChild(el('span', 'lab dim', P.nodes.length + ' nodes · ' + P.wires.length + ' wires' + (S.live ? '' : ' · kept in this browser')));
      v.appendChild(tb);
      const cv = el('div', 'pcv'), world = el('div', 'pw'), svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'pwires'); world.appendChild(svg); cv.appendChild(world); v.appendChild(cv);
      if (!P.nodes.length) cv.appendChild(el('p', 'empty pempty', 'Empty patch. Open the library ( [ ) to add material, tools, gates, agents and notes — or select a file anywhere and press P. Drag from an output square to an input square to connect.'));
      for (const nd of P.nodes) world.appendChild(this.nodeEl(nd));
      dom.appendChild(v);
      this.world = world; this.svg = svg; this.cv = cv;
      this.applyCam(); requestAnimationFrame(() => this.wires());
      this.bindCanvas(cv);
      if (S.right) renderRight();
    },
    applyCam() { if (this.world) this.world.style.transform = 'translate(' + this.cam.x + 'px,' + this.cam.y + 'px) scale(' + this.cam.s + ')'; },
    nodeEl(nd) {
      const e = el('div', 'pn' + (this.sel === nd.id ? ' sel' : '')); e.dataset.id = nd.id; e.style.left = nd.x + 'px'; e.style.top = nd.y + 'px';
      e.style.setProperty('--nc', this.colour(nd));
      const st = this.states[nd.id];
      const h = el('div', 'pnh'); const dot = el('span', 'sdot ' + (st === 'running' ? 'run' : st === 'waiting' ? 'wait' : st === 'done' ? '' : 'idle')); dot.title = st || 'not run yet';
      const t = nd.type === 'tool' ? this.tool(nd.tool) : null;
      h.append(dot, el('span', 'cl pt', this.title(nd)), el('span', 'lab dim', nd.type === 'material' ? KONE[kindOf(nd.i)] : nd.type === 'tool' ? (t && t.group === 'system8' ? 'SYSTEM 8' : 'program') : nd.type === 'note' ? 'output' : nd.type === 'task' ? 'agent' : 'gate'));
      e.appendChild(h);
      const body = el('div', 'pnb');
      if (nd.type === 'material') {
        const kn = kindOf(nd.i);
        if (VISUAL.has(kn)) { const box = el('div', 'pth'); if (S.live) { const img = new Image(); img.src = API.thumb(nd.i); img.alt = ''; img.onerror = () => { box.textContent = extOf(nd.i).toUpperCase(); }; box.appendChild(img); } else { const c = document.createElement('canvas'); c.width = 192; c.height = 120; window.S8DEMO.paint(c.getContext('2d'), nd.i, 192, 120, kn, workName(D.w[nd.i])); box.appendChild(c); } body.appendChild(box); }
        else body.appendChild(el('div', 'pext', extOf(nd.i).toUpperCase()));
      } else if (nd.type === 'gate') {
        const b = el('button', 'btn cl' + (nd.accepted ? ' solid' : ''), nd.accepted ? 'Accepted' : 'Accept'); b.onclick = ev => { ev.stopPropagation(); nd.accepted = !nd.accepted; this.persist(); this.view(); }; body.appendChild(b);
        body.appendChild(el('div', 'lab dim', 'Nothing after this runs until you accept.'));
      } else if (nd.type === 'note') {
        const inp = el('input', 'fld'); inp.value = nd.title || ''; inp.placeholder = 'Note title'; inp.setAttribute('aria-label', 'Note title'); inp.onchange = () => { nd.title = inp.value; this.persist(); };
        body.appendChild(inp); body.appendChild(el('div', 'lab dim', 'Writes a note linking everything wired in.'));
      } else if (nd.type === 'task') {
        const tk = S.tasks.find(x => x.id === nd.task); body.appendChild(el('div', 'lab dim', tk && tk.last ? tk.last : 'Runs with the wired file as {input}'));
      } else if (nd.type === 'tool') {
        body.appendChild(el('div', 'lab dim', !t ? 'Unknown tool' : !t.usable ? 'No address yet · set in config' : t.via === 'url' ? 'Web tool · opens with ?src=' : t.via === 'uri' ? 'App link' : 'Opens the program with the file'));
      }
      e.appendChild(body);
      const ports = this.ports(nd), pr = el('div', 'pports'), ins = el('div', 'pins'), outs = el('div', 'pouts');
      ports.ins.forEach((ty, k) => { const p = el('div', 'pp'); const sq = el('span', 'pd in' + (ty === 'text' ? ' ci' : '')); sq.dataset.k = k; sq.dataset.t = ty; sq.style.setProperty('--pc', typeColor(ty)); p.append(sq, el('span', 'lab', ty)); ins.appendChild(p); });
      ports.outs.forEach((ty, k) => { const p = el('div', 'pp out'); const sq = el('span', 'pd out' + (ty === 'text' ? ' ci' : '')); sq.dataset.k = k; sq.dataset.t = ty; const oc = nd.type === 'material' ? C.k[D.k[nd.i]] : typeColor(ty); sq.style.setProperty('--pc', oc); p.append(el('span', 'lab', ty), sq); outs.appendChild(p); });
      pr.append(ins, outs); e.appendChild(pr);
      e.addEventListener('dblclick', ev => { if (ev.target.closest('input, button')) return; ev.stopPropagation(); this.activate(nd); });
      return e;
    },
    portPos(id, dir, k) {
      const e = this.world && this.world.querySelector('.pn[data-id="' + id + '"] .pd.' + dir + '[data-k="' + k + '"]'); if (!e) return null;
      const r = e.getBoundingClientRect(), wr = this.world.getBoundingClientRect();
      return [(r.left + r.width / 2 - wr.left) / this.cam.s, (r.top + r.height / 2 - wr.top) / this.cam.s];
    },
    wirePath(p, q) { const dx = Math.max(40, Math.abs(q[0] - p[0]) * 0.5); return 'M' + p[0] + ' ' + p[1] + ' C' + (p[0] + dx) + ' ' + p[1] + ' ' + (q[0] - dx) + ' ' + q[1] + ' ' + q[0] + ' ' + q[1]; },
    wires() {
      if (!this.svg || !this.P) return;
      const P = this.P, svg = this.svg, NS = 'http://www.w3.org/2000/svg'; svg.textContent = '';
      P.wires.forEach((w, j) => {
        const p = this.portPos(w.a, 'out', w.ap), q = this.portPos(w.b, 'in', w.bp); if (!p || !q) return;
        const A = P.nodes.find(n => n.id === w.a), ty = this.ports(A).outs[w.ap];
        const path = document.createElementNS(NS, 'path'); path.setAttribute('d', this.wirePath(p, q)); path.setAttribute('class', 'pwire' + (this.selWire === j ? ' sel' : ''));
        path.style.stroke = this.selWire === j ? C.a : A.type === 'material' ? C.k[D.k[A.i]] : typeColor(ty);
        const hitp = document.createElementNS(NS, 'path'); hitp.setAttribute('d', this.wirePath(p, q)); hitp.setAttribute('class', 'pwhit');
        hitp.addEventListener('pointerdown', ev => { ev.stopPropagation(); this.selWire = j; this.sel = null; document.querySelectorAll('.pn.sel').forEach(x => x.classList.remove('sel')); this.wires(); if (S.right) renderRight(); });
        svg.append(path, hitp);
      });
      if (this.temp) { const path = document.createElementNS(NS, 'path'); path.setAttribute('d', this.wirePath(this.temp.p, this.temp.q)); path.setAttribute('class', 'pwire temp'); path.style.stroke = typeColor(this.temp.t); svg.appendChild(path); }
    },
    toWorld(ev) { const r = this.cv.getBoundingClientRect(); return [(ev.clientX - r.left - this.cam.x) / this.cam.s, (ev.clientY - r.top - this.cam.y) / this.cam.s]; },
    bindCanvas(cv) {
      cv.addEventListener('pointerdown', ev => {
        if (ev.target.closest('button, input')) return;
        const port = ev.target.closest('.pd.out'), head = ev.target.closest('.pnh'), node = ev.target.closest('.pn');
        if (port) {
          const id = port.closest('.pn').dataset.id, k = +port.dataset.k, t = port.dataset.t, p = this.portPos(id, 'out', k);
          this.temp = { a: id, ap: k, t, p, q: p };
          this.world.querySelectorAll('.pd.in').forEach(x => x.classList.add(compat(t, x.dataset.t) && x.closest('.pn').dataset.id !== id ? 'ok' : 'no'));
          cv.setPointerCapture(ev.pointerId); ev.preventDefault(); return;
        }
        if (node) {
          const id = node.dataset.id; this.sel = id; this.selWire = -1;
          document.querySelectorAll('.pn.sel').forEach(x => x.classList.remove('sel')); node.classList.add('sel'); this.wires();
          if (S.right) renderRight();
          if (head || !ev.target.closest('.pnb')) { const nd = this.P.nodes.find(n => n.id === id); this.dragN = { nd, el: node, x: ev.clientX, y: ev.clientY, x0: nd.x, y0: nd.y }; cv.setPointerCapture(ev.pointerId); }
          return;
        }
        this.sel = null; this.selWire = -1; document.querySelectorAll('.pn.sel').forEach(x => x.classList.remove('sel')); this.wires(); if (S.right) renderRight();
        this.dragC = { x: ev.clientX, y: ev.clientY, cx: this.cam.x, cy: this.cam.y }; cv.setPointerCapture(ev.pointerId);
      });
      cv.addEventListener('pointermove', ev => {
        if (this.temp) { this.temp.q = this.toWorld(ev); this.wires(); return; }
        if (this.dragN) { const g = this.dragN; g.nd.x = Math.round((g.x0 + (ev.clientX - g.x) / this.cam.s) / 24) * 24; g.nd.y = Math.round((g.y0 + (ev.clientY - g.y) / this.cam.s) / 24) * 24; g.el.style.left = g.nd.x + 'px'; g.el.style.top = g.nd.y + 'px'; this.wires(); return; }
        if (this.dragC) { this.cam.x = this.dragC.cx + ev.clientX - this.dragC.x; this.cam.y = this.dragC.cy + ev.clientY - this.dragC.y; this.applyCam(); }
      });
      cv.addEventListener('pointerup', ev => {
        if (this.temp) {
          const tgt = document.elementFromPoint(ev.clientX, ev.clientY), port = tgt && tgt.closest ? tgt.closest('.pd.in') : null;
          let ok = false;
          if (port) ok = this.connect(this.temp.a, this.temp.ap, port.closest('.pn').dataset.id, +port.dataset.k);
          this.temp = null; this.view(); if (ok) toast('Connected');
          return;
        }
        if (this.dragN) { this.dragN = null; this.persist(); }
        this.dragC = null;
      });
      cv.addEventListener('wheel', ev => {
        ev.preventDefault(); const r = cv.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
        const s1 = clamp(this.cam.s * Math.exp(-wheelDelta(ev) * 0.0015), 0.35, 2.2), k = s1 / this.cam.s;
        this.cam.x = mx - (mx - this.cam.x) * k; this.cam.y = my - (my - this.cam.y) * k; this.cam.s = s1; this.applyCam(); requestAnimationFrame(() => this.wires());
      }, { passive: false });
    },
    activate(nd) {
      if (nd.type === 'material') openItem(nd.i);
      else if (nd.type === 'tool') { const t = this.tool(nd.tool), src = this.upstream(nd.id)[0]; if (t) useTool(t, src != null ? src : -1); }
      else if (nd.type === 'task') { const t = S.tasks.find(x => x.id === nd.task); if (t) runTask(t, this.upstream(nd.id)); }
      else if (nd.type === 'gate') { nd.accepted = !nd.accepted; this.persist(); this.view(); }
      else if (nd.type === 'note') this.collect(nd, this.upstream(nd.id));
    },
    upstream(id) { const P = this.P, out = []; for (const w of P.wires) if (w.b === id) { const A = P.nodes.find(n => n.id === w.a); if (A && A.type === 'material') out.push(A.i); else if (A && A.type === 'gate' && A.accepted) out.push(...this.upstream(A.id)); } return out; },
    async collect(nd, items) {
      const title = (nd.title || 'Collection').trim();
      if (!items.length) { toast('Wire material into the note first'); return; }
      if (!S.live) { toast('Sample data — would write “' + title + '” linking ' + items.length + ' items'); return; }
      const r = await API.post('/api/collect', { title, items }); toast(r.ok ? 'Note written · ' + r.path.split(/[\\/]/).slice(-2).join('/') + ' · reindex to see the links' : r.error);
    },
    run() {
      const P = this.P, ids = P.nodes.map(n => n.id), indeg = new Map(ids.map(id => [id, 0]));
      for (const w of P.wires) indeg.set(w.b, indeg.get(w.b) + 1);
      const q = ids.filter(id => !indeg.get(id)), order = [];
      while (q.length) { const id = q.shift(); order.push(id); for (const w of P.wires) if (w.a === id) { indeg.set(w.b, indeg.get(w.b) - 1); if (!indeg.get(w.b)) q.push(w.b); } }
      const vals = new Map(); this.states = {};
      let waiting = 0, opened = 0;
      for (const id of order) {
        const nd = P.nodes.find(n => n.id === id), ins = P.wires.filter(w => w.b === id).map(w => vals.get(w.a)).filter(Boolean);
        const blocked = ins.some(v2 => v2.blocked), items = [].concat(...ins.map(v2 => v2.items || [])), pending = ins.some(v2 => v2.pending);
        if (blocked) { this.states[id] = 'blocked'; vals.set(id, { blocked: true }); continue; }
        if (nd.type === 'material') { this.states[id] = 'done'; vals.set(id, { items: [nd.i] }); }
        else if (nd.type === 'gate') { if (nd.accepted) { this.states[id] = 'done'; vals.set(id, { items }); } else { this.states[id] = 'waiting'; waiting++; vals.set(id, { blocked: true }); } }
        else if (nd.type === 'tool') {
          const t = this.tool(nd.tool);
          if (pending && !items.length) { this.states[id] = 'waiting'; vals.set(id, { pending: true, items: [] }); continue; }
          if (t) (items.length ? items.slice(0, 3) : [-1]).forEach(i => { useTool(t, i); opened++; });
          this.states[id] = 'done'; vals.set(id, { pending: true, items: [] });
        } else if (nd.type === 'task') { const t = S.tasks.find(x => x.id === nd.task); if (t) runTask(t, items); this.states[id] = 'running'; vals.set(id, { items: [] }); }
        else if (nd.type === 'note') { this.collect(nd, items); this.states[id] = 'done'; vals.set(id, { items: [] }); }
      }
      this.view();
      computeFlags(); invalidate();
      toast('Ran ' + order.length + ' nodes' + (opened ? ' · ' + opened + ' sent to tools' : '') + (waiting ? ' · ' + waiting + ' gate waiting for you' : '') + (order.length < ids.length ? ' · a loop was skipped' : ''));
    },
  };

  // ───────────────────────────────────────── navigation
  function snapshot() { const rv = RV(); return { view: S.view, item: S.item, list: S.list, sel: S.sel, rv, rf: rv.focus, gf: Graph.focus }; }
  function go(view, o) {
    o = o || {};
    if (!o.noHist) { S.hist.push(snapshot()); if (S.hist.length > 80) S.hist.shift(); }
    S.view = view; S.item = o.item != null ? o.item : -1; S.list = o.list != null ? o.list : -1;
    if (o.rf != null) { const rv = RV(); rv.tr = null; rv.focus = o.rf; }
    if (o.gf != null) { Graph.tr = null; Graph.focus = o.gf; }
    render();
  }
  function openItem(i, list) { if (i == null || i < 0) return; S.sel = i; S.ctxList = list || null; go(S.view === 'patch' ? 'rings' : S.view, { item: i }); }
  function back() {
    const h = S.hist.pop();
    if (!h) return up();
    S.view = h.view; S.item = h.item; S.list = h.list; S.sel = h.sel;
    const rv = h.rv && (h.rv === Rings || S.lenses.some(L => L.v === h.rv)) ? h.rv : null;
    if (rv && rv.tree && rv.tree.nodes[h.rf]) { rv.tr = null; rv.focus = h.rf; }
    Graph.tr = null; Graph.focus = h.gf; render();
  }
  function up() {
    if (S.item >= 0) { go('rings', { rf: treeFor(S.item).leafOf[S.item] }); return; }
    if (S.list >= 0) { go('rings', { rf: S.list }); return; }
    const v = views[S.view];
    if (v === LensView) { const rv = RV(); if (rv.focus === rv.home && !rv.tr) { if (S.lenses.length === 1) clearLenses(); } else LensView.up(); return; }
    if (v) { const p = v.tree.nodes[v.focus].parent; if (p >= 0) v.zoomTo(p); else if (S.view !== 'rings') go('rings', {}); return; }
    clearDate(); go('rings', {});
  }
  function clearDate() { if (S.date) { S.date = null; runSearch(); } }
  function setView(v) { if (v !== 'field') clearDate(); closeVList(); go(v, {}); if (v === 'patch' && !S.left && !keep.get('patchSeen', false)) { keep.set('patchSeen', true); openPanel('left'); } }
  function locate(i) {
    S.sel = i;
    if (S.lenses.length && RV().tree.pos[i] < 0) { const j = S.lenses.findIndex(L => L.v.tree.pos[i] >= 0); if (j >= 0) S.activeLens = j; else { toast('Not in these lenses — showing it in everything'); S.lenses = []; } }
    if (S.view !== 'rings' || S.item >= 0 || S.list >= 0) go('rings', {});
    const v = RV(); v.zoomTo(v.tree.leafOf[i], 760); render();
  }
  // focusNode takes a node of the view you are in; focusAll a node of the whole archive
  function focusNode(id) { if (S.view !== 'rings' || S.item >= 0 || S.list >= 0) go('rings', {}); RV().zoomTo(id); }
  function focusAll(id) { if (S.lenses.length) { S.lenses = []; S.activeLens = 0; } if (S.view !== 'rings' || S.item >= 0 || S.list >= 0) go('rings', {}); else render(); Rings.zoomTo(id); }
  const ancestorOfType = (T, id, type) => { let n = T.nodes[id]; while (n && n.type !== type) n = n.parent >= 0 ? T.nodes[n.parent] : null; return n ? n.id : null; };
  // the sector or work an item sits in, in the view that holds it
  function nodeOfItem(i, type) { const T = treeFor(i), lf = T.leafOf[i]; if (lf < 0) return null; const id = ancestorOfType(T, lf, type); return id == null ? null : { T, id }; }
  function focusItemNode(i, type) {
    const r = nodeOfItem(i, type); if (!r) return;
    if (r.T === Rings.tree) focusAll(r.id); else focusNode(r.id);
  }

  function render() {
    const mode = S.item >= 0 ? 'item' : S.list >= 0 ? 'list' : S.view;
    S.mode = mode;
    const canvasMode = !!views[mode];
    field.style.visibility = canvasMode ? 'visible' : 'hidden';
    dom.hidden = canvasMode;
    hideTip();
    if (canvasMode) { dom.textContent = ''; invalidate(); } else { renderDom(); Flags.sync([]); }
    renderTrail(); updateStepper(); Inset.draw(); renderLegend();
    $('#ql').hidden = !(S.q.trim() && S.mcount && S.mode === 'rings');
    dom.classList.toggle('libdock', S.mode === 'patch' && S.left);
    if (S.right) renderRight();
    if (S.left) renderLeft();
  }
  function renderTrail() {
    const tr = $('#trail'); tr.textContent = '';
    if (!Rings.tree) return;
    const rv = RV(), inLens = rv !== Rings;
    const crumbs = inLens
      ? [[(S.lenses.length > 1 ? (S.activeLens + 1) + '/' + S.lenses.length + ' · ' : '') + rv.lens.title, () => { clearDate(); if (S.view === 'rings' && S.item < 0 && S.list < 0) rv.zoomTo(rv.home); else go('rings', { rf: rv.home }); }]]
      : [['All', () => { clearDate(); if (S.view === 'rings' && S.item < 0 && S.list < 0) Rings.zoomTo(0); else go('rings', { rf: 0 }); }]];
    if (S.view !== 'rings' && S.item < 0) crumbs.push([VIEWS.find(v => v[0] === S.view)[1], () => go(S.view, {})]);
    const addChain = (v, id) => { for (const nid of chain(v.tree, id).slice(v.lens ? chain(v.tree, v.home).length : 1)) { const nd = v.tree.nodes[nid]; crumbs.push([nd.label, () => { if (S.view === v.name && S.item < 0 && S.list < 0) v.zoomTo(nid); else go(v.name, v === Rings ? { rf: nid } : { gf: nid }); }]); } };
    if (S.item >= 0) { const T = treeFor(S.item), ov = T === rv.tree ? rv : Rings; addChain(ov, T.leafOf[S.item]); crumbs.push([titleOf(S.item), null]); }
    else if (S.list >= 0) { addChain(rv, S.list); crumbs.push(['List', null]); }
    else if (S.view === 'rings') addChain(rv, rv.tr ? rv.tr.B : rv.focus);
    else if (S.view === 'graph') addChain(Graph, Graph.tr ? Graph.tr.B : Graph.focus);
    else if (S.view === 'patch' && Patch.P) crumbs.push([Patch.P.name, null]);
    if (S.date && S.mode === 'field') crumbs.push([S.date.label, null]);
    crumbs.forEach(([lab, fn], j) => {
      if (j) tr.appendChild(el('span', 'sep cl', '›'));
      const b = el('button', 'cl ' + (j === crumbs.length - 1 ? 'here' : 'up'), String(lab).toUpperCase());
      if (j === 0 && inLens) { const sw = el('span', 'lsw'); sw.style.background = lensColour(rv.lens); b.prepend(sw); }
      if (fn && j < crumbs.length - 1) b.onclick = fn; else b.disabled = !fn;
      b.title = lab; tr.appendChild(b);
    });
  }
  function updateStepper() { const v = VIEWS.find(x => x[0] === S.view); $('#vLab').textContent = v[1].toUpperCase(); }
  function stepView(dlt) { const j = VIEWS.findIndex(x => x[0] === S.view); setView(VIEWS[(j + dlt + VIEWS.length) % VIEWS.length][0]); }
  function openVList() {
    const L = $('#vList'); L.textContent = '';
    VIEWS.forEach(([id, name], j) => { const b = el('button', 'cl' + (S.view === id ? ' on' : '')); b.append(el('span', null, name.toUpperCase()), el('kbd', 'lab', String(j + 1))); b.onclick = () => setView(id); L.appendChild(b); });
    L.hidden = false;
  }
  function closeVList() { $('#vList').hidden = true; }

  // ───────────────────────────────────────── selection
  function select(i) {
    if (S.sel === i) return;
    S.sel = i;
    document.querySelectorAll('.tile.sel').forEach(t => t.classList.remove('sel'));
    if (i >= 0) { const t = document.querySelector('.tile[data-i="' + i + '"]'); if (t) t.classList.add('sel'); }
    invalidate();
    if (S.right) renderRight();
    if (S.left && S.mode === 'patch') renderLeft();
  }

  // ───────────────────────────────────────── tools and actions
  function compatible(tool, i) { if (i == null || i < 0) return false; const e = extOf(i); return !!(tool.exts && tool.exts.includes(e)) || !!(tool.kinds && tool.kinds.includes(kindOf(i))); }
  async function useTool(tool, i) {
    const withItem = i >= 0 && compatible(tool, i);
    if (!S.live) { toast(withItem ? 'Sample data — would open ' + D.n[i] + ' in ' + tool.name : 'Sample data — would open ' + tool.name); return; }
    if (!tool.usable) { toast(tool.name + ' has no address yet — add "url" for it in config.json'); return; }
    if (tool.via === 'url' && tool.url) {
      let url = tool.url;
      if (withItem && (tool.pass === 'src' || url.includes('{src}'))) {
        const src = location.origin + API.file(i);
        url = url.includes('{src}') ? url.replace('{src}', encodeURIComponent(src)).replace('{name}', encodeURIComponent(D.n[i])) : url + (url.includes('?') ? '&' : '?') + 'src=' + encodeURIComponent(src) + '&name=' + encodeURIComponent(D.n[i]);
      }
      const w = window.open(url, '_blank', 'noopener');
      if (w === null && !/^\//.test(url)) toast('The browser may have blocked a new tab for ' + tool.name + ' — allow pop-ups for this address');
      return;
    }
    const r = await API.post('/api/open', { tool: tool.id, i: withItem ? i : null });
    if (r.url) window.open(r.url, '_blank', 'noopener');
    toast(r.ok ? (withItem ? D.n[i] + ' → ' + tool.name : tool.name + ' opened') : r.error || 'Could not open ' + tool.name);
  }
  async function openDefault(i) { if (!S.live) return toast('Sample data — would open ' + D.n[i] + ' with its default app'); const r = await API.post('/api/open', { i }); toast(r.ok ? 'Opened ' + D.n[i] : r.error); }
  async function revealItem(i) { if (!S.live) return toast('Sample data — would show ' + D.n[i] + ' in its folder'); const r = await API.post('/api/open', { i, reveal: true }); toast(r.ok ? 'Shown in folder' : r.error); }
  function copyText(txt, msg) {
    const done = () => toast(msg);
    try { navigator.clipboard.writeText(txt).then(done, () => fallbackCopy(txt, done)); } catch (e) { fallbackCopy(txt, done); }
  }
  function fallbackCopy(txt, done) { const ta = el('textarea'); ta.value = txt; ta.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast(txt); } ta.remove(); }

  // ───────────────────────────────────────── tasks
  async function runTask(t, inputs) {
    if (!S.live) return demoRun(t);
    if (t.machine && t.here === false) return toast(t.name + ' runs on the ' + t.machine.toUpperCase() + ' — start it there');
    const r = await API.post('/api/task/run', { id: t.id, inputs: inputs && inputs.length ? inputs : undefined });
    if (!r.ok) toast(r.error || (r.task && r.task.last) || (t.name + ' is already running'));
    pollTasks();
  }
  async function stopTask(t) { if (!S.live) { t.state = 'idle'; t.last = 'stopped'; clearInterval(t._iv); renderRight(); return; } await API.post('/api/task/stop', { id: t.id }); pollTasks(); }
  function demoRun(t, from) {
    if (t.state === 'running' && from == null) return;
    t.state = 'running'; t.log = t.log || []; let j = from || 0; t.last = t.script[j] || '';
    clearInterval(t._iv);
    t._iv = setInterval(() => {
      j++;
      if (j >= t.script.length) { clearInterval(t._iv); t.state = 'done'; t.need = ''; t.t1 = Date.now() / 1000; toast(t.name + ' · done'); computeFlags(); if (S.right) renderRight(); }
      else { t.last = t.script[j]; t.log.push(t.last); }
      updateDot(); if (S.right) renderRun(); invalidate();
    }, 1700);
    computeFlags(); updateDot(); if (S.right) renderRight(); invalidate();
  }
  async function pollTasks() {
    if (!S.live) return;
    try {
      const r = await API.get('/api/tasks');
      const was = S.progress && S.progress.state;
      const sig = S.tasks.map(t => t.id + t.state).join();
      S.tasks = r.tasks; S.progress = r.progress;
      if (sig !== S.tasks.map(t => t.id + t.state).join()) { computeFlags(); if (S.right) renderRight(); invalidate(); }
      updateDot(); if (S.right) renderRun();
      if (was === 'running' && r.progress.state === 'done') reloadIndex();
      if (S.mode === 'rings') invalidate();
    } catch (e) { /* bridge gone */ }
  }
  async function reloadIndex() {
    try {
      const J = await API.get('/api/index');
      D = makeStore(J); S.hiddenK = new Uint8Array(D.kinds.length); S.match = null; S.mcount = 0; S.mlist = null;
      readColors(); buildTrees(); TH.clear();
      S.item = -1; S.list = -1; S.sel = -1; S.hist = []; S.lenses = []; S.activeLens = 0;
      await loadGroups(); await loadDeadlines(); computeFlags();
      if (S.q || S.date) runSearch();
      $('#q').placeholder = 'Search ' + fmt(D.N) + ' items';
      render(); toast('Index updated · ' + fmt(D.N) + ' items');
    } catch (e) { toast('Could not reload the index: ' + e.message); }
  }
  function updateDot() {
    const d = $('#dot'), running = S.tasks.some(t => t.state === 'running') || (S.progress && S.progress.state === 'running'), failed = S.tasks.some(t => t.state === 'failed' || t.state === 'waiting');
    d.className = 'sdot ' + (running ? 'run' : failed ? 'wait' : 'idle');
    $('#dotb').title = running ? 'Something is running' : failed ? 'A task needs you' : 'Nothing running';
  }

  // ───────────────────────────────────────── panels
  function setPanel(side, open) {
    S[side] = open;
    $(side === 'left' ? '#pL' : '#pR').classList.toggle('open', open);
    dom.classList.toggle('libdock', S.mode === 'patch' && S.left);
    if (open) (side === 'left' ? renderLeft : renderRight)();
  }
  function openPanel(side, focus) { setPanel(side, true); if (focus) { const t = document.getElementById('sec-' + focus); if (t) { t.classList.remove('closed'); t.scrollIntoView({ block: 'start' }); } } }
  const togglePanel = side => setPanel(side, !S[side]);
  function panelHead(title, side) {
    const h = el('div', 'ph'); h.appendChild(el('span', 'cl', title));
    const x = el('button', 'fc cl', '×'); x.setAttribute('aria-label', 'Close'); x.onclick = () => setPanel(side, false); h.appendChild(x);
    return h;
  }
  // collapsible sections; open/closed is remembered per section
  const SECS = keep.get('secs', {});
  const CLOSED_BY_DEFAULT = new Set(['sources', 'sectors', 'settings', 'keys', 'about', 'programs', 'how-wires-work']);
  function sec(title, id, count) {
    const key = id || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const s = el('div', 'sec'); s.id = 'sec-' + key;
    const h = el('button', 'sech'); h.append(el('span', 'lab', title));
    if (count != null) h.append(el('span', 'cnt lab', typeof count === 'number' ? fmt(count) : count));
    h.append(el('span', 'tog'));
    const closed = SECS[key] != null ? SECS[key] : CLOSED_BY_DEFAULT.has(key);
    s.classList.toggle('closed', closed); h.setAttribute('aria-expanded', String(!closed));
    h.onclick = () => { const c = !s.classList.contains('closed'); s.classList.toggle('closed', c); SECS[key] = c; keep.set('secs', SECS); h.setAttribute('aria-expanded', String(!c)); };
    s.appendChild(h); return s;
  }
  function runSection() { const s = sec('Run · agents and tasks', 'run', S.tasks.filter(t => t.state === 'running').length ? S.tasks.filter(t => t.state === 'running').length + ' running' : ''); const b = el('div'); b.id = 'run-body'; s.appendChild(b); return s; }
  function stepperRow(label, value, onPrev, onNext) {
    const r = el('div', 'row'); r.appendChild(el('span', 'grow', label));
    const st2 = el('div', 'stepper'); const a = el('button', 'fc cl', '‹'), b = el('button', 'fc cl', '›'), v = el('span', 'cl', value);
    a.onclick = onPrev; b.onclick = onNext; a.setAttribute('aria-label', 'Previous'); b.setAttribute('aria-label', 'Next');
    v.style.minWidth = '84px'; v.style.textAlign = 'center'; st2.append(a, v, b); r.appendChild(st2); return r;
  }
  function renderLeft() {
    if (S.mode === 'patch') return renderLibrary();
    const P = $('#pL'); P.textContent = '';
    P.appendChild(panelHead('System', 'left'));
    const a = sec('Archive');
    if (S.live) {
      const kv = el('div', 'kv');
      const add = (k, v) => { kv.append(el('span', null, k), el('span', null, v)); };
      add('Machine', D.machine || '—'); add('Items', fmt(D.N)); add('Indexed', D.at ? ago(D.at) : '—');
      add('Thumbs', [S.caps.pillow && 'Pillow', S.caps.sips && 'sips', S.caps.quicklook && 'Quick Look', S.caps.ffmpeg && 'ffmpeg'].filter(Boolean).join(' · ') || 'originals only');
      add('Sidecars', (S.status && S.status.sidecars) || '—');
      a.appendChild(kv);
      const b = el('button', 'btn cl', S.progress && S.progress.state === 'running' ? 'Indexing … ' + fmt(S.progress.files) : 'Reindex');
      b.onclick = async () => { const r = await API.post('/api/reindex', {}); toast(r.ok ? 'Indexing started' : 'Already indexing'); pollTasks(); setTimeout(renderLeft, 400); };
      a.appendChild(b);
    } else {
      a.appendChild(el('p', 'note', (D.scale < 1 ? 'Sample data at a quarter of your scale on this device — ' : 'Sample data at the scale you gave — ') + fmt(D.N) + ' items. Names, dates and links are invented.'));
      a.appendChild(el('p', 'note', 'To see your own archive, run the bridge on your computer:'));
      const c = el('div', 'log'); c.textContent = 'python3 s8.py'; a.appendChild(c);
    }
    P.appendChild(a);
    const so = sec('Sources', null, D.roots.length);
    D.roots.forEach(r => { const row = el('div', 'row'); const g = el('span', 'grow', r.name); g.title = r.path; row.append(g, el('span', 'r lab', (r.ok === false ? 'missing · ' : '') + (r.sector || ''))); so.appendChild(row); });
    if (!D.roots.length) so.appendChild(el('p', 'note', 'No folders yet. Add them to config.json → roots.'));
    P.appendChild(so);
    const kd = sec('Kinds · click to hide', 'kinds', D.kinds.filter((k, j) => D.kindCount[j]).length);
    GRID_ORDER.forEach(kn => {
      const k = D.kindIx[kn]; if (k === undefined || !D.kindCount[k]) return;
      const r = el('button', 'row' + (S.hiddenK[k] ? ' off' : '')); const sw = el('span', 'sw' + shp(k) + (S.hiddenK[k] ? ' off' : '')); sw.style.background = C.k[k];
      r.append(sw, el('span', 'grow', KLAB[kn]), el('span', 'r', fmt(D.kindCount[k]))); r.onclick = () => toggleKind(k); kd.appendChild(r);
    });
    P.appendChild(kd);
    const gs = sec('Groups · virtual', 'groups', S.groups.length);
    S.groups.forEach(g => {
      const r = el('div', 'row'), b = el('button', 'grow'); b.style.textAlign = 'left'; b.style.minHeight = '32px';
      b.append(el('span', null, g.name), el('span', 'lab dim', '  ' + (g.rule ? 'rule' + (g.items && g.items.length ? ' + ' + g.items.length : '') : fmt((g.items || []).length) + ' files')));
      b.title = (g.rule || 'Picked files') + (g.missing ? ' · ' + g.missing + ' files no longer found' : ''); b.onclick = () => { setPanel('left', false); openGroup(g); };
      const x = el('button', 'lab', '×'); x.style.cssText = 'height:32px;padding:0 4px;color:var(--d)'; x.setAttribute('aria-label', 'Remove group ' + g.name); x.onclick = () => deleteGroup(g);
      r.append(b, x); gs.appendChild(r);
    });
    if (!S.groups.length) gs.appendChild(el('p', 'note', 'Save a lens to keep it as a group. Groups are virtual folders: a rule, files you picked, or both. Nothing is copied or moved on disk.'));
    P.appendChild(gs);
    const sc = sec('Sectors', null, (Rings.tree.nodes[0].kids || []).length);
    (Rings.tree.nodes[0].kids || []).forEach(id => { const nd = Rings.tree.nodes[id]; const r = el('button', 'row'); r.append(el('span', 'grow', nd.label), el('span', 'r', fmt(nd.n))); r.onclick = () => { setPanel('left', false); focusAll(id); }; sc.appendChild(r); });
    P.appendChild(sc);
    const se = sec('Settings');
    const themes = ['light', 'dark', 'auto'], tl = { light: 'Light', dark: 'Dark', auto: 'System' };
    const cycle = (arr, cur, d) => arr[(arr.indexOf(cur) + d + arr.length) % arr.length];
    const setTheme = d => { S.theme = cycle(themes, S.theme, d); keep.set('theme', S.theme); applyTheme(); renderLeft(); render(); };
    se.appendChild(stepperRow('Ground', tl[S.theme].toUpperCase(), () => setTheme(-1), () => setTheme(1)));
    const ws = ['sqrt', 'count', 'equal'], wl = { sqrt: '√ count', count: 'Count', equal: 'Equal' };
    const setW = d => { S.weight = cycle(ws, S.weight, d); keep.set('weight', S.weight); buildTrees(); S.hist = []; renderLeft(); render(); };
    se.appendChild(stepperRow('Sector size', wl[S.weight].toUpperCase(), () => setW(-1), () => setW(1)));
    P.appendChild(se);
    const ks = sec('Keys');
    [['/', 'Search · kind: ext: year: in: work: #tag -word'], ['Scroll', 'Zoom into the ring under the pointer · out to go up'], ['Drag', 'Turn the rings'], ['Enter', 'Open the selection'], ['Esc', 'Back'], ['⌫', 'Up one level'],
      ['Shift-click', 'A ring, a project or folder name = new lens'], ['Enter', 'In the search: the words become a lens (Shift+Enter = list)'], ['L', 'List everything in the focus'], ['P', 'Add the selection to the patch'], ['← →', 'Step through items'], ['1 – 5', 'Rings · Graph · Patch · Year · Field'], ['[  ]', 'Left · right panel'], ['O / R', 'Open · reveal the selection']]
      .forEach(([k, v]) => { const r = el('div', 'row'); const kb = el('kbd', 'lab', k); kb.style.minWidth = '64px'; r.append(kb, el('span', 'grow dim', v)); ks.appendChild(r); });
    P.appendChild(ks);
    const ab = sec('About');
    ab.appendChild(el('p', 'note', 'SYSTEM 8 · Control room · build 1.3 — one radial grammar at every level, lenses that split the circle, the graph on the same rings, and the patch room.'));
    if (S.live && S.status) ab.appendChild(el('p', 'note', 'Config: ' + S.status.config));
    P.appendChild(ab);
  }
  function renderLibrary() {
    const P = $('#pL'), y = P.scrollTop; P.textContent = '';
    P.appendChild(panelHead('Node library', 'left'));
    const add = spec => Patch.add(spec);
    const s0 = sec('Material');
    if (S.sel >= 0) { const r = el('button', 'row'); const sw = el('span', 'sw' + shp(D.k[S.sel])); sw.style.background = C.k[D.k[S.sel]]; r.append(sw, el('span', 'grow', titleOf(S.sel)), el('span', 'r lab', 'selection')); r.onclick = () => Patch.addMaterial(S.sel); s0.appendChild(r); }
    const inp = el('input', 'fld'); inp.id = 'lib-q'; inp.placeholder = 'Find a file to add'; inp.setAttribute('aria-label', 'Find a file to add'); s0.appendChild(inp);
    const res = el('div'); s0.appendChild(res);
    let lt = 0;
    inp.addEventListener('input', () => { clearTimeout(lt); lt = setTimeout(() => {
      res.textContent = ''; const q = inp.value.trim().toLowerCase(); if (q.length < 2) return; ensureHay();
      let n = 0; const bt = byTime();
      for (let p = 0; p < bt.length && n < 24; p++) { const i = bt[p]; if (D.nLow[i].includes(q) || (D.exHay.get(i) || '').includes(q)) { const r = el('button', 'row'); const sw = el('span', 'sw' + shp(D.k[i])); sw.style.background = C.k[D.k[i]]; r.append(sw, el('span', 'grow', titleOf(i)), el('span', 'r lab', fmon(D.t[i]))); r.onclick = () => Patch.addMaterial(i); res.appendChild(r); n++; } }
      if (!n) res.appendChild(el('p', 'note', 'Nothing found.'));
    }, 160); });
    P.appendChild(s0);
    [['system8', 'SYSTEM 8 tools'], ['apps', 'Programs']].forEach(([g, name]) => {
      const s = sec(name, g === 'apps' ? 'programs' : 'system8-tools', S.tools.filter(t => t.group === g).length);
      S.tools.filter(t => t.group === g).forEach(t => { const ports = Patch.ports({ type: 'tool', tool: t.id }); const r = el('button', 'row'); r.append(el('span', 'grow' + (t.usable ? '' : ' dim'), t.name), el('span', 'r lab', ports.ins.join(' ') || 'launch')); r.onclick = () => add({ type: 'tool', tool: t.id }); s.appendChild(r); });
      P.appendChild(s);
    });
    const s3 = sec('Agents and tasks', null, S.tasks.length);
    S.tasks.forEach(t => { const r = el('button', 'row'); r.append(el('span', 'grow', t.name), el('span', 'r lab', t.machine ? t.machine.toUpperCase() : 'any')); r.onclick = () => add({ type: 'task', task: t.id }); s3.appendChild(r); });
    P.appendChild(s3);
    const s4 = sec('Logic and output');
    const g1 = el('button', 'row'); g1.append(el('span', 'grow', 'Gate · you decide'), el('span', 'r lab', 'any → any')); g1.onclick = () => add({ type: 'gate', label: 'Gate · you decide' }); s4.appendChild(g1);
    const g2 = el('button', 'row'); g2.append(el('span', 'grow', 'Collect → note'), el('span', 'r lab', 'any → text')); g2.onclick = () => add({ type: 'note', title: 'New collection' }); s4.appendChild(g2);
    P.appendChild(s4);
    const s5 = sec('How wires work');
    s5.appendChild(el('p', 'note', 'Drag from a solid output (right side) to a pale input (left side). Inputs that fit light up; the others stay grey and say why if you try. Colours are the file kinds: image, video, audio, 3D, text. Circles are text, squares are material.'));
    s5.appendChild(el('p', 'note', 'Run follows the wires: material opens in tools, gates stop everything after them until you accept, tasks run with the file as {input}, notes write links into your vault.'));
    P.appendChild(s5);
    P.scrollTop = y;
  }
  function toggleKindLens(k) {
    const q = 'kind:' + D.kinds[k], j = S.lenses.findIndex(Ln => Ln.q === q && !Ln.items);
    if (j >= 0) closeLens(j); else openLens({ title: KLAB[D.kinds[k]], q });
  }
  // ───────────────────────────────────────── virtual groups: saved lenses (a rule plus picked files); nothing moves on disk
  async function loadGroups() {
    if (S.live) { try { const r = await API.get('/api/groups'); S.groups = r.groups || []; } catch (e) { S.groups = []; } }
    else S.groups = keep.get('groups', []);
  }
  async function saveLens(j) {
    const L = S.lenses[j]; if (!L) return;
    const items = L.items ? Array.from(lensItems(L)) : Array.from(L.add);
    if (items.length > 50000) return toast('Too many picked files to keep as a list — narrow the lens first');
    const g = { id: L.gid || 'g' + Date.now().toString(36), name: L.title, rule: L.items ? '' : L.q, items };
    if (S.live) { const r = await API.post('/api/group', g); if (!r.ok) return toast(r.error || 'Could not save the group'); g.id = r.id; toast('Saved group · ' + g.name + ' · a note in your vault lists it'); }
    else toast('Saved group · ' + g.name + ' · kept in this browser (sample data)');
    L.gid = g.id; const k = S.groups.findIndex(x => x.id === g.id); if (k >= 0) S.groups[k] = g; else S.groups.push(g);
    if (!S.live) keep.set('groups', S.groups);
    renderLegend(); if (S.left) renderLeft(); if (S.right) renderRight();
  }
  function openGroup(g) {
    const items = g.items || [];
    openLens({ title: g.name, q: g.rule || '', items: g.rule ? null : Int32Array.from(items), add: g.rule ? items : [], gid: g.id, empty: !g.rule && !items.length });
  }
  async function deleteGroup(g) {
    if (S.live) { const r = await API.post('/api/group/delete', { id: g.id }); if (!r.ok) return toast(r.error || 'Could not delete'); toast('Group removed · its note in the vault stays'); }
    S.groups = S.groups.filter(x => x.id !== g.id); if (!S.live) keep.set('groups', S.groups);
    for (const L of S.lenses) if (L.gid === g.id) L.gid = null;
    if (S.left) renderLeft(); renderLegend();
  }
  // ───────────────────────────────────────── deadlines: deadline: in a project's note, or set here
  async function loadDeadlines() {
    S.deadlines = new Map();
    if (S.live) { try { const r = await API.get('/api/deadlines'); for (const d of r.deadlines || []) S.deadlines.set(d.work, d.deadline); } catch (e) { /* older bridge */ } }
    else {
      const NOW = window.S8DEMO.NOW, iso = t => { const d = new Date(t * 1000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
      for (const [w, days] of window.S8DEMO.DEADLINES || []) S.deadlines.set(w, iso(NOW + days * 86400));
      for (const [w, ds] of Object.entries(keep.get('deadlines', {}))) S.deadlines.set(w, ds);
    }
  }
  async function setDeadline(work, date) {
    if (S.live) { const r = await API.post('/api/deadline', { work, date }); if (!r.ok) return toast(r.error || 'Could not save'); toast(date ? 'Deadline saved · ' + r.path.split(/[\\/]/).slice(-2).join('/') : 'Deadline cleared'); }
    else { const kd = keep.get('deadlines', {}); kd[work] = date; keep.set('deadlines', kd); toast(date ? 'Deadline saved for this browser (sample data)' : 'Deadline cleared'); }
    S.deadlines.set(work, date); computeFlags(); invalidate(); if (S.right) renderRight();
  }
  // the folder a node lives in, if all of it sits in one place on disk
  function nodeDir(T, id) {
    const nd = T.nodes[id]; let root = -1, parts = null;
    for (let p = nd.a; p < nd.b; p++) {
      const di = D.d[T.order[p]], r = D.dirRoot[di], q = D.dirParts[di];
      if (root < 0) { root = r; parts = q.slice(); continue; }
      if (r !== root) return null;
      let k = 0; while (k < parts.length && k < q.length && parts[k] === q[k]) k++; parts.length = k;
    }
    return root < 0 ? null : { root, rel: parts.join('/'), label: ((D.roots[root] || {}).name || '') + (parts.length ? '/' + parts.join('/') : '') };
  }
  async function makeFolder(where, name) {
    name = String(name || '').trim(); if (!name) return toast('Give the folder a name');
    if (!S.live) return toast('Sample data — would create ' + where.label + '/' + name);
    const r = await API.post('/api/mkdir', { root: where.root, rel: where.rel, name });
    toast(r.ok ? 'Created ' + r.path + ' · files you put there appear after the next reindex' : r.error);
  }
  function toggleKind(k) {
    S.hiddenK[k] = S.hiddenK[k] ? 0 : 1;
    invalidate(); if (!views[S.mode]) renderDom(); if (S.left) renderLeft(); renderLegend();
  }
  function renderRight() {
    if (S.mode === 'patch') return renderInspector();
    const P = $('#pR'), y = P.scrollTop; P.textContent = '';
    P.appendChild(panelHead('Tools', 'right'));
    const nd0 = needsSection(); if (nd0) P.appendChild(nd0);
    if (S.mode === 'rings' && S.lenses.length) P.appendChild(lensSection());
    if (S.mode === 'rings' || S.mode === 'list') P.appendChild(focusSection());
    if (S.sel >= 0) P.appendChild(selectionSection(S.sel));
    const tl = sec('Tools', 'tools', S.tools.length);
    [['system8', 'SYSTEM 8'], ['apps', 'Programs']].forEach(([g, name]) => {
      const list = S.tools.filter(t => t.group === g); if (!list.length) return;
      tl.appendChild(el('span', 'lab dim', name)).style.cssText = 'display:block;margin:8px 0 4px';
      list.forEach(t => {
        const can = compatible(t, S.sel), r = el('button', 'row');
        const nm = el('span', 'grow', t.name); if (!t.usable) nm.classList.add('dim');
        r.append(nm, el('span', 'r lab', can ? 'with selection' : !t.usable ? 'set in config' : t.via === 'url' ? 'web ↗' : t.via === 'uri' ? 'open' : 'launch'));
        if (can) r.lastChild.style.color = 'var(--t)';
        r.onclick = () => useTool(t, S.sel); tl.appendChild(r);
      });
    });
    P.appendChild(tl);
    P.appendChild(runSection());
    renderRun();
    P.scrollTop = y;
  }
  function renderInspector() {
    const P = $('#pR'); P.textContent = '';
    P.appendChild(panelHead('Node', 'right'));
    const pt = Patch.P; if (!pt) return;
    const nd = pt.nodes.find(n => n.id === Patch.sel);
    if (!nd) {
      if (Patch.selWire >= 0 && pt.wires[Patch.selWire]) {
        const w = pt.wires[Patch.selWire], A = pt.nodes.find(n => n.id === w.a), B = pt.nodes.find(n => n.id === w.b);
        const s = sec('Wire'); s.appendChild(el('div', 'selname', Patch.title(A) + ' → ' + Patch.title(B))); s.appendChild(el('p', 'note', 'Carries ' + Patch.ports(A).outs[w.ap] + '.'));
        const b = el('button', 'btn cl', 'Remove wire'); b.onclick = () => { pt.wires.splice(Patch.selWire, 1); Patch.selWire = -1; Patch.persist(); Patch.view(); }; s.appendChild(b); P.appendChild(s); return;
      }
      const s = sec('Patch'); s.appendChild(el('div', 'selname', pt.name)); s.appendChild(el('p', 'note', pt.nodes.length + ' nodes · ' + pt.wires.length + ' wires. Select a node to see what it takes, what it gives and what you can do with it.'));
      const del = el('button', 'btn cl', 'Delete this patch'); del.onclick = () => { if (Patch.list.length <= 1) { pt.nodes = []; pt.wires = []; } else { Patch.list.splice(Patch.cur, 1); Patch.cur = 0; } Patch.persist(); Patch.view(); renderTrail(); }; s.appendChild(del);
      P.appendChild(s); P.appendChild(runSection()); renderRun(); return;
    }
    const s = sec(nd.type === 'material' ? 'Material' : nd.type === 'tool' ? 'Tool' : nd.type === 'task' ? 'Agent · task' : nd.type === 'gate' ? 'Gate' : 'Output');
    s.appendChild(el('div', 'selname', Patch.title(nd)));
    const ports = Patch.ports(nd), kv = el('div', 'kv');
    kv.append(el('span', null, 'Takes'), el('span', null, ports.ins.join(', ') || '—'), el('span', null, 'Gives'), el('span', null, ports.outs.join(', ') || '—'), el('span', null, 'State'), el('span', null, Patch.states[nd.id] || 'not run'));
    if (nd.type === 'material') kv.append(el('span', null, 'Path'), el('span', null, pathOf(nd.i)));
    s.appendChild(kv);
    const ins = pt.wires.filter(w => w.b === nd.id).map(w => Patch.title(pt.nodes.find(n => n.id === w.a))), outs = pt.wires.filter(w => w.a === nd.id).map(w => Patch.title(pt.nodes.find(n => n.id === w.b)));
    if (ins.length) s.appendChild(el('p', 'note', 'From: ' + ins.join(', ')));
    if (outs.length) s.appendChild(el('p', 'note', 'To: ' + outs.join(', ')));
    const btns = el('div', 'btns'), mk = (lab, fn) => { const b = el('button', 'lab', lab); b.onclick = fn; btns.appendChild(b); };
    mk(nd.type === 'material' ? 'View' : nd.type === 'tool' ? 'Open' : nd.type === 'task' ? 'Run' : nd.type === 'gate' ? (nd.accepted ? 'Hold' : 'Accept') : 'Write note', () => Patch.activate(nd));
    if (nd.type === 'material') mk('Show in rings', () => locate(nd.i));
    mk('Duplicate', () => Patch.duplicate(nd.id));
    mk('Delete', () => Patch.remove(nd.id));
    s.appendChild(btns);
    P.appendChild(s);
    P.appendChild(runSection()); renderRun();
  }
  function renderRun() {
    const run = document.getElementById('run-body'); if (!run) return;
    run.textContent = '';
    const hc = document.querySelector('#sec-run .sech .cnt'), nr = S.tasks.filter(t => t.state === 'running').length;
    if (hc) hc.textContent = nr ? nr + ' running' : '';
    S.tasks.forEach(t => {
      const r = el('div', 'row'); const d = el('span', 'sdot ' + (t.state === 'running' ? 'run' : t.state === 'failed' ? 'fail' : t.state === 'waiting' ? 'wait' : t.state === 'done' ? '' : 'idle'));
      const g = el('button', 'grow'); g.style.textAlign = 'left'; g.style.minHeight = '32px';
      g.append(el('span', null, t.name)); if (t.machine) g.append(el('span', 'lab dim', '  ' + t.machine.toUpperCase()));
      g.onclick = () => { S.openLog = S.openLog === t.id ? null : t.id; renderRun(); };
      const act = el('button', 'lab', t.state === 'running' ? 'Stop' : 'Run'); act.style.cssText = 'height:32px;padding:0 4px';
      if (t.state === 'waiting') { act.textContent = S.live ? 'Log' : 'Allow'; act.onclick = () => { if (S.live) { S.openLog = t.id; renderRun(); } else demoRun(t, 0); }; }
      else if (!t.ready && t.state !== 'running') { act.textContent = 'Set up'; act.onclick = () => toast(t.note || 'Add a command for this task in config.json'); }
      else act.onclick = () => (t.state === 'running' ? stopTask(t) : runTask(t));
      r.append(d, g, act); run.appendChild(r);
      if (t.state === 'waiting' && t.need) { const l = el('div', 'lab', '▲ ' + t.need); l.style.cssText = 'margin:-4px 0 8px 18px;text-transform:none;letter-spacing:0;color:var(--a)'; run.appendChild(l); }
      else if (t.last) { const l = el('div', 'lab dim', t.last); l.style.cssText = 'margin:-4px 0 8px 18px;text-transform:none;letter-spacing:0'; run.appendChild(l); }
      if (S.openLog === t.id) {
        const lg = el('div', 'log', '…'); run.appendChild(lg);
        if (S.live) API.get('/api/task?id=' + encodeURIComponent(t.id)).then(j => { lg.textContent = (j.task.log || []).join('\n') || 'No output yet'; lg.scrollTop = 1e6; }).catch(() => { lg.textContent = 'Log unavailable'; });
        else lg.textContent = (t.log || []).join('\n') || 'No output yet';
      }
    });
    if (!S.tasks.length) run.appendChild(el('p', 'note', 'No tasks. Add them to config.json → tasks.'));
  }
  function needsSection() {
    const rows = [], ord = { wait: 0, fail: 1, due: 2 };
    for (const [w, f] of S.flags) for (const c of ['wait', 'fail', 'due']) for (const t of f[c]) rows.push({ w, c, t });
    if (!rows.length) return null;
    rows.sort((a, b) => ord[a.c] - ord[b.c]);
    const s = sec('Needs you', 'needs', rows.length);
    rows.forEach(r => {
      const b = el('button', 'row need'), tri = el('i', 'fl ' + r.c);
      b.append(tri, el('span', 'grow', workName(r.w)), el('span', 'r lab', r.c === 'wait' ? 'waits' : r.c === 'fail' ? 'failed' : 'deadline'));
      b.title = r.t; b.onclick = () => focusWork(r.w); s.appendChild(b);
      s.appendChild(el('div', 'lab dim needt', r.t));
    });
    s.appendChild(el('p', 'note', 'Rotating ▲ = an agent waits for you · pulsing = something failed · blinking = deadline within ' + DUE_DAYS + ' days.'));
    return s;
  }
  function lensSection() {
    const L = S.lenses[S.activeLens], s = sec('Lens', 'lens', (S.activeLens + 1) + ' / ' + S.lenses.length);
    const nm = el('input', 'fld'); nm.id = 'lens-name'; nm.value = L.title; nm.setAttribute('aria-label', 'Lens name');
    nm.onchange = () => { const t = nm.value.trim(); if (!t) return; L.title = t; renderTrail(); renderLegend(); invalidate(); };
    s.appendChild(nm);
    const kv = el('div', 'kv');
    kv.append(el('span', null, 'Rule'), el('span', null, L.items ? 'Picked files' : L.q), el('span', null, 'Items'), el('span', null, fmt(L.n)));
    if (L.add.size) kv.append(el('span', null, 'Added'), el('span', null, fmt(L.add.size) + ' by hand'));
    if (L.gid) kv.append(el('span', null, 'Group'), el('span', null, 'saved'));
    s.appendChild(kv);
    const btns = el('div', 'btns'), mk = (lab, fn) => { const b = el('button', 'lab', lab); b.onclick = fn; btns.appendChild(b); };
    mk(L.gid ? 'Save group' : 'Save as group', () => saveLens(S.activeLens)); mk('Close lens', () => closeLens(S.activeLens)); if (S.lenses.length > 1) mk('Close all', clearLenses);
    s.appendChild(btns);
    s.appendChild(el('p', 'note', S.lenses.length > 1 ? 'Each slice zooms on its own. Drag a file from one slice onto another to add it there.' : 'Add more lenses from the key, the search (Enter) or shift-click on any ring — up to four split the circle.'));
    return s;
  }
  function focusSection() {
    const rv = RV(), T = rv.tree, id = S.mode === 'list' ? S.list : rv.focus, nd = T.nodes[id] || T.nodes[0], s = sec('Focus', 'focus');
    s.appendChild(el('div', 'selname', nd.depth && !(rv.lens && nd.id === rv.home) ? nd.label : rv.lens ? rv.lens.title : 'Everything'));
    const kv = el('div', 'kv');
    kv.append(el('span', null, 'Items'), el('span', null, fmt(nd.n)), el('span', null, 'Time'), el('span', null, fmon(nd.t0) + (fmon(nd.t0) !== fmon(nd.t1) ? ' – ' + fmon(nd.t1) : '')));
    const parts = GRID_ORDER.map(kn => [kn, nd.kc[D.kindIx[kn]] || 0]).filter(x => x[1]).map(x => fmt(x[1]) + ' ' + KLAB[x[0]].toLowerCase());
    kv.append(el('span', null, 'Holds'), el('span', null, parts.join(' · ')));
    s.appendChild(kv);
    const btns = el('div', 'btns'), mk = (lab, fn) => { const b = el('button', 'lab', lab); b.onclick = fn; btns.appendChild(b); };
    if (S.mode === 'rings') mk('List  L', () => go('rings', { list: id })); else mk('Back to rings', () => go('rings', { rf: id }));
    if (nd.parent >= 0 && !(rv.lens && nd.id === rv.home)) mk('Up', () => focusNode(nd.parent));
    if (S.mode === 'rings') mk('Open as lens', () => openLens(nodeLens(rv, id)));
    s.appendChild(btns);
    // the same work in other sectors — one project, several kinds of material
    const wid0 = ancestorOfType(T, id, 'work'), w = wid0 != null ? T.nodes[wid0].key : -1;
    if (w >= 0) {
      const ch = chain(T, id), others = T.nodes.filter(n => n.type === 'work' && n.key === w && !ch.includes(n.id));
      if (others.length) {
        s.appendChild(el('span', 'lab dim', workName(w) + ' also in')).style.cssText = 'display:block;margin-top:10px';
        others.slice(0, 12).forEach(on => { const sid = ancestorOfType(T, on.id, 'sector'), r = el('button', 'row'); r.append(el('span', 'grow', sid != null ? T.nodes[sid].label : on.label), el('span', 'r', fmt(on.n))); r.onclick = () => focusNode(on.id); s.appendChild(r); });
      }
      // project deadline: kept as deadline: in the project's note, so Obsidian sees it too
      s.appendChild(el('span', 'flab lab', 'Deadline · ' + workName(w)));
      const dr = el('div', 'drow'), di = el('input', 'fld'); di.type = 'date'; di.id = 'dl-date'; di.value = S.dl.get(w) || ''; di.setAttribute('aria-label', 'Deadline for ' + workName(w));
      const ds = el('button', 'lab', 'Save'); ds.onclick = () => setDeadline(workName(w), di.value);
      const dc = el('button', 'lab', 'Clear'); dc.onclick = () => { di.value = ''; setDeadline(workName(w), ''); };
      dr.append(di, ds, dc); s.appendChild(dr);
      s.appendChild(el('p', 'note', 'Saved as “deadline:” at the top of the project’s note (Obsidian shows it under Properties). Within ' + DUE_DAYS + ' days the project gets a blinking ▲ and a mark on the year grid.'));
    }
    // make: a virtual group, or a real folder on disk
    s.appendChild(el('span', 'flab lab', 'Make'));
    const mb = el('div', 'btns'), m2 = (lab, fn) => { const b = el('button', 'lab', lab); b.onclick = fn; mb.appendChild(b); return b; };
    m2('New group', () => openLens({ title: 'Group ' + (S.groups.length + S.lenses.length + 1), empty: true }));
    const where = nodeDir(T, id);
    const fb = m2('New folder here', () => { form.hidden = !form.hidden; if (!form.hidden) fin.focus(); });
    if (!where) { fb.disabled = true; fb.title = 'This spans several folders — zoom into one'; }
    s.appendChild(mb);
    const form = el('div', 'drow'); form.hidden = true;
    const fin = el('input', 'fld'); fin.placeholder = 'Folder name'; fin.id = 'mk-name'; fin.setAttribute('aria-label', 'New folder name');
    const fgo = el('button', 'lab', 'Create'); fgo.onclick = () => makeFolder(where, fin.value);
    fin.onkeydown = e => { if (e.key === 'Enter') { e.stopPropagation(); makeFolder(where, fin.value); } };
    form.append(fin, fgo); s.appendChild(form);
    if (where) s.appendChild(el('p', 'note', 'A group is virtual — files stay where they are. A folder is real, made in ' + where.label + '.'));
    return s;
  }
  function selectionSection(i) {
    const kn = kindOf(i), s = sec('Selection', 'sel');
    if (VISUAL.has(kn)) {
      const prev = el('div', 'prev');
      if (S.live) { const img = new Image(); img.alt = ''; img.src = API.thumb(i); img.onerror = () => { prev.textContent = ''; prev.appendChild(el('span', 'disp', extOf(i).toUpperCase())); }; prev.appendChild(img); }
      else { const cv = document.createElement('canvas'), d = DPR(); cv.width = 272 * d; cv.height = 170 * d; const c = cv.getContext('2d'); c.scale(d, d); window.S8DEMO.paint(c, i, 272, 170, kn, workName(D.w[i])); prev.appendChild(cv); }
      s.appendChild(prev);
    }
    s.appendChild(el('div', 'selname', titleOf(i)));
    const kv = el('div', 'kv'); const add = (k, v, fn) => { const b = el(fn ? 'button' : 'span', null, v); if (fn) { b.onclick = fn; b.style.textAlign = 'left'; b.style.textDecoration = 'underline'; b.style.textDecorationColor = 'var(--l)'; } kv.append(el('span', null, k), b); };
    add('Kind', KONE[kn] + ' · ' + extOf(i).toUpperCase());
    add('Sector', D.sectors[D.s[i]].name, () => focusItemNode(i, 'sector'));
    add('Work', workName(D.w[i]), () => focusItemNode(i, 'work'));
    add('Date', fdate(D.t[i])); add('Size', fsize(D.z[i]));
    add('Path', pathOf(i));
    s.appendChild(kv);
    const pr = promptOf(i);
    if (pr) { s.appendChild(el('span', 'lab dim', 'Prompt')); s.appendChild(el('div', 'prompt', pr)); const cb = el('button', 'lab', 'Copy prompt'); cb.style.height = '28px'; cb.onclick = () => copyText(pr, 'Prompt copied'); s.appendChild(cb); }
    const x = D.x.get(i) || {};
    if (x.tg && x.tg.length) { const c = el('div', 'chips'); x.tg.slice(0, 16).forEach(tg => { const b = el('button', 'chip lab', '#' + tg); b.onclick = () => setQuery('#' + tg); c.appendChild(b); }); s.appendChild(c); }
    const links = linkedOf(i);
    if (links.length) {
      s.appendChild(el('span', 'lab dim', 'Linked · ' + links.length)).style.cssText = 'display:block;margin-top:10px;margin-bottom:4px';
      links.slice(0, 12).forEach(j => { const r = el('button', 'row'); const sw = el('span', 'sw' + shp(D.k[j])); sw.style.background = C.k[D.k[j]]; r.append(sw, el('span', 'grow', titleOf(j))); r.onclick = () => select(j); r.ondblclick = () => openItem(j); s.appendChild(r); });
    }
    const btns = el('div', 'btns');
    const mk = (lab, fn) => { const b = el('button', 'lab', lab); b.onclick = fn; btns.appendChild(b); };
    mk('View', () => openItem(i)); mk('Show in rings', () => locate(i)); mk('+ Patch', () => Patch.addMaterial(i)); mk('Open', () => openDefault(i)); mk('Reveal', () => revealItem(i)); mk('Copy path', () => copyText(pathOf(i), 'Path copied'));
    s.appendChild(btns);
    const into = S.lenses.map((L, j) => [L, j]).filter(([L]) => L.v.tree.pos[i] < 0);
    if (into.length) { const lb = el('div', 'btns'); into.forEach(([L, j]) => { const b = el('button', 'lab', '+ ' + L.title); b.title = 'Add to the lens ' + L.title; b.onclick = () => addToLens(j, i); lb.appendChild(b); }); s.appendChild(lb); }
    const tools = S.tools.filter(t => compatible(t, i));
    if (tools.length) { const tb = el('div', 'btns'); tools.forEach(t => { const b = el('button', 'lab', '→ ' + t.name); b.onclick = () => useTool(t, i); tb.appendChild(b); }); s.appendChild(tb); }
    s.appendChild(el('span', 'flab lab', 'Sidecar note'));
    const vis = ['private', 'shared', 'public'];
    const form = el('div'); s.appendChild(form);
    const fill = data => {
      form.textContent = '';
      let cur = data.visibility || 'private';
      const vr = stepperRow('Visibility', cur.toUpperCase(), () => { cur = vis[(vis.indexOf(cur) + 2) % 3]; vr.querySelector('.cl:not(.fc)').textContent = cur.toUpperCase(); }, () => { cur = vis[(vis.indexOf(cur) + 1) % 3]; vr.querySelector('.cl:not(.fc)').textContent = cur.toUpperCase(); });
      form.appendChild(vr);
      const tg = el('input', 'fld'); tg.id = 'sc-tags'; tg.placeholder = 'tags, comma separated'; tg.value = (data.tags || []).join(', ');
      const ln = el('input', 'fld'); ln.id = 'sc-links'; ln.placeholder = 'links to notes, comma separated'; ln.value = (data.links || []).join(', ');
      const bd = el('textarea', 'fld'); bd.id = 'sc-body'; bd.placeholder = 'What this is, why it matters, where it goes next'; bd.value = data.body || '';
      const sv = el('button', 'btn cl', 'Save note'); sv.style.marginTop = '12px';
      sv.onclick = async () => {
        const payload = { i, visibility: cur, tags: tg.value.split(',').map(v => v.trim()).filter(Boolean), links: ln.value.split(',').map(v => v.trim()).filter(Boolean), body: bd.value };
        if (!S.live) { S.sidecars.set(i, payload); toast('Saved for this session (sample data)'); return; }
        const r = await API.post('/api/sidecar', payload); toast(r.ok ? 'Saved · ' + r.path.split(/[\\/]/).slice(-2).join('/') : r.error);
      };
      form.append(tg, ln, bd, sv);
      if (data.path) { const p = el('p', 'note', data.exists ? 'Saved at ' + data.path : 'Will be saved to ' + data.path); p.style.overflowWrap = 'anywhere'; form.appendChild(p); }
    };
    if (S.live) { form.textContent = '…'; API.get('/api/sidecar?i=' + i).then(fill).catch(() => fill({})); }
    else fill(S.sidecars.get(i) || {});
    return s;
  }

  // ───────────────────────────────────────── tooltip, toast
  const tip = $('#tip');
  function showTip(x, y, t) {
    if (!t) return hideTip();
    tip.innerHTML = '<b>' + esc(t[0]) + '</b><span class="dim">' + esc(t[1] || '').replace(/\n/g, '<br>') + '</span>';
    tip.style.display = 'block';
    const r = tip.getBoundingClientRect();
    tip.style.left = clamp(x + 14, 8, W - r.width - 8) + 'px'; tip.style.top = clamp(y + 14, 8, H - r.height - 8) + 'px';
  }
  function hideTip() { tip.style.display = 'none'; }
  let toastT = 0;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3200); }
  function setQuery(q) { const inp = $('#q'); inp.value = q; S.q = q; runSearch(); }
  function lensFromSearch() {
    const q = S.q.trim(); if (!q) return;
    if (!S.mcount) return toast('Nothing matches “' + q + '”');
    const inp = $('#q'); inp.value = ''; S.q = ''; runSearch();
    openLens({ title: q.replace(/\b[a-z]+:/g, '').replace(/"/g, '').trim() || q, q });
  }

  // ───────────────────────────────────────── input
  function wheelDelta(e) { return e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * H : e.deltaY; }
  function bind() {
    const ptr = { down: null, moved: false, pts: new Map(), pinch: null, last: { t: 0, key: '' }, drag: null };
    const ghost = $('#ghost');
    // hits on the whole view: the tools orbit first, then the rings
    const hitAt = (v, x, y) => { if (S.mode === 'rings') { const [cx, cy] = Rings.center(), o = Orbit.hit(x, y, cx, cy); if (o) return o; } return v.hit(x, y); };
    field.addEventListener('pointerdown', e => {
      const v = views[S.mode]; if (!v) return;
      field.setPointerCapture(e.pointerId); ptr.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptr.pts.size === 1) {
        ptr.down = { x: e.clientX, y: e.clientY, cam: { rot: v.rot } }; ptr.moved = false; ptr.drag = null;
        if (v === LensView && S.lenses.length > 1) { const h = v.hit(e.clientX, e.clientY); if (h && (h.type === 'leaf' || h.type === 'cell') && h.i >= 0) ptr.drag = { i: h.i, s: h.s }; }
      }
      else if (ptr.pts.size === 2) { const [a, b] = [...ptr.pts.values()]; ptr.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; ptr.moved = true; }
    });
    field.addEventListener('pointermove', e => {
      const v = views[S.mode]; if (!v) return;
      if (ptr.pts.has(e.pointerId)) ptr.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptr.pinch && ptr.pts.size === 2) {
        const [a, b] = [...ptr.pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        v.wheel({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2, deltaY: (ptr.pinch.d - d) * 4, deltaMode: 0 }); ptr.pinch.d = d;
        return;
      }
      if (ptr.down) {
        const dx = e.clientX - ptr.down.x, dy = e.clientY - ptr.down.y;
        if (!ptr.moved && Math.hypot(dx, dy) > 4) ptr.moved = true;
        if (ptr.moved && ptr.drag) {
          // carry a file to another lens slice
          const j = LensView.sliceAt(e.clientX, e.clientY), L = S.lenses[j];
          ghost.textContent = titleOf(ptr.drag.i) + (j !== ptr.drag.s && L ? '  →  ' + L.title : '');
          ghost.style.display = 'block'; ghost.style.left = (e.clientX + 14) + 'px'; ghost.style.top = (e.clientY + 10) + 'px';
          if (LensView.drop !== j) { LensView.drop = j; invalidate(); }
          hideTip(); return;
        }
        if (ptr.moved) { v.pan(dx, dy, ptr.down.cam, ptr.down); hideTip(); }
        return;
      }
      const h = hitAt(v, e.clientX, e.clientY);
      const oh = h && h.type === 'tool' ? h : null;
      if (Orbit.hover !== oh && (!oh || !Orbit.hover || oh.tool !== Orbit.hover.tool || oh.part !== Orbit.hover.part)) { Orbit.hover = oh; invalidate(); }
      const vh = oh ? null : h;
      if (v.key(v.hover) !== v.key(vh)) { v.hover = vh; invalidate(); }
      field.style.cursor = h ? 'pointer' : 'grab';
      showTip(e.clientX, e.clientY, oh ? Orbit.tip(oh) : v.tip(vh));
    });
    const end = e => {
      const v = views[S.mode];
      if (ptr.drag && ptr.moved) {
        ghost.style.display = 'none'; LensView.drop = null;
        const j = LensView.sliceAt(e.clientX, e.clientY);
        if (j !== ptr.drag.s) addToLens(j, ptr.drag.i); else invalidate();
        ptr.drag = null;
      } else if (v && ptr.down && !ptr.moved && ptr.pts.size === 1) {
        const h = hitAt(v, e.clientX, e.clientY), key = h && h.type === 'tool' ? 'tool' + h.tool.id + h.part : v.key(h), now = performance.now();
        const dbl = key && key === ptr.last.key && now - ptr.last.t < 380;
        ptr.last = { t: dbl ? 0 : now, key };
        if (h && h.type === 'tool') Orbit.click(h, e); else v.click(h, dbl, e);
      }
      ptr.drag = null;
      ptr.pts.delete(e.pointerId);
      if (ptr.pts.size < 2) ptr.pinch = null;
      if (!ptr.pts.size) ptr.down = null;
    };
    field.addEventListener('pointerup', end);
    field.addEventListener('pointercancel', e => { ptr.pts.delete(e.pointerId); ptr.down = null; ptr.pinch = null; ptr.drag = null; ghost.style.display = 'none'; LensView.drop = null; });
    field.addEventListener('pointerleave', () => { hideTip(); const v = views[S.mode]; if (v && v.hover) { v.hover = null; invalidate(); } if (Orbit.hover) { Orbit.hover = null; invalidate(); } });
    field.addEventListener('wheel', e => { e.preventDefault(); const v = views[S.mode]; if (v) { v.wheel(e); hideTip(); } }, { passive: false });
    window.addEventListener('resize', resize);
    $('#bL').onclick = () => togglePanel('left');
    $('#bR').onclick = () => togglePanel('right');
    $('#dotb').onclick = () => openPanel('right', 'run');
    $('#vPrev').onclick = () => stepView(-1); $('#vNext').onclick = () => stepView(1);
    $('#vLab').onclick = () => ($('#vList').hidden ? openVList() : closeVList());
    $('#inset').onclick = () => go('rings', { rf: 0 });
    const q = $('#q');
    q.placeholder = 'Search ' + fmt(D.N) + ' items';
    q.addEventListener('input', () => { S.q = q.value; clearTimeout(searchT); searchT = setTimeout(runSearch, D.N > 200000 ? 160 : 60); });
    q.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        clearTimeout(searchT); runSearch(); e.stopPropagation();
        if (S.view === 'rings' && S.item < 0 && S.list < 0 && !e.shiftKey && S.q.trim() && S.mcount) { lensFromSearch(); q.blur(); return; }
        if (S.match) go('field', {}); q.blur();
      }
      if (e.key === 'Escape') { if (q.value) { q.value = ''; S.q = ''; runSearch(); } else q.blur(); e.stopPropagation(); }
    });
    $('#qx').onclick = () => { q.value = ''; S.q = ''; runSearch(); q.focus(); };
    $('#ql').onclick = () => lensFromSearch();
    document.addEventListener('keydown', e => {
      const tag = (e.target && e.target.tagName) || '';
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (e.key === 'Escape') {
        if (typing) { e.target.blur(); return; }
        if (!$('#vList').hidden) return closeVList();
        if (S.left || S.right) { setPanel('left', false); setPanel('right', false); return; }
        back(); return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k === '/') { e.preventDefault(); q.focus(); q.select(); }
      else if (k === '[') togglePanel('left');
      else if (k === ']') togglePanel('right');
      else if (k >= '1' && k <= '5') setView(VIEWS[+k - 1][0]);
      else if ((k === 'Backspace' || k === 'Delete') && S.mode === 'patch') { e.preventDefault(); if (Patch.sel) Patch.remove(Patch.sel); else if (Patch.selWire >= 0) { Patch.P.wires.splice(Patch.selWire, 1); Patch.selWire = -1; Patch.persist(); Patch.view(); } }
      else if (k === 'Backspace') { e.preventDefault(); up(); }
      else if (k === 'ArrowLeft' && S.mode === 'item') stepItem(-1);
      else if (k === 'ArrowRight' && S.mode === 'item') stepItem(1);
      else if (k === 'Enter' && S.sel >= 0 && S.mode !== 'item' && S.mode !== 'patch' && !(e.target && e.target.classList && e.target.classList.contains('tile'))) openItem(S.sel);
      else if ((k === 'l' || k === 'L') && S.mode === 'rings') go('rings', { list: RV().focus });
      else if ((k === 'p' || k === 'P') && S.sel >= 0 && S.mode !== 'patch') Patch.addMaterial(S.sel);
      else if ((k === 'o' || k === 'O') && S.sel >= 0) openDefault(S.sel);
      else if ((k === 'r' || k === 'R') && S.sel >= 0) revealItem(S.sel);
    });
    document.addEventListener('pointerdown', e => { if (!$('#vList').hidden && !e.target.closest('.stepper')) closeVList(); });
  }
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    const d = DPR(); field.width = Math.round(W * d); field.height = Math.round(H * d); field.style.width = W + 'px'; field.style.height = H + 'px';
    invalidate(); Inset.draw(); renderLegend();
    if (S.mode === 'patch') Patch.wires();
  }

  // ───────────────────────────────────────── boot
  const bootMsg = m => { $('#bootMsg').textContent = m; };
  async function boot() {
    const meta = document.querySelector('meta[name="s8-token"]');
    S.token = meta ? meta.getAttribute('content') : '';
    applyTheme();
    let J = null;
    if (S.token) {
      try {
        bootMsg('Connecting to the bridge');
        let st0 = await API.get('/api/status');
        S.live = true; applyStatus(st0);
        while (!st0.items && st0.progress && st0.progress.state === 'running') { bootMsg('Indexing your folders · ' + fmt(st0.progress.files) + ' items · ' + (st0.progress.root || '')); await new Promise(r => setTimeout(r, 900)); st0 = await API.get('/api/status'); applyStatus(st0); }
        bootMsg('Loading the index');
        J = await API.get('/api/index');
      } catch (e) { console.warn('bridge:', e); S.live = false; bootMsg('Bridge not reachable — loading sample data'); }
    }
    if (!J) {
      const small = window.innerWidth < 700 || (navigator.deviceMemory || 8) < 4;
      bootMsg(small ? 'Building the sample archive · quarter scale on this device' : 'Building the sample archive · 717,440 items');
      await nextFrame();
      J = window.S8DEMO.build(small ? 0.25 : 1);
      S.tools = window.S8DEMO.TOOLS; S.tasks = window.S8DEMO.TASKS.map(t => ({ ...t, log: [] }));
    }
    D = makeStore(J);
    S.hiddenK = new Uint8Array(D.kinds.length);
    readColors();
    bootMsg('Growing the rings'); await nextFrame();
    buildTrees();
    await Patch.load();
    await loadGroups(); await loadDeadlines(); computeFlags();
    W = window.innerWidth; H = window.innerHeight;
    bind(); resize(); render(); updateDot();
    $('#boot').remove();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { FONTS = ''; invalidate(); });
    if (S.live) setInterval(pollTasks, 3000);
    else { const cut = S.tasks.find(t => t.id === 'cut'); if (cut) demoRun(cut, 0); }
    window.__s8 = { S, Rings, Graph, Patch, LensView, Orbit, get D() { return D; }, go, openItem, select, setQuery, setView, locate, focusNode, focusAll, openLens, closeLens, clearLenses, addToLens, nodeLens, saveLens, openGroup, setDeadline, computeFlags, ringGeo };
    window.__ready = true;
  }
  function applyStatus(st0) { S.status = st0; S.tools = st0.tools || []; S.tasks = st0.tasks || []; S.progress = st0.progress; S.caps = st0.caps || {}; }
  boot().catch(e => { console.error(e); bootMsg('Could not start: ' + e.message); });
})();
