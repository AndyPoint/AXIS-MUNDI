#!/usr/bin/env python3
"""
SYSTEM 8 · Control room — bridge 1.1

One file, standard library only (Python 3.9+).
  · indexes the folders listed in config.json (notes, sources, photos, AI images,
    video, 3D, CAD, audio) — Obsidian links/tags and AI-image prompts included
  · serves the control room at http://127.0.0.1:8808/
  · serves files and thumbnails to the control room
  · opens files in your tools (Blender, Obsidian, SYSTEM 8 web tools …), reveals them
  · runs the tasks listed in config.json and reports their state
  · reads and writes sidecar notes

Optional helpers, used when present:  Pillow (pip install pillow) for image thumbnails,
ffmpeg for video thumbnails; on macOS, sips / qlmanage are used automatically.

  python3 s8.py               start (indexes on first run)
  python3 s8.py --reindex     start and rebuild the index
  python3 s8.py --index-only  rebuild the index and exit
"""
import argparse
import gzip
import hashlib
import html
import json
import mimetypes
import os
import platform
import re
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import webbrowser
import zlib
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlparse

VERSION = '1.3'
MD_PARSE_V = 2  # bump when parse_md learns new keys, so notes are read again
HERE = Path(__file__).resolve().parent
WEB = HERE / 'web'
STATE = HERE / '.s8'
SYSTEM = platform.system()
OS_KEY = {'Darwin': 'mac', 'Windows': 'win'}.get(SYSTEM, 'linux')

try:
    from PIL import Image, ImageOps  # optional
    HAS_PIL = True
except Exception:
    HAS_PIL = False

# ───────────────────────────────────────────── kinds

KINDS = ['note', 'skill', 'source', 'photo', 'ai', 'video', 'screen', 'm3d', 'cad', 'audio', 'code']
EXT = {}


def _reg(kind, exts):
    for e in exts.split():
        EXT[e] = kind


_reg('note', 'md markdown')
_reg('source', 'pdf epub txt rtf doc docx odt pages mobi djvu tex')
_reg('photo', 'jpg jpeg heic heif png webp gif tif tiff bmp dng cr2 cr3 nef arw raf orf rw2 avif')
_reg('video', 'mp4 mov m4v avi mkv webm mxf mts m2ts wmv')
_reg('m3d', 'blend fbx obj glb gltf usd usda usdc usdz abc stl ply 3ds max c4d ma mb uproject umap splat ksplat spz vdb')
_reg('cad', 'dwg dxf ifc 3dm rvt rfa pln pla step stp iges igs skp gh ghx')
_reg('audio', 'wav mp3 aif aiff flac ogg m4a opus bwproject als')
_reg('code', 'html htm jsx tsx py glsl frag toe tox')

AUTO_SECTOR = {'note': 'brain', 'skill': 'brain', 'code': 'brain', 'source': 'ideas', 'photo': 'image',
               'screen': 'image', 'ai': 'generation', 'video': 'video', 'm3d': 'architecture',
               'cad': 'architecture', 'audio': 'art'}

DEFAULT_IGNORE = {'.git', '.svn', 'node_modules', '__pycache__', '.obsidian', '.trash', '.Trash',
                  '$RECYCLE.BIN', 'System Volume Information', '.cache', '.venv', 'venv', '.s8',
                  'DerivedDataCache', 'Intermediate', 'Saved', 'Binaries', '.Spotlight-V100',
                  '.fseventsd', 'Thumbs.db', '.DS_Store'}

UUID_RE = re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', re.I)
SHOT_RE = re.compile(r'^(screen ?shot|screenshot|näyttökuva|kuvakaappaus|bildschirmfoto|capture d|schermafbeelding|captura)', re.I)
COMFY_RE = re.compile(r'^comfyui_?\d{3,}', re.I)


def classify(name, ext, sector_id):
    if name == 'SKILL.md':
        return 'skill'
    k = EXT.get(ext)
    if k == 'photo':
        if SHOT_RE.match(name):
            return 'screen'
        if sector_id == 'generation':
            return 'ai'
        if ext in ('png', 'webp') and (UUID_RE.search(name) or COMFY_RE.match(name)):
            return 'ai'
    return k


# ───────────────────────────────────────────── text extraction

DATE_RE = re.compile(r'\d{4}-\d{2}-\d{2}')
FM_RE = re.compile(r'\A---\s*\r?\n(.*?)\r?\n---\s*(?:\r?\n|\Z)', re.S)
WL_RE = re.compile(r'\[\[([^\]\|#\^]+)(?:[#\^][^\]\|]*)?(?:\|[^\]]*)?\]\]')
TAG_RE = re.compile(r'(?<![\w/&#])#([^\s#\[\]\(\)\{\},.;:!?"\'`<>]+)')
H1_RE = re.compile(r'^#\s+(.+?)\s*#*\s*$', re.M)
CODE_RE = re.compile(r'```.*?```|`[^`\n]*`', re.S)
HEX_RE = re.compile(r'^[0-9a-fA-F]{3,8}$')
MDLINK_RE = re.compile(r'\]\(((?:file://|/|~|[A-Za-z]:[\\/])[^)\s]+)\)')


def parse_frontmatter(block):
    d, key = {}, None
    for line in block.splitlines():
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        m = re.match(r'^([A-Za-z0-9_\-]+)\s*:\s*(.*)$', line)
        if m:
            key, v = m.group(1).lower(), m.group(2).strip()
            if v.startswith('[') and v.endswith(']') and not v.startswith('[['):
                d[key] = [x.strip().strip('"\'') for x in v[1:-1].split(',') if x.strip()]
            elif v:
                d[key] = v.strip('"\'')
            else:
                d[key] = []
        elif key and line.lstrip().startswith('- '):
            if not isinstance(d.get(key), list):
                d[key] = []
            d[key].append(line.lstrip()[2:].strip().strip('"\''))
    return d


def parse_md(path, stem):
    try:
        with open(path, 'r', encoding='utf-8', errors='replace') as f:
            txt = f.read(2_000_000)
    except OSError:
        return {}
    fm, body = {}, txt
    m = FM_RE.match(txt)
    if m:
        fm = parse_frontmatter(m.group(1))
        body = txt[m.end():]
    clean = CODE_RE.sub(' ', body)
    links = []
    for t in WL_RE.findall(txt):
        t = t.strip()
        if t and t not in links:
            links.append(t)
    for t in MDLINK_RE.findall(txt):
        t = unquote(t.split('#')[0]).rstrip('/').replace('\\', '/').split('/')[-1]
        if t and '.' in t and t not in links:
            links.append(t)
    tags = []
    ft = fm.get('tags') or fm.get('tag') or []
    if isinstance(ft, str):
        ft = re.split(r'[,\s]+', ft)
    for t in list(ft) + TAG_RE.findall(clean):
        t = t.strip().lstrip('#')
        if t and not HEX_RE.match(t) and not t.isdigit() and t not in tags:
            tags.append(t)
    title = fm.get('title') if isinstance(fm.get('title'), str) else None
    if not title and isinstance(fm.get('name'), str):
        title = fm['name']
    if not title:
        h = H1_RE.search(clean)
        title = h.group(1).strip() if h else None
    al = fm.get('aliases') or fm.get('alias') or []
    if isinstance(al, str):
        al = [al]
    out = {}
    if title and title != stem:
        out['ti'] = title[:200]
    if tags:
        out['tg'] = tags[:40]
    if links:
        out['ln'] = links[:300]
    if al:
        out['al'] = [a for a in al if a][:10]
    if isinstance(fm.get('description'), str):
        out['de'] = fm['description'][:400]
    if fm.get('s8') == 'sidecar' and isinstance(fm.get('key'), str):
        out['sk'] = fm['key']
    for k in ('deadline', 'due'):
        v = fm.get(k)
        if isinstance(v, str):
            m2 = DATE_RE.search(v)
            if m2:
                out['dl'] = m2.group(0)
                break
    for k in ('work', 'project'):
        if isinstance(fm.get(k), str) and fm[k].strip():
            out['wk'] = fm[k].strip().strip('[]')[:120]
            break
    return out


