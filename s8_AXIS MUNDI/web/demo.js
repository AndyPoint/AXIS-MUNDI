/* SYSTEM 8 · Control room 1.0 — sample archive.
   Used only when no bridge is running. 717,440 generated items at the scale Andy gave
   (340 md notes · 100 skills · 3,200 PDF + text · 500,000 photos · 200,000 AI images ·
   10,000 videos · 1,400 screenshots · 1,300 3D · 1,100 CAD). Names, dates and links are invented. */
(function () {
  'use strict';
  const KINDS = ['note', 'skill', 'source', 'photo', 'ai', 'video', 'screen', 'm3d', 'cad', 'audio', 'code'];
  const KI = Object.fromEntries(KINDS.map((k, i) => [k, i]));
  const SECTORS = [
    { id: 'brain', name: 'Second brain' }, { id: 'ideas', name: 'Ideas · theory · books' },
    { id: 'architecture', name: 'Architecture' }, { id: 'art', name: 'Art' }, { id: 'video', name: 'Video' },
    { id: 'image', name: 'Image' }, { id: 'generation', name: 'AI generation' }];
  const SI = Object.fromEntries(SECTORS.map((s, i) => [s.id, i]));
  const ROOTS = [
    { name: 'Second brain', sector: 'brain', path: '~/Obsidian/Second brain', ok: true },
    { name: 'Skills', sector: 'brain', path: '~/.claude/skills', ok: true },
    { name: 'Library', sector: 'ideas', path: '~/Documents/Library', ok: true },
    { name: 'Architecture', sector: 'architecture', path: '~/Work/Architecture', ok: true },
    { name: 'Art', sector: 'art', path: '~/Work/Art', ok: true },
    { name: 'Video', sector: 'video', path: '~/Movies', ok: true },
    { name: 'Photos', sector: 'image', path: '~/Pictures/Photos', ok: true },
    { name: 'Midjourney', sector: 'generation', path: '~/Pictures/Midjourney', ok: true },
    { name: 'Desktop', sector: 'auto', path: '~/Desktop', ok: true }];
  const RI = Object.fromEntries(ROOTS.map((r, i) => [r.name, i]));
  const NOW = Date.UTC(2026, 9, 24, 20, 0) / 1000;
  const yr = y => Date.UTC(Math.floor(y), 0, 1) / 1000 + (y % 1) * 365.25 * 86400;

  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const R = rng(20261024);
  const pick = a => a[(R() * a.length) | 0];
  const HEX = '0123456789abcdef';
  const hex = n => { let s = ''; for (let i = 0; i < n; i++) s += HEX[(R() * 16) | 0]; return s; };
  const pad = (n, l) => String(n).padStart(l, '0');
  const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const PERIOD = {
    'Mars crater city': [2026.55, 2026.81], '111 days of silence': [2025.7, 2026.81], 'Ensō · Hyvinkää': [2025.3, 2025.62],
    'Memory engine': [2026.5, 2026.76], 'Procedural architecture': [2026.58, 2026.81], 'Dark gallery': [2026.55, 2026.7],
    'Competitions': [2013, 2026.5], 'Kanttia archive': [2017.1, 2024.9], 'Aalto studies': [2006.7, 2012.5],
    'BEYOND': [2025.5, 2026.8], 'Metsän puolella': [2026.6, 2026.72], 'KEHÄ': [2025.4, 2026.6], 'BLACK FIELD': [2025.5, 2026.7],
    'Just sitting': [2026.6, 2026.81], 'Exhibitions': [2010, 2026.7], 'Sketchbooks': [2006.5, 2026.81],
    'Mirror animations': [2025.6, 2026.81], 'VJ sets': [2016, 2026.7], 'Circuit Control': [2026.5, 2026.81],
    'Feedback loops': [2026.6, 2026.81], 'Renders': [2014, 2026.81], 'Documentation': [2012, 2026.81],
    'Architecture styles': [2022.6, 2026.81], 'Portals': [2023.2, 2025.9], 'Textures': [2022.8, 2026.6],
    'Landscapes': [2023, 2026.4], 'Brutalism': [2023.5, 2026.3], 'Midjourney': [2022.6, 2026.81],
    'Books': [2008, 2026.8], 'Papers': [2014, 2026.8], 'Theory': [2010, 2026.81], 'Lecture notes': [2006.7, 2013],
    'Projects': [2023.5, 2026.81], 'Daily notes': [2026.0, 2026.81], 'Pointlab': [2024, 2026.8], 'Tools': [2025, 2026.81],
    'Research': [2023.5, 2026.8], 'Skills': [2025.3, 2026.81], 'SYSTEM 8': [2025.6, 2026.81], 'Desktop': [2018, 2026.81],
    'SC3NE': [2026.2, 2026.81], 'CUTOUT': [2026.3, 2026.81], 'FORM': [2026.6, 2026.81], 'THRESHOLD': [2026.5, 2026.75], 'ROSCHACK': [2026.6, 2026.8], 'AUTO TYPO': [2025.5, 2026.6],
  };
  const YEARS = []; for (let y = 2006; y <= 2026; y++) { YEARS.push([String(y), 1 + (y - 2006) * 0.35]); PERIOD[String(y)] = [y, y === 2026 ? 2026.81 : y + 0.999]; }

  // [sector, kind, count, root, subfolder, works [[name, weight]]]
  const PLAN = [
    ['brain', 'note', 340, 'Second brain', '', [['Projects', 34], ['Daily notes', 25], ['Theory', 12], ['Pointlab', 12], ['Tools', 8], ['Research', 10], ['SYSTEM 8', 12], ['SC3NE', 4], ['CUTOUT', 3], ['FORM', 3], ['THRESHOLD', 2], ['ROSCHACK', 2], ['AUTO TYPO', 2]]],
    ['brain', 'skill', 100, 'Skills', '', [['Skills', 1]]],
    ['ideas', 'source', 3200, 'Library', '', [['Books', 30], ['Papers', 45], ['Theory', 15], ['Lecture notes', 10]]],
    ['architecture', 'cad', 1100, 'Architecture', 'cad', [['Mars crater city', 6], ['Ensō · Hyvinkää', 8], ['Memory engine', 3], ['Procedural architecture', 5], ['Competitions', 30], ['Kanttia archive', 36], ['Aalto studies', 10], ['Dark gallery', 2]]],
    ['architecture', 'm3d', 900, 'Architecture', '3d', [['Mars crater city', 18], ['Ensō · Hyvinkää', 10], ['Memory engine', 12], ['Procedural architecture', 20], ['Competitions', 15], ['Kanttia archive', 20], ['Dark gallery', 5]]],
    ['architecture', 'photo', 38000, 'Architecture', 'photos', [['Kanttia archive', 40], ['Competitions', 20], ['Aalto studies', 25], ['Ensō · Hyvinkää', 5], ['Mars crater city', 2], ['Dark gallery', 3], ['Memory engine', 5]]],
    ['architecture', 'ai', 22000, 'Architecture', 'ai', [['Mars crater city', 35], ['Procedural architecture', 15], ['Memory engine', 10], ['Ensō · Hyvinkää', 10], ['Competitions', 15], ['Dark gallery', 15]]],
    ['architecture', 'screen', 400, 'Architecture', 'screens', [['Procedural architecture', 24], ['Mars crater city', 24], ['Memory engine', 16], ['Kanttia archive', 16], ['SC3NE', 12], ['FORM', 8]]],
    ['art', 'photo', 120000, 'Art', 'photos', [['Exhibitions', 35], ['Sketchbooks', 40], ['111 days of silence', 10], ['Metsän puolella', 5], ['BLACK FIELD', 4], ['KEHÄ', 6]]],
    ['art', 'ai', 60000, 'Art', 'ai', [['111 days of silence', 30], ['BEYOND', 20], ['KEHÄ', 15], ['Metsän puolella', 10], ['Just sitting', 10], ['BLACK FIELD', 15]]],
    ['art', 'm3d', 400, 'Art', '3d', [['111 days of silence', 50], ['Dark gallery', 30], ['Exhibitions', 20]]],
    ['art', 'video', 1500, 'Art', 'video', [['111 days of silence', 30], ['Exhibitions', 40], ['Just sitting', 15], ['KEHÄ', 15]]],
    ['art', 'screen', 300, 'Art', 'screens', [['KEHÄ', 26], ['BLACK FIELD', 20], ['Just sitting', 18], ['ROSCHACK', 12], ['THRESHOLD', 12], ['AUTO TYPO', 12]]],
    ['video', 'video', 8500, 'Video', '', [['Mirror animations', 25], ['VJ sets', 30], ['Circuit Control', 10], ['Feedback loops', 10], ['Renders', 15], ['Documentation', 10]]],
    ['video', 'screen', 200, 'Video', 'screens', [['Mirror animations', 36], ['Feedback loops', 36], ['CUTOUT', 28]]],
    ['image', 'photo', 342000, 'Photos', '', YEARS],
    ['image', 'screen', 500, 'Desktop', '', [['Desktop', 1]]],
    ['generation', 'ai', 118000, 'Midjourney', '', [['Midjourney', 30], ['Architecture styles', 20], ['Mars crater city', 12], ['Portals', 8], ['Textures', 10], ['Landscapes', 10], ['Brutalism', 10]]],
  ];

  const VOCAB = {
    'Mars crater city': ['mars', 'crater', 'city', 'rim', 'transparent', 'tent', 'membrane', 'towers', 'dusk', 'rust', 'dust', 'storm', 'terraces', 'biodome', 'streets', 'red', 'plain', 'habitat'],
    '111 days of silence': ['silence', 'white', 'room', 'empty', 'light', 'fog', 'industrial', 'hall', 'monk', 'vow', 'paper', 'stillness', 'snow', 'void'],
    'Procedural architecture': ['parametric', 'armature', 'lattice', 'structure', 'ribs', 'shell', 'geometry', 'nodes', 'sacred', 'grid'],
    'Memory engine': ['gaussian', 'splat', 'memory', 'room', 'archive', 'point', 'cloud', 'interior', 'ghost'],
    'Ensō · Hyvinkää': ['enso', 'circle', 'church', 'hill', 'timber', 'ring', 'pavilion', 'pines', 'birch'],
    'Dark gallery': ['dark', 'gallery', 'projection', 'object', 'black', 'room', 'glow'],
    'Competitions': ['competition', 'museum', 'library', 'bridge', 'concrete', 'facade', 'atrium', 'courtyard'],
    'BEYOND': ['horizon', 'threshold', 'unknown', 'mist', 'border', 'edge', 'night', 'sea'],
    'KEHÄ': ['mandala', 'radial', 'ring', 'symmetry', 'sacred', 'geometry', 'line', 'circle'],
    'Metsän puolella': ['forest', 'moss', 'spruce', 'roots', 'fog', 'listening', 'trees', 'lichen'],
    'Just sitting': ['zazen', 'cushion', 'plate', 'cymatic', 'sand', 'enso', 'breath'],
    'BLACK FIELD': ['black', 'field', 'void', 'particles', 'noise', 'scan', 'lines'],
    'Architecture styles': ['brutalist', 'gothic', 'metabolist', 'deconstructivist', 'vernacular', 'nordic', 'modernist', 'temple', 'tower', 'section'],
    'Portals': ['portal', 'gate', 'arch', 'door', 'light', 'stone', 'threshold'],
    'Textures': ['texture', 'concrete', 'rust', 'lichen', 'sand', 'paper', 'seamless', 'macro'],
    'Landscapes': ['landscape', 'lava', 'valley', 'ridge', 'aerial', 'glacier', 'plain'],
    'Brutalism': ['brutalist', 'concrete', 'megastructure', 'housing', 'block', 'raw', 'monolith'],
  };
  VOCAB.Midjourney = Object.values(VOCAB).flat();
  const STYLE = ['cinematic', 'architectural photography', 'overcast', 'wide angle', 'film grain', 'axonometric', 'section drawing', 'monochrome', 'golden hour', '35mm'];

  const BOOKS = ['Gaston Bachelard — The Poetics of Space', 'Juhani Pallasmaa — The Eyes of the Skin', 'Junichiro Tanizaki — In Praise of Shadows',
    'Christopher Alexander — A Pattern Language', 'Christopher Alexander — The Timeless Way of Building', 'Douglas Hofstadter — Gödel, Escher, Bach',
    'Ludwig Wittgenstein — Tractatus Logico-Philosophicus', 'Martin Heidegger — Building Dwelling Thinking', 'Benoit Mandelbrot — The Fractal Geometry of Nature',
    "D'Arcy Thompson — On Growth and Form", 'Shunryu Suzuki — Zen Mind, Beginner’s Mind', 'Dōgen — Shōbōgenzō', 'Laozi — Tao Te Ching',
    'Heraclitus — Fragments', 'Plato — Timaeus', 'Corpus Hermeticum', 'David Bohm — Wholeness and the Implicate Order',
    'Varela, Thompson, Rosch — The Embodied Mind', 'Peter Zumthor — Atmospheres', 'Peter Zumthor — Thinking Architecture',
    'Le Corbusier — Toward an Architecture', 'Frei Otto — Finding Form', 'Wassily Kandinsky — Point and Line to Plane', 'Paul Klee — Pedagogical Sketchbook',
    'Andrei Tarkovsky — Sculpting in Time', 'Henri Bergson — Matter and Memory', 'Gilles Deleuze — The Fold', 'Carl Jung — The Red Book',
    'Upanishads', 'Bhagavad Gita', 'Zhuangzi', 'Hesiod — Theogony', 'Euclid — Elements', 'Kitarō Nishida — An Inquiry into the Good',
    'Lebbeus Woods — Radical Reconstruction', 'Aldo Rossi — The Architecture of the City', 'Robin Evans — The Projective Cast', 'Rem Koolhaas — Delirious New York'];
  const PAPER_TOPICS = ['gaussian splatting', 'neural radiance fields', 'controlnet depth conditioning', 'diffusion models', 'procedural modelling', 'shape grammars',
    'tensegrity structures', 'membrane structures', 'mars habitats', 'regolith construction', 'cymatics', 'attention in transformers', 'agent routing',
    'consciousness studies', 'predictive processing', 'fractal dimension', 'space syntax', 'wayfinding', 'acoustic ecology', 'plant bioacoustics'];

  const NOTE_TITLES = {
    'Projects': ['Mars crater city — street plan rules', 'Mars crater city — tent membrane', 'Mars crater city — structures A–D', 'Mars crater city — presentation draft',
      'Mars crater city — node setup', 'Mars crater city — crater environment', '111 days of silence — protocol', '111 days of silence — installations', '111 days of silence — exhibition calendar',
      '111 days of silence — industrial space', 'Ensō · Hyvinkää — competition entry', 'Memory engine — layers', 'Memory engine — renderers', 'Dark gallery — four iPads',
      'Procedural architecture — armature', 'Procedural architecture — phase 0', 'Metsän puolella — forest dialogue', 'BEYOND — chapter map', 'BEYOND — borders of knowing',
      'Circuit Control — Dresden', 'Just sitting — token surprise', 'Exhibitions — 2027 plan', 'AXIS MUNDI — hackathon stage', 'Grant applications 2026'],
    'Daily notes': [],
    'SC3NE': ['SC3NE — workspaces', 'SC3NE — optimisation model', 'SC3NE — export targets', 'SC3NE — UI direction'],
    'CUTOUT': ['CUTOUT MACHINE — channels', 'CUTOUT MACHINE — Push 1 mapping', 'CUTOUT MACHINE — phase 0'],
    'FORM': ['FORM — direct modelling', 'FORM — three stages', 'FORM — tool buttons'],
    'THRESHOLD': ['THRESHOLD — brush', 'THRESHOLD — binary structure'],
    'ROSCHACK': ['ROSCHACK — five states', 'ROSCHACK — image DNA'],
    'AUTO TYPO': ['AUTO TYPO — type synth', 'AUTO TYPO — mutation rules'],
    'Theory': ['Silence as material', 'Fractal zoom as reading', 'Axis mundi', 'Know → make → share', 'The map is the interface', 'Threshold and void',
      'Imperfect symmetry', 'Ensō and the unfinished', 'Attention as weight', 'Light and void'],
    'Pointlab': ['Pointlab — three identities', 'Pointlab — website structure', 'Andy Point — portfolio', 'Antti Piste — visualisation services', 'Pointlab — business plan'],
    'Tools': ['SC3NE — workspaces', 'MIRROR — drawing app', 'FORM — direct modelling', 'CUTOUT MACHINE — channels', 'THRESHOLD — brush', 'ROSCHACK — states',
      'KEHÄ — radial synth', 'AUTO TYPO — type synth', 'BLACK FIELD — instrument', 'VIDEO MIXER — 8 channels', 'PAJA — runner', 'FEEDBACK — flicker fix', 'LIGHT FORCE'],
    'Research': ['Midjourney prompt library', 'ControlNet notes', 'StreamDiffusion in TouchDesigner', 'Gaussian splats for installations', 'Blender MCP', 'Node interfaces compared',
      'Hermes agent setup', 'Multi-machine workflow'],
    'SYSTEM 8': ['SYSTEM 8 control room', 'SYSTEM 8 — design tokens', 'SYSTEM 8 — panels', 'SYSTEM 8 — state dot', 'SYSTEM 8 — radial menu', 'SYSTEM 8 Builder',
      'Control room — build 1.0', 'Control room — rings', 'Control room — gates', 'Control room — year grid'],
  };
  const HUBS = ['SYSTEM 8 control room', 'Midjourney prompt library', 'Know → make → share', '111 days of silence — protocol', 'Mars crater city — street plan rules', 'Pointlab — three identities'];
  const SKILLS = ['blender-geometry-nodes', 'blender-mcp', 'sc3ne-cutout', 'sc3ne-layers', 'flux3-klein-prompt', 'midjourney-prompt', 'controlnet-depth', 'comfyui-workflow',
    'unreal-assembly', 'touchdesigner-streamdiffusion', 'resolume-wire-patch', 'bitwig-grid', 'obsidian-linking', 'second-brain-digest', 'grant-application-fi',
    'exhibition-text', 'press-release', 'portfolio-captions', 'epub-build', 'pdf-layout', 'react-system8', 'system8-tokens', 'system8-panels', 'framer-component',
    'gaussian-splat-capture', 'photogrammetry', 'point-cloud-clean', 'crater-terrain', 'street-plan-generator', 'parametric-structures', 'tent-membrane', 'lattice-ribs',
    'image-naming', 'prompt-recall', 'archive-dedupe', 'video-transcode', 'proxy-render', 'subtitle-fi-en', 'research-consciousness', 'reading-notes'];

  const SENT = {
    'Mars crater city': ['Streets follow the rim and step down toward the centre.', 'The tent spans the whole crater; towers stay under 80 m at the edge.', 'Ten base forms, scanned from sketches, feed the lot generator.', 'Accept the node setup before buildings run overnight.'],
    '111 days of silence': ['One hundred and eleven days without speech; the work is what remains.', 'Twelve exhibitions over the year, one industrial space at the end.', 'The calendar shows silent days filled, free weeks open.'],
    'SYSTEM 8': ['Left panel holds the system, right panel holds the tools.', 'Agents propose, people commit.', 'One accent colour, used only for state and focus.', 'Every room shares one graph; zoom changes the reading, not the data.'],
    default: ['Link this to the project map when it settles.', 'Keep the origin of every image; the prompt is part of the work.', 'Count by attention, not only by volume.', 'Write the decision first, then the reasons.', 'This note collects material for the next build step.'],
  };

  function build(scale) {
    scale = scale || 1;
    const t0 = performance.now();
    const SCALED = new Set(['photo', 'ai', 'video', 'screen']);
    const cntOf = (kind, c) => (SCALED.has(kind) && scale < 1 ? Math.max(1, Math.round(c * scale)) : c);
    const works = [], workIx = new Map();
    const dirs = [], dirRoot = [], dirIx = new Map();
    const total = PLAN.reduce((a, p) => a + cntOf(p[1], p[2]), 0);
    const n = new Array(total), d = new Uint32Array(total), k = new Uint8Array(total), s = new Uint8Array(total),
      w = new Uint32Array(total), t = new Uint32Array(total), z = new Uint32Array(total);
    const x = new Map();
    const W = name => { let i = workIx.get(name.toLowerCase()); if (i === undefined) { i = works.length; workIx.set(name.toLowerCase(), i); works.push({ n: name }); } return i; };
    const DIR = (ri, rel) => { const key = ri + '|' + rel; let i = dirIx.get(key); if (i === undefined) { i = dirs.length; dirIx.set(key, i); dirs.push(rel); dirRoot.push(ri); } return i; };
    let idx = 0;
    const noteIdx = [], noteTitle = [];
    let seq = 1000;
    for (const [sec, kind, count0, rootName, sub, wl] of PLAN) {
      const count = cntOf(kind, count0);
      const ri = RI[rootName];
      const sum = wl.reduce((a, b) => a + b[1], 0);
      let left = count;
      wl.forEach(([wname, wt], j) => {
        let c = j === wl.length - 1 ? left : Math.round(count * wt / sum);
        c = Math.min(c, left); left -= c;
        const wi = W(rootName === wname ? rootName : wname);
        const per = PERIOD[wname] || [2015, 2026.8];
        const relBase = (rootName === wname || rootName === 'Photos' && false) ? '' : wname;
        for (let q = 0; q < c; q++) {
          const i = idx++;
          let tt = yr(per[0] + (per[1] - per[0]) * Math.pow(R(), kind === 'ai' || kind === 'note' ? 0.7 : 1));
          if (tt > NOW) tt = NOW - R() * 86400 * 3;
          t[i] = tt; k[i] = KI[kind]; s[i] = SI[sec]; w[i] = wi;
          let rel = relBase, nm;
          const sl = slug(wname);
          if (kind === 'photo') {
            const y = new Date(tt * 1000).getUTCFullYear();
            nm = y < 2012 ? 'DSC' + pad(seq++ % 100000, 5) + '.JPG' : y < 2019 ? 'DSCF' + pad(seq++ % 10000, 4) + '.JPG' : 'IMG_' + pad(seq++ % 10000, 4) + '.HEIC';
            if (sub) rel = relBase + '/' + sub;
            z[i] = 1800 + (R() * 7000) | 0;
          } else if (kind === 'ai') {
            const voc = VOCAB[wname] || VOCAB.Midjourney;
            if (wname === 'Procedural architecture' && R() < 0.6) {
              nm = 'ComfyUI_' + pad((R() * 99999) | 0, 5) + '_.png';
              x.set(i, { pr: 'controlnet depth, ' + [pick(voc), pick(voc), pick(voc), pick(STYLE)].join(', ') });
            } else {
              const words = [pick(voc), pick(voc), pick(voc), pick(voc), pick(STYLE).replace(/ /g, '_')];
              nm = 'andypoint_' + words.join('_') + '_' + hex(8) + '-' + hex(4) + '-' + hex(4) + '-' + hex(4) + '-' + hex(12) + (R() < 0.5 ? '' : '_' + ((R() * 4) | 0)) + '.png';
            }
            if (sub) rel = relBase + '/' + sub;
            z[i] = 1400 + (R() * 2800) | 0;
          } else if (kind === 'video') {
            nm = sl + '_' + pick(['take', 'loop', 'render', 'set', 'doc', 'shot']) + '_' + pad((R() * 999) | 0, 3) + (R() < 0.6 ? '.mov' : '.mp4');
            if (sub) rel = relBase + '/' + sub;
            z[i] = 40000 + (R() * 1600000) | 0;
          } else if (kind === 'screen') {
            const dd = new Date(tt * 1000);
            nm = 'Näyttökuva ' + dd.toISOString().slice(0, 10) + ' kello ' + pad(dd.getUTCHours(), 2) + '.' + pad(dd.getUTCMinutes(), 2) + '.' + pad(dd.getUTCSeconds(), 2) + '.png';
            if (sub) rel = relBase ? relBase + '/' + sub : sub;
            z[i] = 300 + (R() * 2600) | 0;
          } else if (kind === 'cad') {
            nm = sl + '_' + pick(['plan', 'section', 'elevation', 'site', 'detail']) + '_' + pick(['00', '01', '02', 'B1', 'roof']) + '_v' + (1 + (R() * 12) | 0) + '.' + pick(['dwg', 'dwg', 'dxf', '3dm', 'ifc', 'skp']);
            rel = relBase + '/' + sub;
            z[i] = 400 + (R() * 38000) | 0;
          } else if (kind === 'm3d') {
            nm = sl + '_' + pick(['massing', 'tower', 'dome', 'tent', 'street', 'terrain', 'furniture', 'installation', 'shell']) + '_v' + (1 + (R() * 20) | 0) + '.' + pick(['blend', 'blend', 'glb', 'fbx', 'usdz', 'splat']);
            rel = relBase + '/' + sub;
            z[i] = 900 + (R() * 380000) | 0;
          } else if (kind === 'source') {
            if (wname === 'Books' && q < BOOKS.length * 2) nm = BOOKS[q % BOOKS.length] + (q >= BOOKS.length ? ' (annotated)' : '') + (R() < 0.8 ? '.pdf' : '.epub');
            else if (wname === 'Papers') nm = new Date(tt * 1000).getUTCFullYear() + ' · ' + pick(PAPER_TOPICS) + ' ' + pad(q, 4) + '.pdf';
            else if (wname === 'Lecture notes') nm = 'TAIK ' + pick(['structures', 'history', 'furniture', 'theory', 'drawing']) + ' ' + pad(q, 3) + '.pdf';
            else nm = (wname === 'Books' ? 'scan ' : 'reading ') + pad(q, 4) + (R() < 0.85 ? '.pdf' : '.txt');
            z[i] = 200 + (R() * 30000) | 0;
          } else if (kind === 'skill') {
            const sk = SKILLS[q % SKILLS.length] + (q >= SKILLS.length ? '-' + (1 + Math.floor(q / SKILLS.length)) : '');
            rel = sk; nm = 'SKILL.md';
            x.set(i, { ti: sk, de: 'Skill · ' + sk.replace(/-/g, ' ') });
            z[i] = 2 + (R() * 18) | 0;
          } else if (kind === 'note') {
            let title;
            if (wname === 'Daily notes') { title = new Date(NOW * 1000 - q * 86400000 * 3).toISOString().slice(0, 10); tt = yr(2026) + (NOW - yr(2026)) * (1 - q / c); t[i] = tt; }
            else { const list = NOTE_TITLES[wname]; title = list[q % list.length]; if (q >= list.length) title += ' · ' + pick(['notes', 'v2', 'questions', 'decisions', 'sources', 'log', 'sketch']) + (q >= list.length * 2 ? ' ' + Math.floor(q / list.length) : ''); }
            nm = title + '.md'; noteIdx.push(i); noteTitle.push(title);
            z[i] = 1 + (R() * 40) | 0;
          }
          n[i] = nm; d[i] = DIR(ri, rel);
        }
      });
    }
    // links between notes and from notes to material
    const titleIx = new Map(noteTitle.map((tl, j) => [tl.toLowerCase(), j]));
    const byWork = new Map();
    for (let i = 0; i < total; i++) { const kk = k[i]; if (kk === KI.ai || kk === KI.m3d || kk === KI.cad) { const arr = byWork.get(w[i]); if (!arr) byWork.set(w[i], [i]); else if (arr.length < 400) arr.push(i); } }
    const projectOf = tl => Object.keys(PERIOD).find(p => tl.startsWith(p + ' —'));
    noteIdx.forEach((i, j) => {
      const tl = noteTitle[j];
      const ln = new Set(), tg = new Set();
      const proj = projectOf(tl);
      const sameWork = noteIdx.filter(q => w[q] === w[i]);
      const nl = 1 + (R() * 5) | 0;
      for (let c = 0; c < nl; c++) {
        const r = R();
        if (r < 0.5 && sameWork.length > 1) ln.add(noteTitle[noteIdx.indexOf(pick(sameWork))]);
        else if (r < 0.75) ln.add(pick(HUBS));
        else ln.add(pick(noteTitle));
      }
      if (proj) {
        noteTitle.forEach(o => { if (o !== tl && o.startsWith(proj + ' —') && R() < 0.5) ln.add(o); });
        const mats = byWork.get(workIx.get(proj.toLowerCase()));
        if (mats) for (let c = 0; c < 2 + (R() * 3 | 0); c++) ln.add(n[pick(mats)]);
        tg.add(slug(proj));
      }
      ln.delete(tl);
      tg.add(pick(['idea', 'decision', 'source', 'draft', 'todo', 'theory', 'build']));
      if (/SYSTEM 8|Control room|Tools/.test(tl) || works[w[i]].n === 'Tools') tg.add('system8');
      x.set(i, { tg: [...tg], ln: [...ln].filter(v => v) });
    });
    const out = { v: 1, app: 's8', demo: true, at: NOW, machine: 'sample', os: 'mac', sectors: SECTORS, kinds: KINDS, roots: ROOTS,
      dirs, dirRoot, works, n, d, k, s, w, t, z, x, sc: [], scale, ms: Math.round(performance.now() - t0) };
    out.titleIx = titleIx;
    return out;
  }

  function hashi(i) { let h = (i + 1) * 2654435761 >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return h >>> 0; }
  const PAL = {
    'Mars crater city': ['#B5532A', '#D9824A', '#E8B48A', '#5A2A1A', '#F2D7B6'],
    '111 days of silence': ['#F4F4F0', '#DCDCD5', '#B9B9B1', '#3A3A36', '#EAEAE4'],
    'Brutalism': ['#8A8A85', '#B5B5AE', '#5E5E5A', '#D6D6CF', '#3F3F3C'],
    'Portals': ['#1F3B57', '#3E6E8E', '#9CC3D5', '#E9E2D0', '#0F1E2E'],
    'Landscapes': ['#2F4A3A', '#7C9A7E', '#C9D6C2', '#E6E0CC', '#1C2B22'],
    'Textures': ['#6B5A48', '#A38B6E', '#D2C2A6', '#3E3428', '#EDE3D0'],
    'KEHÄ': ['#141414', '#F2F2EE', '#8A8A85', '#141414', '#F2F2EE'],
    'BLACK FIELD': ['#0B0B0B', '#2A2A2A', '#8A8A8A', '#F2F2F2', '#161616'],
    'Metsän puolella': ['#26382B', '#556B4F', '#A3B18A', '#DAD7CD', '#141E17'],
    default: ['#6A7681', '#A4ADB3', '#D5D9DB', '#3B4249', '#EEF0F0'],
    photo: ['#9AA4AB', '#C7CCCF', '#6E756F', '#A79A84', '#E3E5E4'],
  };
  function paint(ctx, i, cw, ch, kind, wname) {
    const h = hashi(i), r = a => ((h >>> a) & 255) / 255;
    if (kind === 'photo' || kind === 'ai') {
      const P = kind === 'photo' ? PAL.photo : (PAL[wname] || PAL.default);
      const hz = ch * (0.35 + r(0) * 0.35);
      ctx.fillStyle = P[(h >>> 3) % 2 ? 4 : 1]; ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = P[(h >>> 5) % 2 ? 0 : 2]; ctx.fillRect(0, hz, cw, ch - hz);
      if (kind === 'ai') {
        ctx.fillStyle = P[3];
        const cx = cw * (0.2 + r(8) * 0.6), rr = ch * (0.12 + r(16) * 0.25);
        if (wname === 'Mars crater city') { ctx.beginPath(); ctx.ellipse(cw / 2, hz + ch * 0.12, cw * 0.42, ch * 0.1, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = P[4]; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(cw / 2, hz + ch * 0.12, cw * 0.44, Math.PI, 0); ctx.fill(); ctx.globalAlpha = 1; }
        else if ((h >>> 9) % 3 === 0) { ctx.beginPath(); ctx.arc(cx, hz - rr * 0.4, rr, 0, Math.PI * 2); ctx.fill(); }
        const nb = 2 + (h >>> 11) % 6;
        for (let b = 0; b < nb; b++) { const bx = cw * (((h >>> (b * 3)) & 63) / 63), bw = cw * (0.03 + ((h >>> (b + 5)) & 7) / 80), bh = ch * (0.1 + ((h >>> (b * 2 + 1)) & 15) / 30); ctx.fillStyle = P[b % 2 ? 3 : 0]; ctx.fillRect(bx, hz - bh, bw, bh); }
      } else {
        ctx.fillStyle = P[2]; const nb = 1 + (h >>> 7) % 4;
        for (let b = 0; b < nb; b++) { const bx = cw * r(b * 4), bh = ch * (0.08 + r(b * 4 + 2) * 0.3); ctx.fillRect(bx, hz - bh, cw * (0.04 + r(b + 9) * 0.12), bh); }
      }
    } else if (kind === 'video') {
      ctx.fillStyle = '#161616'; ctx.fillRect(0, 0, cw, ch);
      const P = PAL[wname] || PAL.default; ctx.fillStyle = P[(h >>> 4) % 5]; ctx.globalAlpha = 0.8;
      ctx.fillRect(cw * 0.1, ch * (0.3 + r(0) * 0.3), cw * 0.8, ch * 0.08 + r(6) * ch * 0.2); ctx.globalAlpha = 1;
      ctx.fillStyle = '#F2F2F2'; ctx.beginPath(); ctx.moveTo(cw / 2 - 6, ch / 2 - 8); ctx.lineTo(cw / 2 + 8, ch / 2); ctx.lineTo(cw / 2 - 6, ch / 2 + 8); ctx.fill();
    } else if (kind === 'screen') {
      ctx.fillStyle = '#EDEDEB'; ctx.fillRect(0, 0, cw, ch); ctx.fillStyle = '#F7F7F5'; ctx.fillRect(cw * 0.72, 0, cw * 0.28, ch);
      ctx.fillStyle = '#D2D2CE'; for (let l = 0; l < 6; l++) ctx.fillRect(cw * 0.76, ch * (0.12 + l * 0.12), cw * 0.18, 1);
      ctx.fillStyle = '#141414'; ctx.fillRect(cw * 0.06, ch * 0.08, cw * 0.2, 2);
      ctx.strokeStyle = '#141414'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cw * 0.36, ch * 0.55, ch * 0.28, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#FF3A1E'; ctx.fillRect(cw * 0.36 - 2, ch * 0.55 - 2, 4, 4);
    } else if (kind === 'm3d' || kind === 'cad') {
      ctx.fillStyle = '#F7F7F5'; ctx.fillRect(0, 0, cw, ch); ctx.strokeStyle = kind === 'cad' ? '#006D5B' : '#00A86B'; ctx.lineWidth = 1;
      const cx = cw / 2, cy = ch * 0.58, s0 = ch * (0.18 + r(0) * 0.12);
      for (let b = 0; b < 3 + (h % 4); b++) {
        const ox = (r(b * 5) - 0.5) * cw * 0.5, hh = s0 * (0.6 + r(b * 3 + 1) * 1.6), ww = s0 * (0.5 + r(b + 7) * 0.8);
        ctx.beginPath();
        if (kind === 'cad') { ctx.rect(cx + ox - ww / 2, cy - hh / 2, ww, hh); }
        else { const x0 = cx + ox, y0 = cy; ctx.moveTo(x0, y0); ctx.lineTo(x0 + ww, y0 - ww / 2); ctx.lineTo(x0, y0 - ww); ctx.lineTo(x0 - ww, y0 - ww / 2); ctx.closePath(); ctx.moveTo(x0 - ww, y0 - ww / 2); ctx.lineTo(x0 - ww, y0 - ww / 2 - hh); ctx.lineTo(x0, y0 - ww - hh); ctx.lineTo(x0 + ww, y0 - ww / 2 - hh); ctx.lineTo(x0 + ww, y0 - ww / 2); ctx.moveTo(x0, y0 - ww); ctx.lineTo(x0, y0 - ww - hh); }
        ctx.stroke();
      }
    }
  }

  function noteText(st, i) {
    const ex = st.x.get(i) || {};
    const title = st.n[i].replace(/\.md$/, '');
    const wname = st.works[st.w[i]].n;
    const proj = Object.keys(SENT).find(p => title.startsWith(p)) || (/SYSTEM 8|Control room/.test(title) ? 'SYSTEM 8' : 'default');
    const h = hashi(i);
    const bank = SENT[proj].concat(SENT.default);
    const s1 = bank[h % bank.length], s2 = bank[(h >>> 5) % bank.length];
    const links = (ex.ln || []);
    const notes = links.filter(l => !/\.(png|jpe?g|blend|glb|fbx|usdz|splat|dwg|dxf|3dm|ifc|skp)$/i.test(l));
    const mats = links.filter(l => /\.(png|jpe?g)$/i.test(l));
    const files = links.filter(l => /\.(blend|glb|fbx|usdz|splat|dwg|dxf|3dm|ifc|skp)$/i.test(l));
    let md = '# ' + title + '\n\n' + s1 + ' ' + (s2 !== s1 ? s2 : '') + '\n\n';
    if (mats.length) md += mats.map(m => '![[' + m + ']]').join('\n') + '\n\n';
    if (notes.length) md += '## Linked\n' + notes.map(l => '- [[' + l + ']]').join('\n') + '\n\n';
    if (files.length) md += '## Files\n' + files.map(l => '- [[' + l + ']]').join('\n') + '\n\n';
    md += '## Next\n- ' + pick(['Decide the structure before running agents.', 'Send the selected images to SC3NE.', 'Check the prompt lineage.', 'Write the short text for the presentation.', 'Open the scene in Blender and test the scale.']) + '\n\n';
    md += (ex.tg || []).map(tg => '#' + tg).join(' ') + '\n\n*Folder: ' + wname + ' — sample note generated for the demo.*\n';
    return md;
  }

  const TOOLS = [
    ['mirror', 'MIRROR', 'system8', 'art', ['png', 'jpg', 'jpeg', 'webp', 'mp4', 'mov', 'heic']], ['sc3ne', 'SC3NE', 'system8', 'architecture', ['png', 'jpg', 'jpeg', 'webp', 'heic']],
    ['form', 'FORM', 'system8', 'architecture', ['glb', 'gltf', 'obj']], ['threshold', 'THRESHOLD', 'system8', 'art', ['png', 'jpg', 'jpeg', 'webp', 'heic']],
    ['cutout', 'CUTOUT', 'system8', 'generation', ['png', 'jpg', 'jpeg', 'webp', 'mp4', 'mov']], ['roschack', 'ROSCHACK', 'system8', 'art', ['png', 'jpg', 'webp']],
    ['mixer', 'VIDEO MIXER', 'system8', 'video', ['mp4', 'mov', 'webm']], ['feedback', 'FEEDBACK', 'system8', 'video', ['mp4', 'mov', 'png']],
    ['keha', 'KEHÄ', 'system8', 'art', []], ['autotypo', 'AUTO TYPO', 'system8', 'art', []], ['blackfield', 'BLACK FIELD', 'system8', 'video', []],
    ['lightforce', 'LIGHT FORCE', 'system8', 'art', []], ['justsitting', 'JUST SITTING', 'system8', 'brain', []], ['paja', 'PAJA', 'system8', 'brain', []],
    ['obsidian', 'Obsidian', 'apps', 'brain', ['md']], ['blender', 'Blender', 'apps', 'architecture', ['blend', 'fbx', 'obj', 'glb', 'gltf', 'usd', 'usdz', 'abc', 'stl', 'ply']],
    ['unreal', 'Unreal Engine', 'apps', 'architecture', ['uproject', 'umap']], ['touchdesigner', 'TouchDesigner', 'apps', 'video', ['toe', 'tox']],
    ['resolume', 'Resolume Wire', 'apps', 'video', ['mov', 'mp4']], ['bitwig', 'Bitwig', 'apps', 'art', ['bwproject', 'wav', 'aif']],
    ['comfyui', 'ComfyUI', 'apps', 'generation', []], ['midjourney', 'Midjourney', 'apps', 'generation', []], ['claude', 'Claude', 'apps', 'ideas', []],
    ['cursor', 'Cursor', 'apps', 'brain', ['html', 'jsx', 'tsx', 'py']], ['framer', 'Framer', 'apps', 'art', []]]
    .map(([id, name, group, sector, exts]) => ({ id, name, group, sector, exts, kinds: [], via: group === 'system8' || ['comfyui', 'midjourney', 'claude', 'framer'].includes(id) ? 'url' : id === 'obsidian' ? 'uri' : 'app', usable: true, url: '' }));

  const TASKS = [
    { id: 'reindex', name: 'Reindex archive', state: 'done', last: '717,440 items in 74 s', machine: '', ready: true, script: ['Walking 10 folders', 'Second brain · 340 notes', 'Reading prompts · 200,000 AI images', 'Photos · 500,000', '717,440 items in 74 s'] },
    { id: 'thumbs', name: 'Thumbnails · newest 2,000', state: 'idle', last: '', machine: '', ready: true, script: ['0 / 2,000 thumbnails', '500 / 2,000', '1,000 / 2,000', '1,500 / 2,000', '2,000 thumbnails ready'] },
    { id: 'brut', name: 'Brutalism prompt batch', state: 'waiting', need: 'needs your OK to spend 40 GPU minutes', work: 'Brutalism', last: 'waiting for you', machine: 'pc', ready: true, script: ['allowed · batch 1 / 4', 'batch 2 / 4', 'batch 3 / 4', 'batch 4 / 4', '160 images written to Brutalism'] },
    { id: 'render', name: 'Night render · Procedural architecture', state: 'failed', work: 'Procedural architecture', last: 'Blender exited with code 1 · out of GPU memory', machine: 'pc', ready: true, script: ['frame 1 / 24', 'frame 8 / 24', 'frame 16 / 24', 'frame 24 / 24', '24 frames rendered'] },
    { id: 'cut', name: 'SC3NE cut-outs · Mars crater city', state: 'running', work: 'Mars crater city', last: 'cut-out 6 / 10', machine: 'pc', ready: true, script: ['cut-out 6 / 10', 'cut-out 7 / 10', 'cut-out 8 / 10', 'cut-out 9 / 10', 'cut-out 10 / 10', '10 layers written to SC3NE'] },
    { id: 'test', name: 'Test agent · five steps', state: 'idle', last: '', machine: '', ready: true, script: ['step 1 of 5', 'step 2 of 5', 'step 3 of 5', 'step 4 of 5', 'step 5 of 5', 'done'] },
    { id: 'hermes', name: 'Hermes · nightly digest', state: 'done', last: '06:12 · 14 notes summarised', machine: 'pc', ready: true, script: ['reading 14 changed notes', 'writing digest', 'digest written to Daily notes'] }];

  // project deadlines in days from now (in your archive: deadline: in a project's note)
  const DEADLINES = [['111 days of silence', 9], ['Ensō · Hyvinkää', 4], ['Metsän puolella', 12], ['Circuit Control', 26]];
  window.S8DEMO = { build, paint, noteText, TOOLS, TASKS, NOW, DEADLINES };
})();
