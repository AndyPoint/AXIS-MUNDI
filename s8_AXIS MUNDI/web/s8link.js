/* SYSTEM 8 · s8link.js — how a tool joins the link language (build 1.5)

   A tool joins once. It declares a table of named numbers, and from then on anything can drive it
   and it can drive anything: the patch room, the Builder, MIDI, another tool on the iPad.

     <script src="http://127.0.0.1:8808/s8link.js"></script>      (or copy this file next to the tool)
     <script>
       S8Link.join({
         tool: 'keha', name: 'KEHÄ',
         params: {                                                  // scalars only — never vectors or colours
           radius: { get: () => r, set: v => r = v, min: 0,  max: 400, default: 120 },
           petals: { get: () => n, set: v => n = Math.round(v), min: 3, max: 64, default: 12 },
         },
         signals: { pressure: () => pen.pressure },                 // optional: values this tool gives out, 0–1
         actions: { reset: () => reset() },                         // optional: things that can be triggered
       });
     </script>

   Rules it keeps:
   · LOCAL first. With no bridge the tool runs exactly as before; the link is silent, nothing breaks.
   · Setters are called at most once per frame, with a value already clamped to min–max.
   · Parameters are also sources: each one is published as a signal "<tool>.<param>", normalised 0–1.
   · Pixel-derived values are not sent across the network: keep samplers inside the tool.

   Where the bridge is: the page's own address when the tool is served by the bridge (/tools/…),
   otherwise ?s8=ws://host:8808/ws in the tool's URL, or S8Link.join({ …, hub: 'ws://…' }).
*/
(function () {
  if (window.S8Link) return;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const L = {
    ws: null, spec: null, state: 'alone', pending: new Map(), last: new Map(), retry: 0, listeners: new Set(),
    hubUrl(spec) {
      const q = new URLSearchParams(location.search).get('s8');
      if (spec.hub) return spec.hub;
      if (q) return q;
      const me = document.currentScript || [...document.scripts].find(s => /s8link\.js/.test(s.src));
      if (me && me.src && /^https?:/.test(me.src)) { const u = new URL(me.src); return (u.protocol === 'https:' ? 'wss://' : 'ws://') + u.host + '/ws'; }
      if (/^https?:/.test(location.protocol)) return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
      return null;
    },
    table() {
      const p = {}, P = this.spec.params || {};
      for (const [k, d] of Object.entries(P)) {
        const v = typeof d.get === 'function' ? Number(d.get()) : undefined;
        p[k] = { min: d.min, max: d.max, default: d.default !== undefined ? d.default : d.min, value: Number.isFinite(v) ? v : undefined, unit: d.unit || '' };
      }
      return p;
    },
    join(spec) {
      this.spec = spec;
      this.url = this.hubUrl(spec);
      this.connect();
      const tick = () => { this.frame(); requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      return this;
    },
    connect() {
      if (!this.url) return;
      let ws;
      try { ws = new WebSocket(this.url); } catch (e) { return this.later(); }
      this.ws = ws;
      ws.onopen = () => {
        this.state = 'joined'; this.retry = 0; this.last.clear();
        const s = this.spec;
        this.send({ t: 'hello', tool: s.tool, name: s.name || s.tool, params: this.table(), signals: Object.keys(s.signals || {}),
          actions: Object.keys(s.actions || {}), requires: 'LOCAL', accepts: ['NETWORK'], page: location.href.split('?')[0] });
        this.emit();
      };
      ws.onmessage = ev => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === 'set' && m.tool === this.spec.tool && this.spec.params && this.spec.params[m.p]) this.pending.set(m.p, m.v);
        else if (m.t === 'act' && m.tool === this.spec.tool && this.spec.actions && this.spec.actions[m.id]) { try { this.spec.actions[m.id](m.args); } catch (e) { console.warn('s8link action', m.id, e); } }
        for (const f of this.listeners) f(m);
      };
      ws.onclose = () => { this.state = 'alone'; this.ws = null; this.emit(); this.later(); };
      ws.onerror = () => { try { ws.close(); } catch (e) { /* closing */ } };
    },
    later() { clearTimeout(this._t); this._t = setTimeout(() => this.connect(), Math.min(10000, 1000 * (++this.retry))); },
    send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); },
    // once per frame: apply incoming values, publish what changed (parameters and signals, normalised)
    frame() {
      const s = this.spec, P = s.params || {};
      for (const [k, v] of this.pending) { const d = P[k]; if (d && typeof d.set === 'function') { try { d.set(clamp(Number(v), d.min, d.max)); } catch (e) { console.warn('s8link set', k, e); } } }
      this.pending.clear();
      if (!this.ws || this.ws.readyState !== 1) return;
      const now = performance.now(); if (this._pub && now - this._pub < 33) return; this._pub = now;
      const out = (id, v01, raw) => { const p = this.last.get(id); if (p === undefined || Math.abs(p - v01) > 1 / 512) { this.last.set(id, v01); this.send({ t: 'sig', id: s.tool + '.' + id, v: v01, raw }); } };
      for (const [k, d] of Object.entries(P)) { if (typeof d.get !== 'function') continue; const v = Number(d.get()); if (Number.isFinite(v)) out(k, clamp((v - d.min) / ((d.max - d.min) || 1), 0, 1), v); }
      for (const [k, f] of Object.entries(s.signals || {})) { const v = Number(f()); if (Number.isFinite(v)) out(k, clamp(v, 0, 1), v); }
    },
    on(f) { this.listeners.add(f); return () => this.listeners.delete(f); },
    emit() { for (const f of this.listeners) f({ t: 'state', state: this.state }); },
  };
  window.S8Link = { join: s => L.join(s), on: f => L.on(f), get state() { return L.state; } };
})();