def png_text(path, max_chunks=200):
    """Read text chunks of a PNG without reading the image data."""
    out = {}
    try:
        with open(path, 'rb') as f:
            if f.read(8) != b'\x89PNG\r\n\x1a\n':
                return out
            for _ in range(max_chunks):
                h = f.read(8)
                if len(h) < 8:
                    break
                ln, typ = int.from_bytes(h[:4], 'big'), h[4:8]
                if typ in (b'tEXt', b'iTXt', b'zTXt') and ln < 8_000_000:
                    data = f.read(ln)
                    f.seek(4, 1)
                    try:
                        k, rest = data.split(b'\0', 1)
                        k = k.decode('latin-1')
                        if typ == b'tEXt':
                            try:
                                out[k] = rest.decode('utf-8')
                            except UnicodeDecodeError:
                                out[k] = rest.decode('latin-1')
                        elif typ == b'zTXt':
                            out[k] = zlib.decompress(rest[1:]).decode('utf-8', 'replace')
                        else:
                            comp, rest = rest[0], rest[2:]
                            _lang, rest = rest.split(b'\0', 1)
                            _tk, txt = rest.split(b'\0', 1)
                            out[k] = (zlib.decompress(txt) if comp else txt).decode('utf-8', 'replace')
                    except Exception:
                        pass
                elif typ == b'IEND':
                    break
                else:
                    f.seek(ln + 4, 1)
    except OSError:
        pass
    return out


def prompt_from_png(meta):
    if 'parameters' in meta:  # Automatic1111 / Forge
        return meta['parameters'].split('Negative prompt:')[0].strip()[:800]
    if 'prompt' in meta:  # ComfyUI graph
        try:
            g = json.loads(meta['prompt'])
            texts = []
            for node in g.values():
                if not isinstance(node, dict):
                    continue
                ct = str(node.get('class_type', ''))
                inp = node.get('inputs', {}) or {}
                for key in ('text', 'text_g', 'text_l', 'prompt', 'positive'):
                    v = inp.get(key)
                    if isinstance(v, str) and len(v) > 3 and ('Encode' in ct or 'Prompt' in ct or 'Text' in ct):
                        texts.append(v)
            if texts:
                return max(texts, key=len)[:800]
        except Exception:
            pass
    for key in ('Description', 'description', 'Comment', 'Title'):
        if len(meta.get(key, '')) > 3:
            return meta[key][:800]
    x = meta.get('XML:com.adobe.xmp')
    if x:
        m = re.search(r'<dc:description>.*?<rdf:li[^>]*>(.*?)</rdf:li>', x, re.S)
        if m:
            return html.unescape(m.group(1)).strip()[:800]
    return ''


def prompt_from_name(stem):
    s = UUID_RE.sub(' ', stem)
    s = re.sub(r'https?_+\S*?(?=_[a-z]{3,}|$)', ' ', s)
    s = s.replace('_', ' ')
    s = re.sub(r'\s+\d{1,2}$', '', s)
    return re.sub(r'\s+', ' ', s).strip()[:400]


# ───────────────────────────────────────────── helpers

def expand(p):
    return Path(os.path.expandvars(os.path.expanduser(str(p))))


def now():
    return int(time.time())


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('10.255.255.255', 1))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return None


def popen(cmd, **kw):
    if SYSTEM == 'Windows':
        kw.setdefault('creationflags', 0x00000008 | 0x00000200)  # DETACHED_PROCESS | NEW_PROCESS_GROUP
    return subprocess.Popen(cmd, stdin=subprocess.DEVNULL, **kw)


def open_default(target):
    t = str(target)
    if SYSTEM == 'Darwin':
        popen(['open', t])
    elif SYSTEM == 'Windows':
        os.startfile(t)  # noqa
    else:
        popen(['xdg-open', t])


def open_with(app, target=None):
    args = [str(target)] if target is not None else []
    if SYSTEM == 'Darwin' and not app.startswith('/'):
        popen(['open', '-a', app] + args)
    elif SYSTEM == 'Darwin' and app.endswith('.app'):
        popen(['open', '-a', app] + args)
    else:
        popen([str(expand(app))] + args)


def reveal(target):
    t = str(target)
    if SYSTEM == 'Darwin':
        popen(['open', '-R', t])
    elif SYSTEM == 'Windows':
        popen(['explorer', '/select,', t])
    else:
        popen(['xdg-open', str(Path(t).parent)])


# ───────────────────────────────────────────── index

def build_index(cfg, progress, cache):
    sectors = cfg['sectors']
    sid = {s['id']: i for i, s in enumerate(sectors)}
    roots = cfg['roots']
    ignore = DEFAULT_IGNORE | set(cfg.get('ignore', []))
    read_prompts = cfg.get('readPrompts', True)
    dirs, dir_ix, dir_root = [], {}, []
    works, work_ix = [], {}
    D, N, K, S, W, T, Z = [], [], [], [], [], [], []
    X, newcache = {}, {}
    kind_ix = {k: i for i, k in enumerate(KINDS)}
    root_out = []
    for ri, root in enumerate(roots):
        base = expand(root['path'])
        rname = root.get('name') or base.name or str(base)
        rsec = root.get('sector', 'auto')
        depth = int(root.get('workDepth', 1))
        root_out.append({'name': rname, 'sector': rsec, 'path': str(base), 'ok': base.is_dir()})
        if not base.is_dir():
            progress['missing'].append(str(base))
            continue
        progress['root'] = rname
        stack = [(str(base), '')]
        while stack:
            p, rel = stack.pop()
            try:
                it = os.scandir(p)
            except OSError:
                continue
            files = []
            with it:
                for e in it:
                    nm = e.name
                    if nm in ignore or nm.startswith('.') or nm.startswith('~$'):
                        continue
                    try:
                        if e.is_dir(follow_symlinks=False):
                            stack.append((e.path, f'{rel}/{nm}' if rel else nm))
                            continue
                        if not e.is_file(follow_symlinks=False):
                            continue
                    except OSError:
                        continue
                    files.append(e)
            if not files:
                continue
            parts = rel.split('/') if rel else []
            wname = '/'.join(parts[:depth]) if (parts and depth > 0) else rname
            dkey = (ri, rel)
            di = None
            for e in files:
                nm = e.name
                stem, dot, ext = nm.rpartition('.')
                if not dot:
                    continue
                ext = ext.lower()
                kind = classify(nm, ext, rsec)
                if kind is None:
                    continue
                sec = rsec if rsec != 'auto' else AUTO_SECTOR.get(kind, sectors[0]['id'])
                si = sid.get(sec, 0)
                try:
                    st = e.stat(follow_symlinks=False)
                except OSError:
                    continue
                if di is None:
                    di = dir_ix.get(dkey)
                    if di is None:
                        di = dir_ix[dkey] = len(dirs)
                        dirs.append(rel)
                        dir_root.append(ri)
                wk = wname.lower()
                wi = work_ix.get(wk)
                if wi is None:
                    wi = work_ix[wk] = len(works)
                    works.append({'n': wname})
                i = len(N)
                D.append(di); N.append(nm); K.append(kind_ix[kind]); S.append(si); W.append(wi)
                T.append(int(st.st_mtime)); Z.append(int(st.st_size // 1024))
                ex = None
                if kind in ('note', 'skill') or (kind == 'ai'):
                    ck = e.path
                    c = cache.get(ck)
                    if c and c[0] == int(st.st_mtime) and c[1] == st.st_size and (kind == 'ai' or (len(c) > 3 and c[3] == MD_PARSE_V)):
                        ex = c[2]
                    else:
                        ex = {}
                        if kind in ('note', 'skill') and st.st_size < 4_000_000:
                            ex = parse_md(e.path, stem)
                        elif kind == 'ai':
                            pr = ''
                            if read_prompts and ext == 'png':
                                pr = prompt_from_png(png_text(e.path))
                            if not pr and UUID_RE.search(stem):
                                pr = prompt_from_name(stem)
                            if pr:
                                ex = {'pr': pr}
                    newcache[ck] = (int(st.st_mtime), st.st_size, ex, MD_PARSE_V)
                    if ex:
                        X[str(i)] = ex
                progress['files'] = len(N)
    # sidecars → items
    sc_items = []
    sc_keys = {}
    for i_s, ex in X.items():
        if 'sk' in ex:
            sc_keys[ex['sk']] = int(i_s)
    if sc_keys:
        rname_ix = {r['name']: k for k, r in enumerate(root_out)}
        want = {}
        for key, note_i in sc_keys.items():
            rn, _, relp = key.partition('/')
            ri = rname_ix.get(rn)
            if ri is None:
                continue
            reld, _, nm = relp.rpartition('/')
            di = dir_ix.get((ri, reld))
            if di is not None:
                want[(di, nm)] = note_i
        if want:
            for i in range(len(N)):
                ni = want.get((D[i], N[i]))
                if ni is not None:
                    sc_items.append(i)
                    X.setdefault(str(i), {})['sc'] = ni
    return {
        'v': 1, 'app': 's8', 'version': VERSION, 'mdv': MD_PARSE_V, 'at': now(), 'machine': cfg.get('machine') or socket.gethostname(),
        'os': OS_KEY, 'sectors': sectors, 'kinds': KINDS, 'roots': root_out,
        'dirs': dirs, 'dirRoot': dir_root, 'works': works,
        'd': D, 'n': N, 'k': K, 's': S, 'w': W, 't': T, 'z': Z, 'x': X, 'sc': sc_items,
    }, newcache


# ───────────────────────────────────────────── tasks

NEED_RE = re.compile(r'^\s*S8:\s*(needs?|wait(?:ing)?|ask)\b[:\s]*(.*)$', re.I)


class Task:
    def __init__(self, spec, bridge):
        self.spec, self.bridge = spec, bridge
        self.state, self.code, self.t0, self.t1 = 'idle', None, 0, 0
        self.log = deque(maxlen=500)
        self.proc = None

    def json(self, full=False):
        s = self.spec
        d = {'id': s['id'], 'name': s.get('name', s['id']), 'state': self.state, 'code': self.code,
             'work': s.get('work', ''), 'need': getattr(self, 'need', ''),
             't0': self.t0, 't1': self.t1, 'last': self.log[-1] if self.log else '',
             'machine': s.get('machine', ''), 'note': s.get('note', ''), 'here': self.here(),
             'ready': bool(s.get('builtin') or s.get('cmd'))}
        if full:
            d['log'] = list(self.log)
        return d

    def here(self):
        m = self.spec.get('machine')
        return not m or m in (OS_KEY, self.bridge.cfg.get('machine'), 'any')

    def _line(self, txt):
        # an agent asks for you by printing a line such as  S8: needs permission to overwrite renders
        m = NEED_RE.match(txt)
        if m and self.state in ('running', 'waiting'):
            self.state, self.need = 'waiting', (m.group(2) or 'needs you').strip()[:200]
        elif self.state == 'waiting' and txt.strip():
            self.state, self.need = 'running', ''
        self.log.append(time.strftime('%H:%M:%S ') + txt.rstrip()[:400])

    def run(self, inputs=None):
        if self.state == 'running':
            return False
        self.inputs = [str(p) for p in (inputs or [])]
        s = self.spec
        if not self.here():
            self.log.append(f'This task runs on the {s.get("machine")} — start it there')
            return False
        self.state, self.code, self.t0, self.t1 = 'running', None, now(), 0
        self.log.clear()
        if s.get('builtin') == 'reindex':
            threading.Thread(target=self._reindex, daemon=True).start()
        elif s.get('builtin') == 'thumbs':
            threading.Thread(target=self._thumbs, daemon=True).start()
        elif s.get('cmd'):
            threading.Thread(target=self._cmd, daemon=True).start()
        else:
            self.state = 'failed'
            self._line('No command set for this task in config.json')
            return False
        return True

    def _done(self, ok, code=0):
        self.state, self.code, self.t1 = ('done' if ok else 'failed'), code, now()
        self.need = ''

    def _reindex(self):
        self._line('Indexing …')
        ok = self.bridge.reindex(background=False, log=self._line)
        self._done(ok)

    def _thumbs(self):
        idx = self.bridge.index
        if not idx:
            self._line('No index yet')
            return self._done(False, 1)
        n = int(self.spec.get('count', 2000))
        media = [KINDS.index(k) for k in ('photo', 'ai', 'video', 'screen')]
        order = sorted((i for i, k in enumerate(idx['k']) if k in media), key=lambda i: -idx['t'][i])[:n]
        made = 0
        for c, i in enumerate(order):
            if self.bridge.thumb(i):
                made += 1
            if c % 100 == 0:
                self._line(f'{c} / {len(order)} thumbnails')
        self._line(f'{made} thumbnails ready')
        self._done(True)

    def _cmd(self):
        s = self.spec
        cmd = []
        for c in s['cmd']:
            c = str(c).replace('{python}', sys.executable)
            if c == '{inputs}':
                cmd.extend(self.inputs)
                continue
            c = c.replace('{input}', self.inputs[0] if self.inputs else '')
            cmd.append(str(expand(c)) if c.startswith('~') else c)
        if self.inputs:
            self._line('input: ' + ', '.join(Path(p).name for p in self.inputs[:4]) + (' …' if len(self.inputs) > 4 else ''))
        cwd = str(expand(s.get('cwd', HERE)))
        self._line('$ ' + ' '.join(cmd[:6]))
        try:
            self.proc = subprocess.Popen(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                         stdin=subprocess.DEVNULL, text=True, bufsize=1, errors='replace')
            for line in self.proc.stdout:
                self._line(line)
            code = self.proc.wait()
            if getattr(self, 'stopped', False):
                # stopped on purpose: not a failure, so no red triangle
                self.state, self.code, self.t1, self.need, self.stopped = 'idle', code, now(), '', False
            else:
                self._done(code == 0, code)
        except Exception as ex:  # noqa
            self._line(f'Could not start: {ex}')
            self._done(False, -1)
        finally:
            self.proc = None

    def stop(self):
        if self.proc:
            self.stopped = True
            self.proc.terminate()
            self._line('stopped')


# ───────────────────────────────────────────── bridge

class Bridge:
    def __init__(self, cfg, cfg_path):
        self.cfg, self.cfg_path = cfg, cfg_path
        self.token = secrets.token_urlsafe(18)
        self.lan_key = cfg.get('lanKey') or secrets.token_hex(3)
        self.lock = threading.RLock()
        self.index, self.index_gz, self.cache = None, None, {}
        self.progress = {'state': 'idle', 'files': 0, 'root': '', 't0': 0, 't1': 0, 'missing': [], 'error': ''}
        self.tasks = {t['id']: Task(t, self) for t in cfg.get('tasks', [])}
        self.tools = {t['id']: t for t in cfg.get('tools', [])}
        self.thumb_sem = threading.Semaphore(3)
        self.caps = {'pillow': HAS_PIL, 'ffmpeg': bool(shutil.which('ffmpeg')),
                     'sips': SYSTEM == 'Darwin' and bool(shutil.which('sips')),
                     'quicklook': SYSTEM == 'Darwin' and bool(shutil.which('qlmanage'))}
        vault = cfg.get('vault') or {}
        self.vault_path = expand(vault['path']) if vault.get('path') else None
        self.vault_name = vault.get('name') or (self.vault_path.name if self.vault_path else '')
        sc = cfg.get('sidecars')
        if sc:
            self.sidecar_dir = expand(sc)
        elif self.vault_path:
            self.sidecar_dir = self.vault_path / '_s8'
        else:
            self.sidecar_dir = STATE / 'sidecars'

    # index ---------------------------------------------------------------
    def load_cached(self):
        f = STATE / 'index.json.gz'
        if not f.exists():
            return False
        try:
            raw = f.read_bytes()
            self.index = json.loads(gzip.decompress(raw))
            self.index_gz = raw
            cf = STATE / 'cache.json.gz'
            if cf.exists():
                self.cache = {k: tuple(v) for k, v in json.loads(gzip.decompress(cf.read_bytes())).items()}
            self.progress.update(state='done', files=len(self.index['n']), t1=self.index['at'])
            return True
        except Exception as ex:  # noqa
            print('  cached index unreadable, rebuilding:', ex)
            return False

    def reindex(self, background=True, log=None):
        if background:
            threading.Thread(target=self.reindex, kwargs={'background': False, 'log': log}, daemon=True).start()
            return True
        with self.lock:
            if self.progress['state'] == 'running':
                return False
            self.progress.update(state='running', files=0, root='', t0=now(), t1=0, missing=[], error='')
        try:
            idx, cache = build_index(self.cfg, self.progress, self.cache)
            raw = gzip.compress(json.dumps(idx, ensure_ascii=False, separators=(',', ':')).encode('utf-8'), 6)
            STATE.mkdir(exist_ok=True)
            (STATE / 'index.json.gz').write_bytes(raw)
            (STATE / 'cache.json.gz').write_bytes(gzip.compress(json.dumps(cache, ensure_ascii=False).encode('utf-8'), 5))
            with self.lock:
                self.index, self.index_gz, self.cache = idx, raw, cache
                self.progress.update(state='done', t1=now(), files=len(idx['n']))
            msg = f'{len(idx["n"]):,} items in {now() - self.progress["t0"]}s'
            print('  index:', msg)
            if log:
                log(msg)
                for m in self.progress['missing']:
                    log('missing folder: ' + m)
            return True
        except Exception as ex:  # noqa
            self.progress.update(state='failed', error=str(ex), t1=now())
            print('  index failed:', ex)
            if log:
                log('failed: ' + str(ex))
            return False

    def item_path(self, i):
        idx = self.index
        if idx is None or not (0 <= i < len(idx['n'])):
            return None
        d = idx['d'][i]
        root = idx['roots'][idx['dirRoot'][d]]
        rel = idx['dirs'][d]
        p = Path(root['path'])
        if rel:
            p = p.joinpath(*rel.split('/'))
        return p / idx['n'][i]

    def item_key(self, i):
        idx = self.index
        d = idx['d'][i]
        rel = idx['dirs'][d]
        rn = idx['roots'][idx['dirRoot'][d]]['name']
        return f'{rn}/{rel + "/" if rel else ""}{idx["n"][i]}'

    def kind(self, i):
        return KINDS[self.index['k'][i]]

    # thumbnails ------------------------------------------------------------
    def thumb(self, i, size=320):
        p = self.item_path(i)
        if p is None:
            return None
        try:
            st = p.stat()
        except OSError:
            return None
        key = hashlib.sha1(f'{p}|{st.st_mtime_ns}|{size}'.encode()).hexdigest()[:20]
        folder = STATE / 'thumbs' / key[:2]
        for suf in ('.jpg', '.png'):
            if (folder / (key + suf)).exists():
                return folder / (key + suf)
        kind = self.kind(i)
        if kind not in ('photo', 'ai', 'screen', 'video', 'source', 'm3d', 'cad'):
            return None
        with self.thumb_sem:
            folder.mkdir(parents=True, exist_ok=True)
            out = folder / (key + '.jpg')
            ext = p.suffix.lower()[1:]
            try:
                if kind in ('photo', 'ai', 'screen'):
                    if HAS_PIL and ext not in ('heic', 'heif', 'cr2', 'cr3', 'nef', 'arw', 'raf', 'orf', 'rw2', 'dng'):
                        try:
                            im = Image.open(p)
                            im = ImageOps.exif_transpose(im)
                            im.thumbnail((size, size))
                            im.convert('RGB').save(out, 'JPEG', quality=80)
                            return out
                        except Exception:
                            pass
                    if self.caps['sips']:
                        subprocess.run(['sips', '-s', 'format', 'jpeg', '-Z', str(size), str(p), '--out', str(out)],
                                       capture_output=True, timeout=30)
                        if out.exists():
                            return out
                if kind == 'video' and self.caps['ffmpeg']:
                    for ss in ('1', '0'):
                        subprocess.run(['ffmpeg', '-v', 'error', '-ss', ss, '-i', str(p), '-frames:v', '1',
                                        '-vf', f'scale={size}:-2', '-y', str(out)], capture_output=True, timeout=40)
                        if out.exists() and out.stat().st_size > 0:
                            return out
                if self.caps['quicklook']:
                    with tempfile.TemporaryDirectory() as td:
                        subprocess.run(['qlmanage', '-t', '-s', str(size), '-o', td, str(p)],
                                       capture_output=True, timeout=30)
                        made = list(Path(td).glob('*.png'))
                        if made:
                            dst = folder / (key + '.png')
                            shutil.move(str(made[0]), dst)
                            return dst
            except Exception:
                pass
        return None

    # tools -----------------------------------------------------------------
    def vault_rel(self, p):
        if not self.vault_path:
            return None
        try:
            return p.relative_to(self.vault_path).as_posix()
        except ValueError:
            return None

    def tool_action(self, tool_id, i=None, host=''):
        spec = self.tools.get(tool_id)
        if not spec:
            return {'ok': False, 'error': 'Unknown tool'}
        p = self.item_path(i) if i is not None else None
        name = p.name if p else ''
        if spec.get('uri'):
            vr = self.vault_rel(p) if p else ''
            if p is not None and '{vaultpath}' in spec['uri'] and vr is None:
                return {'ok': False, 'error': f'{name} is not inside the vault, so {spec["name"]} cannot open it'}
            uri = spec['uri'].format(vault=quote(self.vault_name), vaultpath=quote(vr or ''),
                                     path=quote(str(p or '')), name=quote(name))
            if p is None:
                uri = spec.get('launchUri') or uri.split('?')[0] + ('?vault=' + quote(self.vault_name) if self.vault_name else '')
            open_default(uri)
            return {'ok': True, 'did': 'opened', 'target': spec['name']}
        if spec.get('url'):
            url = spec['url']
            if p is not None:
                src = f'/f/{i}?k={self.token}'
                if not url.startswith('/'):
                    src = f'http://{host}{src}'
                if '{src}' in url:
                    url = url.replace('{src}', quote(src, safe='')).replace('{name}', quote(name))
                elif spec.get('pass') == 'src':
                    url += ('&' if '?' in url else '?') + 'src=' + quote(src, safe='') + '&name=' + quote(name)
            return {'ok': True, 'did': 'url', 'url': url, 'target': spec['name']}
        app = (spec.get('open') or {}).get(OS_KEY) or spec.get('app')
        if app:
            open_with(app, p)
            return {'ok': True, 'did': 'opened', 'target': spec['name']}
        return {'ok': False, 'error': f'{spec["name"]} has no {OS_KEY} entry in config.json'}

    def public_tools(self):
        out = []
        for t in self.cfg.get('tools', []):
            usable = bool(t.get('uri') or t.get('url') or (t.get('open') or {}).get(OS_KEY) or t.get('app'))
            out.append({'id': t['id'], 'name': t.get('name', t['id']), 'group': t.get('group', 'apps'),
                        'exts': t.get('exts', []), 'kinds': t.get('kinds', []), 'sector': t.get('sector', ''),
                        'via': 'uri' if t.get('uri') else 'url' if ('url' in t) and not (t.get('open') or t.get('app')) else 'app',
                        'url': t.get('url', ''), 'pass': t.get('pass', ''),
                        'usable': usable, 'note': t.get('note', '')})
        return out

    # sidecars --------------------------------------------------------------
    def sidecar_path(self, i):
        key = self.item_key(i)
        h = hashlib.sha1(key.encode('utf-8')).hexdigest()[:6]
        name = self.index['n'][i]
        safe = re.sub(r'[\\/:*?"<>|#\[\]^]', ' ', name)[:80].strip()
        sec = self.index['sectors'][self.index['s'][i]]['id']
        return self.sidecar_dir / sec / f'{safe} · {h}.md'

    def sidecar_get(self, i):
        f = self.sidecar_path(i)
        out = {'exists': f.exists(), 'path': str(f), 'visibility': 'private', 'tags': [], 'links': [], 'body': ''}
        if f.exists():
            txt = f.read_text(encoding='utf-8', errors='replace')
            m = FM_RE.match(txt)
            if m:
                fm = parse_frontmatter(m.group(1))
                out['visibility'] = fm.get('visibility', 'private') if isinstance(fm.get('visibility'), str) else 'private'
                out['tags'] = fm.get('tags', []) if isinstance(fm.get('tags'), list) else []
                out['links'] = [x.strip('[]') for x in fm.get('links', [])] if isinstance(fm.get('links'), list) else []
                out['body'] = txt[m.end():].lstrip('\n')
            else:
                out['body'] = txt
        return out

    def sidecar_put(self, i, data):
        f = self.sidecar_path(i)
        f.parent.mkdir(parents=True, exist_ok=True)
        p = self.item_path(i)
        vis = data.get('visibility', 'private')
        if vis not in ('private', 'shared', 'public'):
            vis = 'private'
        tags = [re.sub(r'[\s,\[\]]+', '-', t.strip().lstrip('#')) for t in data.get('tags', []) if t.strip()][:40]
        links = [l.strip().strip('[]') for l in data.get('links', []) if l.strip()][:60]
        vr = self.vault_rel(p)
        q = lambda s: '"' + s.replace('\\', '/').replace('"', "'") + '"'  # noqa
        lines = ['---', 's8: sidecar', f'key: {q(self.item_key(i))}', f'source: {q(str(p))}',
                 f'kind: {self.kind(i)}', f'visibility: {vis}', f'tags: [{", ".join(tags)}]',
                 'links:'] + [f'  - "[[{l}]]"' for l in links] + [f'updated: {time.strftime("%Y-%m-%d")}', '---', '']
        head = f'![[{vr}]]\n\n' if vr and self.kind(i) in ('photo', 'ai', 'screen') else ''
        body = (data.get('body') or '').rstrip() + '\n'
        if head and head.strip() not in body:
            body = head + body
        f.write_text('\n'.join(lines) + body, encoding='utf-8')
        with self.lock:
            if self.index:
                ex = self.index['x'].setdefault(str(i), {})
                ex['sc'] = ex.get('sc', -1)
        return {'ok': True, 'path': str(f)}


    # project deadlines, virtual groups, new folders ----------------------
    def project_dir(self):
        return (self.vault_path / '_s8' / 'projects') if self.vault_path else (self.sidecar_dir / 'projects')

    @staticmethod
    def safe_name(s, n=100):
        return re.sub(r'\s+', ' ', re.sub(r'[\\/:*?"<>|#\[\]^]', ' ', str(s))).strip()[:n]

    def deadlines(self):
        out, d = [], self.project_dir()
        if d.exists():
            for f in d.glob('*.md'):
                try:
                    m = FM_RE.match(f.read_text(encoding='utf-8', errors='replace'))
                except OSError:
                    continue
                if not m:
                    continue
                fm = parse_frontmatter(m.group(1))
                dl = DATE_RE.search(fm.get('deadline', '') if isinstance(fm.get('deadline'), str) else '')
                if dl and isinstance(fm.get('work'), str):
                    out.append({'work': fm['work'], 'deadline': dl.group(0), 'path': str(f)})
        return out

    def deadline_set(self, work, date):
        work = str(work or '').strip()[:120]
        date = str(date or '').strip()
        if not work:
            return {'ok': False, 'error': 'No project'}
        if date and not DATE_RE.fullmatch(date):
            return {'ok': False, 'error': 'Date must look like 2026-11-15'}
        d = self.project_dir()
        d.mkdir(parents=True, exist_ok=True)
        f = d / f'{self.safe_name(work) or "project"}.md'
        q = lambda s: '"' + s.replace('"', "'") + '"'  # noqa
        if f.exists():
            txt = f.read_text(encoding='utf-8', errors='replace')
            m = FM_RE.match(txt)
            if m:
                lines = [l for l in m.group(1).splitlines() if not re.match(r'^\s*deadline\s*:', l)]
                if date:
                    lines.append(f'deadline: {date}')
                txt = '---\n' + '\n'.join(lines) + '\n---\n' + txt[m.end():]
            else:
                txt = '\n'.join(['---', 's8: project', f'work: {q(work)}'] + ([f'deadline: {date}'] if date else []) + ['---', '']) + txt
        else:
            txt = '\n'.join(['---', 's8: project', f'work: {q(work)}'] + ([f'deadline: {date}'] if date else []) + ['---', '', f'# {work}', '']) + '\n'
        f.write_text(txt, encoding='utf-8')
        return {'ok': True, 'path': str(f)}

    def key_map(self):
        idx = self.index
        if not idx:
            return {}
        if getattr(self, '_kmap_at', None) != idx.get('at'):
            self._kmap = {self.item_key(i): i for i in range(len(idx['n']))}
            self._kmap_at = idx.get('at')
        return self._kmap

    def group_list(self):
        d, out, km = STATE / 'groups', [], self.key_map()
        if d.exists():
            for f in sorted(d.glob('*.json'), key=lambda f: f.stat().st_mtime):
                try:
                    g = json.loads(f.read_text(encoding='utf-8'))
                except Exception:
                    continue
                g['items'] = [km[k] for k in g.get('keys', []) if k in km]
                g['missing'] = len(g.get('keys', [])) - len(g['items'])
                g.pop('keys', None)
                out.append(g)
        return out

    def group_save(self, body):
        name = self.safe_name(body.get('name', ''), 80) or 'Group'
        gid = re.sub(r'[^A-Za-z0-9_\-]', '', str(body.get('id', '')))[:40] or ('g' + secrets.token_hex(4))
        keys = []
        for v in (body.get('items') or [])[:50000]:
            try:
                i = int(v)
            except (TypeError, ValueError):
                continue
            if self.item_path(i) is not None:
                keys.append(self.item_key(i))
        rule = str(body.get('rule', ''))[:400]
        d = STATE / 'groups'
        d.mkdir(parents=True, exist_ok=True)
        (d / f'{gid}.json').write_text(json.dumps({'id': gid, 'name': name, 'rule': rule, 'keys': keys,
                                                    'saved': time.strftime('%Y-%m-%d %H:%M')}, ensure_ascii=False), encoding='utf-8')
        folder = (self.vault_path / '_s8' / 'groups') if self.vault_path else (self.sidecar_dir / 'groups')
        folder.mkdir(parents=True, exist_ok=True)
        q = lambda s: '"' + s.replace('"', "'") + '"'  # noqa
        km_inv = keys[:2000]
        links = []
        for k in km_inv:
            i = self.key_map().get(k)
            p = self.item_path(i) if i is not None else None
            if p is None:
                continue
            vr = self.vault_rel(p)
            links.append(('- [[' + vr + ']]') if vr else f'- [{p.name}]({p.as_uri()})')
        text = '\n'.join(['---', 's8: group', f'id: {gid}', f'rule: {q(rule)}', f'count: {len(keys)}',
                          f'saved: {time.strftime("%Y-%m-%d %H:%M")}', '---', '', f'# {name}', '',
                          (f'Rule: `{rule}`' if rule else 'Hand-picked files.') + (f' Plus {len(keys)} picked files.' if rule and keys else ''), ''] + links) + '\n'
        (folder / f'{name}.md').write_text(text, encoding='utf-8')
        return {'ok': True, 'id': gid, 'count': len(keys), 'path': str(folder / f'{name}.md')}

    def group_delete(self, gid):
        gid = re.sub(r'[^A-Za-z0-9_\-]', '', str(gid))[:40]
        f = STATE / 'groups' / f'{gid}.json'
        if gid and f.exists():
            f.unlink()
            return {'ok': True}
        return {'ok': False, 'error': 'Unknown group'}

    def make_folder(self, root_ix, rel, name):
        idx = self.index
        try:
            root = idx['roots'][int(root_ix)]
        except (TypeError, ValueError, IndexError, KeyError):
            return {'ok': False, 'error': 'Unknown source folder'}
        name = str(name or '').strip()
        if not name or name in ('.', '..') or re.search(r'[\\/:*?"<>|]', name) or len(name) > 120:
            return {'ok': False, 'error': 'Use a plain folder name without / \\ : * ? " < > |'}
        base = Path(root['path']).resolve()
        parent = base.joinpath(*[x for x in str(rel or '').split('/') if x]).resolve()
        if parent != base and base not in parent.parents:
            return {'ok': False, 'error': 'That place is outside your folders'}
        if not parent.is_dir():
            return {'ok': False, 'error': 'Folder not found: ' + str(parent)}
        target = parent / name
        if target.exists():
            return {'ok': False, 'error': name + ' already exists there'}
        target.mkdir()
        return {'ok': True, 'path': str(target)}

    # patches and collections ----------------------------------------------
    def patch_list(self):
        d = STATE / 'patches'
        out = []
        if d.exists():
            for f in sorted(d.glob('*.json'), key=lambda f: f.stat().st_mtime):
                try:
                    out.append(json.loads(f.read_text(encoding='utf-8')))
                except Exception:
                    pass
        return out

    def patch_save(self, patch):
        pid = re.sub(r'[^A-Za-z0-9_\-]', '', str(patch.get('id', '')))[:40]
        if not pid:
            return {'ok': False, 'error': 'Patch has no id'}
        keep_keys = ('id', 'type', 'x', 'y', 'i', 'key', 'tool', 'task', 'label', 'title', 'accepted')
        clean = {'id': pid, 'name': str(patch.get('name', pid))[:120],
                 'nodes': [{k: n[k] for k in keep_keys if k in n} for n in patch.get('nodes', [])][:500],
                 'wires': [{k: w[k] for k in ('a', 'ap', 'b', 'bp') if k in w} for w in patch.get('wires', [])][:2000]}
        d = STATE / 'patches'
        d.mkdir(parents=True, exist_ok=True)
        (d / f'{pid}.json').write_text(json.dumps(clean, ensure_ascii=False, indent=1), encoding='utf-8')
        return {'ok': True}

    def collect(self, title, items, body=''):
        title = re.sub(r'\s+', ' ', re.sub(r'[\\/:*?"<>|#\[\]^]', ' ', str(title))).strip()[:100] or 'Collection'
        folder = (self.vault_path / '_s8' / 'collections') if self.vault_path else (self.sidecar_dir / 'collections')
        folder.mkdir(parents=True, exist_ok=True)
        lines, keys = [], []
        for v in items[:500]:
            try:
                i = int(v)
            except (TypeError, ValueError):
                continue
            p = self.item_path(i)
            if p is None:
                continue
            keys.append(self.item_key(i))
            vr = self.vault_rel(p)
            if vr:
                lines.append(('![[' if self.kind(i) in ('photo', 'ai', 'screen') else '- [[') + vr + ']]')
            else:
                lines.append(f'- [{p.name}]({p.as_uri()})')
        q = lambda s: '"' + s.replace('"', "'") + '"'  # noqa
        text = '\n'.join(['---', 's8: collection', f'created: {time.strftime("%Y-%m-%d %H:%M")}', 'items:'] + [f'  - {q(k)}' for k in keys] + ['---', '',
                         f'# {title}', '', (body or '').strip(), ''] + lines) + '\n'
        f = folder / f'{title}.md'
        f.write_text(text, encoding='utf-8')
        return {'ok': True, 'path': str(f), 'count': len(keys)}


# ───────────────────────────────────────────── http

class Handler(BaseHTTPRequestHandler):
    server_version = 'S8Bridge/' + VERSION
    protocol_version = 'HTTP/1.1'

    def log_message(self, fmt, *args):
        if os.environ.get('S8_VERBOSE'):
            sys.stderr.write('  ' + (fmt % args) + '\n')

    @property
    def B(self):
        return self.server.bridge

    def local_client(self):
        return self.client_address[0] in ('127.0.0.1', '::1', '::ffff:127.0.0.1')

    def host_ok(self):
        h = (self.headers.get('Host') or '').rsplit(':', 1)[0].strip('[]').lower()
        return h in self.server.allowed_hosts

    def token_ok(self, q):
        t = self.headers.get('X-S8-Token') or (q.get('k') or [''])[0]
        return bool(t) and secrets.compare_digest(t, self.B.token)

    def cors(self):
        o = self.headers.get('Origin')
        if o and o in self.B.cfg.get('allowOrigins', []):
            self.send_header('Access-Control-Allow-Origin', o)
            self.send_header('Vary', 'Origin')

    def send_bytes(self, data, ctype, status=200, gz_ok=True, extra=None):
        if gz_ok and len(data) > 1400 and 'gzip' in (self.headers.get('Accept-Encoding') or ''):
            data = gzip.compress(data, 5)
            enc = True
        else:
            enc = False
        self.send_response(status)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        if enc:
            self.send_header('Content-Encoding', 'gzip')
        self.send_header('Cache-Control', 'no-store')
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.cors()
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(data)

    def send_json(self, obj, status=200):
        self.send_bytes(json.dumps(obj, ensure_ascii=False).encode('utf-8'), 'application/json; charset=utf-8', status)

    def fail(self, status, msg):
        self.send_json({'ok': False, 'error': msg}, status)

    def send_file(self, path, ctype=None, cache=True):
        try:
            size = path.stat().st_size
            f = open(path, 'rb')
        except OSError:
            return self.fail(404, 'File not found')
        ctype = ctype or mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
        start, end, status = 0, size - 1, 200
        rng = self.headers.get('Range')
        if rng:
            m = re.match(r'bytes=(\d*)-(\d*)', rng)
            if m:
                if m.group(1):
                    start = int(m.group(1))
                    if m.group(2):
                        end = min(int(m.group(2)), size - 1)
                elif m.group(2):
                    start = max(0, size - int(m.group(2)))
                status = 206
        if start > end:
            f.close()
            self.send_response(416)
            self.send_header('Content-Range', f'bytes */{size}')
            self.end_headers()
            return
        self.send_response(status)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(end - start + 1))
        self.send_header('Accept-Ranges', 'bytes')
        if status == 206:
            self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Cache-Control', 'private, max-age=3600' if cache else 'no-store')
        self.cors()
        self.end_headers()
        if self.command == 'HEAD':
            f.close()
            return
        try:
            f.seek(start)
            left = end - start + 1
            while left > 0:
                chunk = f.read(min(1 << 20, left))
                if not chunk:
                    break
                self.wfile.write(chunk)
                left -= len(chunk)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass
        finally:
            f.close()

    def item_arg(self, q, body=None):
        v = (body or {}).get('i') if body else None
        if v is None:
            v = (q.get('i') or [None])[0]
        try:
            i = int(v)
        except (TypeError, ValueError):
            return None
        return i if self.B.item_path(i) is not None else None

    # GET ---------------------------------------------------------------------
    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        path = u.path
        if not self.host_ok():
            return self.fail(403, 'Host not allowed')
        if path in ('/', '/index.html'):
            if not self.local_client() and (q.get('key') or [''])[0] != self.B.lan_key:
                return self.fail(403, 'Add ?key=… (shown in the bridge window) to open the control room from another device')
            page = (WEB / 'index.html').read_text(encoding='utf-8')
            page = page.replace('<meta name="s8-token" content="">', f'<meta name="s8-token" content="{self.B.token}">')
            return self.send_bytes(page.encode('utf-8'), 'text/html; charset=utf-8')
        if path.startswith('/tools/') and self.B.cfg.get('toolsDir'):
            base = expand(self.B.cfg['toolsDir']).resolve()
            target = (base / path[len('/tools/'):]).resolve()
            if base in target.parents or target == base:
                if target.is_dir():
                    target = target / 'index.html'
                return self.send_file(target, cache=False)
            return self.fail(404, 'Not found')
        static = WEB / path.lstrip('/')
        if path.count('/') == 1 and static.suffix in ('.js', '.css', '.svg', '.png', '.woff2') and static.exists():
            return self.send_file(static, cache=False)
        if not self.token_ok(q):
            return self.fail(401, 'Missing or wrong token — reload the control room from the bridge address')
        B = self.B
        if path == '/api/status':
            idx = B.index
            return self.send_json({
                'ok': True, 'version': VERSION, 'os': OS_KEY, 'machine': B.cfg.get('machine') or socket.gethostname(),
                'progress': B.progress, 'indexAt': idx['at'] if idx else 0, 'items': len(idx['n']) if idx else 0,
                'tools': B.public_tools(), 'tasks': [t.json() for t in B.tasks.values()],
                'caps': B.caps, 'vault': B.vault_name, 'sidecars': str(B.sidecar_dir),
                'config': str(B.cfg_path), 'roots': [{'path': str(expand(r['path'])), 'sector': r.get('sector', 'auto'),
                                                     'ok': expand(r['path']).is_dir()} for r in B.cfg['roots']]})
        if path == '/api/index':
            if not B.index_gz:
                return self.fail(404, 'No index yet')
            data = B.index_gz
            if 'gzip' in (self.headers.get('Accept-Encoding') or ''):
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Encoding', 'gzip')
                self.send_header('Content-Length', str(len(data)))
                self.send_header('Cache-Control', 'no-store')
                self.end_headers()
                if self.command != 'HEAD':
                    self.wfile.write(data)
                return
            return self.send_bytes(gzip.decompress(data), 'application/json; charset=utf-8', gz_ok=False)
        if path == '/api/patches':
            return self.send_json({'ok': True, 'patches': B.patch_list()})
        if path == '/api/groups':
            return self.send_json({'ok': True, 'groups': B.group_list()})
        if path == '/api/deadlines':
            return self.send_json({'ok': True, 'deadlines': B.deadlines()})
        if path == '/api/tasks':
            return self.send_json({'ok': True, 'tasks': [t.json() for t in B.tasks.values()], 'progress': B.progress})
        if path == '/api/task':
            t = B.tasks.get((q.get('id') or [''])[0])
            return self.send_json({'ok': True, 'task': t.json(full=True)}) if t else self.fail(404, 'Unknown task')
        if path == '/api/text':
            i = self.item_arg(q)
            if i is None:
                return self.fail(404, 'Unknown item')
            p = B.item_path(i)
            try:
                with open(p, 'r', encoding='utf-8', errors='replace') as f:
                    txt = f.read(2_000_000)
            except OSError:
                return self.fail(404, 'File not readable')
            return self.send_bytes(txt.encode('utf-8'), 'text/plain; charset=utf-8')
        if path == '/api/sidecar':
            i = self.item_arg(q)
            return self.send_json(dict(ok=True, **B.sidecar_get(i))) if i is not None else self.fail(404, 'Unknown item')
        if path.startswith('/f/') or path.startswith('/t/'):
            try:
                i = int(path[3:].split('/')[0])
            except ValueError:
                return self.fail(404, 'Unknown item')
            p = B.item_path(i)
            if p is None:
                return self.fail(404, 'Unknown item')
            if path.startswith('/f/'):
                ext = p.suffix.lower()
                ct = {'.md': 'text/markdown; charset=utf-8', '.heic': 'image/heic', '.glb': 'model/gltf-binary',
                      '.txt': 'text/plain; charset=utf-8', '.py': 'text/plain; charset=utf-8'}.get(ext)
                return self.send_file(p, ct)
            t = B.thumb(i)
            if t:
                return self.send_file(t)
            if p.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'):
                try:
                    if p.stat().st_size < 12_000_000:
                        return self.send_file(p)
                except OSError:
                    pass
            return self.fail(404, 'No thumbnail')
        return self.fail(404, 'Not found')

    # POST --------------------------------------------------------------------
    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-S8-Token')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_POST(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        if not self.host_ok():
            return self.fail(403, 'Host not allowed')
        if not self.token_ok(q):
            return self.fail(401, 'Missing or wrong token')
        try:
            n = int(self.headers.get('Content-Length') or 0)
            body = json.loads(self.rfile.read(min(n, 4_000_000)) or b'{}') if n else {}
        except ValueError:
            return self.fail(400, 'Body must be JSON')
        B, path = self.B, u.path
        try:
            if path == '/api/open':
                i = self.item_arg(q, body)
                tool = body.get('tool')
                if tool:
                    return self.send_json(B.tool_action(tool, i, self.headers.get('Host', '')))
                if i is None:
                    return self.fail(404, 'Unknown item')
                p = B.item_path(i)
                if body.get('reveal'):
                    reveal(p)
                    return self.send_json({'ok': True, 'did': 'revealed'})
                open_default(p)
                return self.send_json({'ok': True, 'did': 'opened'})
            if path == '/api/sidecar':
                i = self.item_arg(q, body)
                return self.send_json(B.sidecar_put(i, body)) if i is not None else self.fail(404, 'Unknown item')
            if path == '/api/task/run':
                t = B.tasks.get(body.get('id', ''))
                if not t:
                    return self.fail(404, 'Unknown task')
                paths = []
                for v in (body.get('inputs') or [])[:200]:
                    try:
                        p = B.item_path(int(v))
                    except (TypeError, ValueError):
                        p = None
                    if p is not None:
                        paths.append(p)
                return self.send_json({'ok': t.run(paths), 'task': t.json()})
            if path == '/api/patch':
                return self.send_json(B.patch_save(body.get('patch') or {}))
            if path == '/api/collect':
                return self.send_json(B.collect(body.get('title', ''), body.get('items') or [], body.get('body', '')))
            if path == '/api/group':
                return self.send_json(B.group_save(body))
            if path == '/api/group/delete':
                return self.send_json(B.group_delete(body.get('id', '')))
            if path == '/api/deadline':
                return self.send_json(B.deadline_set(body.get('work', ''), body.get('date', '')))
            if path == '/api/mkdir':
                return self.send_json(B.make_folder(body.get('root'), body.get('rel', ''), body.get('name', '')))
            if path == '/api/task/stop':
                t = B.tasks.get(body.get('id', ''))
                if t:
                    t.stop()
                return self.send_json({'ok': bool(t)})
            if path == '/api/reindex':
                return self.send_json({'ok': B.reindex(background=True)})
        except Exception as ex:  # noqa
            return self.fail(500, str(ex))
        return self.fail(404, 'Not found')


# ───────────────────────────────────────────── main

def load_config(path):
    path = Path(path)
    if not path.exists():
        ex = HERE / 'config.example.json'
        if ex.exists():
            shutil.copy(ex, path)
            print(f'  created {path.name} from config.example.json — edit the folder paths, then reindex')
        else:
            sys.exit('config.json missing')
    with open(path, 'r', encoding='utf-8') as f:
        cfg = json.load(f)
    cfg.setdefault('sectors', [{'id': 'brain', 'name': 'Second brain'}])
    cfg.setdefault('roots', [])
    return cfg


def main():
    ap = argparse.ArgumentParser(description='SYSTEM 8 control room bridge')
    ap.add_argument('--config', default=str(HERE / 'config.json'))
    ap.add_argument('--reindex', action='store_true', help='rebuild the index on start')
    ap.add_argument('--index-only', action='store_true', help='rebuild the index and exit')
    ap.add_argument('--port', type=int)
    ap.add_argument('--host')
    ap.add_argument('--no-browser', action='store_true')
    a = ap.parse_args()
    cfg = load_config(a.config)
    port = a.port or int(cfg.get('port', 8808))
    host = a.host or cfg.get('host', '127.0.0.1')
    STATE.mkdir(exist_ok=True)
    B = Bridge(cfg, Path(a.config).resolve())
    print(f'\n  SYSTEM 8 · Control room bridge {VERSION}  ({OS_KEY}, Pillow {"yes" if HAS_PIL else "no"}, '
          f'ffmpeg {"yes" if B.caps["ffmpeg"] else "no"})')
    loaded = False if a.reindex else B.load_cached()
    if a.index_only:
        B.reindex(background=False)
        return
    if not loaded:
        print('  indexing in the background …')
        B.reindex(background=True)
    elif B.index.get('mdv') != MD_PARSE_V:
        print('  reading notes once more for deadlines and projects (background) …')
        B.reindex(background=True)
    srv = ThreadingHTTPServer((host, port), Handler)
    srv.daemon_threads = True
    srv.bridge = B
    allowed = {'127.0.0.1', 'localhost', '::1'}
    if host not in ('127.0.0.1', 'localhost'):
        ip = lan_ip()
        if ip:
            allowed.add(ip)
        allowed.add(socket.gethostname().lower())
        allowed.add(socket.gethostname().lower() + '.local')
        allowed |= {h.lower() for h in cfg.get('lanHosts', [])}
    srv.allowed_hosts = allowed
    url = f'http://127.0.0.1:{port}/'
    print(f'  control room:  {url}')
    if host not in ('127.0.0.1', 'localhost'):
        ip = lan_ip()
        print(f'  other devices: http://{ip}:{port}/?key={B.lan_key}')
    print('  stop with Ctrl+C\n')
    if not a.no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print('\n  bridge stopped')


if __name__ == '__main__':
    main()
