# SYSTEM 8 · Control room — build 1.3

The working control room from design plan v0.1: one index of your archive, rings that zoom fractally from everything down to single files, lenses that split the circle into up to four independently zoomable slices, virtual groups, a graph on the same rings with bundled links, a patch room for wiring material into tools, search, the year grid with deadlines, links straight into your tools, tasks and agents that can ask for you, and sidecar notes.

It is two parts:

| File | What it does |
|---|---|
| `s8.py` | **The bridge.** One Python file, nothing to install. Indexes the folders you list, serves the control room at `http://127.0.0.1:8808/`, streams files and thumbnails to it, opens files in your programs, runs your tasks. |
| `web/` | **The control room.** Plain HTML/CSS/JS, no build step. Open the folder in Cursor and edit directly. |

Without the bridge, `web/index.html` runs on a built-in sample archive (717,440 invented items) so the interface can be shown anywhere.

---

## New in 1.3

* **Newest outside.** In the field, time now runs outward: this year sits at the outer edge, where the ring is longest, so recent material (most of it) gets the most room.
* **Outer ring of names.** Around the field: a black rule over each project, folder names read outward in small type, project names in bold along the circle. A project too narrow for its name along the circle gets it in bold reading outward instead. Every name is a link: click = zoom in, shift-click = lens.
* **Tools follow the circle.** The orbit of tools sits outside everything; names run along the circle. When a tool is also a project (KEHÄ, CUTOUT, SC3NE …), clicking its *name* zooms into that project's material and clicking the *square* opens the tool.
* **Lenses.** A lens is a filter with its own rings. One lens fills the circle; two, three or four split it into halves, thirds or quarters, and each slice zooms on its own. See *Lenses and groups* below.
* **Virtual groups.** Save a lens and it becomes a group: a rule, files you picked, or both. Nothing is copied or moved on disk.
* **Red triangles.** A project that needs you gets a red ▲ in front of its name. How it moves says why: **rotating** = an agent waits for permission or information, **pulsing** = something failed, **blinking** = a deadline within 14 days. The right panel lists them under *Needs you*; deadlines are marked on the year grid too.
* **New folder** in the right panel makes a real folder inside the folder you are zoomed into (only inside your configured folders).

---

## Colour (build 1.2)

Flat colour, no gradients or shadows, square corners. Every colour means one thing:

| Colour | Means |
|---|---|
| Black, greys | **Text:** MD notes (black), skills (dark grey), code (mid grey), PDF and text (light grey). Text is quiet, so material stands out. |
| Yellow | Photos |
| Blue | AI images |
| Lilac | Screenshots |
| Magenta | Videos |
| Cyan | Audio |
| Green | 3D files |
| Deep green | CAD files |
| Red-orange | **Only state and focus:** what is selected, running or needs you. It never stands for a kind. |

**Shape backs up colour:** circle = text file (notes, skills, code, PDF), square = material. The rule holds in the key, the panels, the patch ports, the tool marks around the rings and the field. In the field, text files get a round head on their line, so notes stand apart from the grey rings even at a glance.

Plain blocks have no outline. Outlines appear only for a state (selected, hover, running, an input that fits while you drag) and around floating layers (the tooltip and the view menu).

How the rings use it: the black inner ring = sectors (or whatever the focus splits into). The thin grey rings = what they hold; their names are on the outer ring. The colour band on each segment = its mix of kinds. The field = flat blocks, with colour = the main kind and three steps of strength = few → many files, newest at the outer edge. The same colours mark graph links (coloured by the linked file), tool marks (by the input they take), patch ports, wires and the bar on top of each node.

The key at top left lists every kind with its count in the current focus. Click a row to hide or show that kind. Left and right panel sections fold open and closed, and the app remembers which ones you left open.

**Changing colours:** every colour is a variable at the top of `web/style.css` (`--k-photo`, `--k-ai`, … and `--b1`–`--b3` for the rings), defined separately for light and dark. Change them there and the canvas picks them up on reload.

Patch room additions: nodes snap to a 24 px grid, **Tidy** lines nodes up in columns by wiring order, and **Duplicate** in the inspector copies the selected node.

---

## Start (macOS)

1. Put this folder somewhere permanent, e.g. `~/Pointlab/s8-control-room`.
2. Open `config.json` (created from `config.example.json` on first start, or copy it yourself) and change the folder paths under `"roots"` to your real folders.
3. Double-click `start-mac.command` — or in Terminal:
   ```
   cd ~/Pointlab/s8-control-room
   python3 s8.py
   ```
   The first run indexes everything (a few minutes for ~700,000 files; prompts inside AI PNGs are read once and cached). The browser opens by itself.

If macOS refuses to open `start-mac.command`: right-click → Open → Open.

## Start (Windows PC)

Install Python 3 from python.org (tick "Add to PATH"), then double-click `start-windows.bat`, or run `py s8.py` in the folder. In `config.json` write paths with forward slashes: `"C:/Users/Andy/Pictures/Midjourney"`.

Optional, recommended on Windows: `py -m pip install pillow` (image thumbnails) and ffmpeg on PATH (video thumbnails). On macOS thumbnails come from the system (`sips`, Quick Look) automatically.

Stop the bridge with Ctrl+C in its window. Run `python3 s8.py --reindex` to rebuild from scratch.

---

## config.json

| Key | Meaning |
|---|---|
| `machine` | A name for this computer: `"mac"` or `"pc"`. Tasks marked with a machine only start on that computer's bridge. |
| `roots` | The folders to index. `sector` = which ring sector they belong to (`auto` sorts by file kind). `workDepth`: 1 = each first-level subfolder is a *work* (project); 0 = the whole folder is one work. `name` = label shown in the app. |
| `sectors` | The ring sectors, in order. Add or rename freely; ids are what `roots` refer to. |
| `vault` | Your Obsidian vault (path + vault name). Enables "Open in Obsidian" and puts sidecar notes in `_s8/` inside the vault, so they become part of your second brain. |
| `ignore` | Folder names to skip (system folders and `node_modules` are skipped already). |
| `readPrompts` | Read prompts stored inside PNGs (ComfyUI, Automatic1111, Midjourney metadata). Midjourney file names are also turned into prompts. |
| `tools` | Your tools — see below. |
| `tasks` | Things the bridge can run and watch — see below. |
| `host` / `lanKey` | Set `"host": "0.0.0.0"` to open the control room from the iPad on the same network. The bridge prints an address with `?key=…`; without the key other devices get nothing. |
| `toolsDir` | Optional: a folder of your SYSTEM 8 web tools. The bridge serves it at `/tools/…`, so a tool's `url` can be `/tools/sc3ne/index.html`. |

### Tools — the contract

Three kinds of entry:

```json
{ "id": "blender",  "name": "Blender",  "open": { "mac": "Blender", "win": "C:/Program Files/Blender Foundation/Blender 4.2/blender.exe" }, "exts": ["blend","glb"] }
{ "id": "obsidian", "name": "Obsidian", "uri": "obsidian://open?vault={vault}&file={vaultpath}", "exts": ["md"] }
{ "id": "sc3ne",    "name": "SC3NE",    "group": "system8", "url": "/tools/sc3ne/index.html", "pass": "src", "exts": ["png","jpg"] }
```

* `open` — a program on this machine, launched with the file.
* `uri` — an app link (`{vault}`, `{vaultpath}`, `{path}`, `{name}` are filled in).
* `url` — a web tool. With `"pass": "src"` the selected file is handed over as `?src=<file address>&name=<file name>`.

**For your SYSTEM 8 tools this is the one rule to add:** on load, if the page has `?src=`, fetch that address and load it as the tool's input. Example for any of them:

```js
const src = new URLSearchParams(location.search).get('src');
if (src) loadMedia(src);            // your tool's own loader
```

Tools served from `toolsDir` share the bridge's address, so this works with no further setup. Tools hosted elsewhere also need their site listed in `allowOrigins`.

`exts` decides which files can be sent to a tool; those tools show up first when such a file is selected.

### Tasks — run and watch

```json
{ "id": "hermes", "name": "Hermes · nightly digest", "machine": "pc", "cmd": ["python", "C:/agents/hermes/digest.py"], "cwd": "C:/agents/hermes" }
```

`work` (optional) names the project a task belongs to, so its waiting or failed state puts a ▲ on that project. `cmd` is the exact command (`{python}` = the Python running the bridge, `{input}` = the first file wired into the task in the patch room, `{inputs}` = all of them as separate arguments). Output appears in the right panel's Run section; the state dot shows filled = needs you, ring = running, hollow = done. `machine` marks tasks that belong to the other computer — they are listed but only start on that machine's bridge. Built-ins: `"builtin": "reindex"` and `"builtin": "thumbs"`.

---

## Using it

### Rings (1) — one grammar at every level

The centre is the focus. Around it, three rings of structure. Outside them, the field of files, newest at the outer edge. Around the field, the names of what the rings hold: projects in bold, folders in small type.
Every node holds at most 30 files; anything larger splits again, so the same picture repeats all the way down:

**all → sector → work → folder → kind → year → month → time chunk → files**

Scroll over a ring to zoom into it (scroll out, or click the centre, to go up). The rings re-centre on what you zoomed into, so you never jump to a different screen. What the field shows depends on how much room each file gets:

| Room per file | The field shows |
|---|---|
| under ~2 px | flat blocks — strength = how many files (three steps), colour = the kind that dominates, distance = time (newest outside) |
| 2–7 px | spokes: one line per file, the dot at its date |
| 7–30 px | file names, read outward |
| 30 px and more | thumbnails, names outside; hovering shows a large preview in the centre |

Drag to turn the rings. The coloured strip on each ring segment is its mix of kinds. Names on the outer ring zoom when clicked; when you zoom down to file names, the outer ring fades and the file names take its place. With a search active, segments without hits fade and an inner line shows how much of the segment matches. `L` lists everything in the focus as a grid; double-click a file (or keep scrolling into a thumbnail) to open it. The right panel's **Focus** section shows the same work in other sectors — one project, several kinds of material.

### Lenses and groups

A lens is any filter, shown as its own rings:

* **Click a kind in the key** (top left) — e.g. CAD files. Click it again to close that lens.
* **Type in the search and press Enter** — the words become a lens. Everything the search understands works: `work:"competitions"`, `kind:photo museum`, `in:architecture year:2019-2023`, `dir:"renders/final"`, `#tag`. (Shift+Enter shows the results as a list instead.)
* **Shift-click** any ring segment, project name or folder name — or press **Open as lens** in the right panel.

Up to four lenses: one fills the circle, two split it in halves, three in thirds, four in quarters. Each slice keeps its own zoom; scroll over a slice to zoom only that one. The centre shows the slice numbers; the key lists the lenses with the same numbers, and the trail shows where the active slice is.

Drag a file from one slice onto another to add it there. **Save** (in the key or the right panel) keeps the lens as a **virtual group**: its rule plus the files you added by hand. Groups appear in the left panel; click one to open it as a lens. With the bridge, a group is also written as a note in `<vault>/_s8/groups/`, listing its files, so Obsidian and the Graph see it. **New group** in the right panel starts an empty one to drag files into. Groups never copy or move files.

### Deadlines and what needs you

A project's deadline is one line at the top of a note — what Obsidian calls *Properties* (technically *frontmatter*):

```
---
work: Mars crater city
deadline: 2026-11-15
---
```

`work:` says which project the note is about (without it, the note's own folder decides). You can also set the deadline in the right panel (Focus → Deadline); the bridge then writes or updates `<vault>/_s8/projects/<project>.md` with that line. Within 14 days the project gets a blinking ▲ on the rings and a mark on the year grid.

Agents ask for you by printing one line, `S8: needs <what>` — for example `print('S8: needs your OK to overwrite the renders', flush=True)`. The task turns to *waiting*, the project named in the task's `"work"` gets a rotating ▲, and the request shows in the right panel. The next ordinary output line sets it back to running. A task that fails gets a pulsing ▲; one you stop yourself does not. A gate waiting in the patch room marks the projects its material comes from.

(For now the agent itself must notice your answer — e.g. by watching a file. A button that answers the agent directly is a later step.)

### Graph (2)

The same rings, restricted to notes, skills and everything they link to (wikilinks, embeds, sidecars, collection notes). Links are bundled through the rings, so related notes share a path and nothing sits on top of anything else. Zoom in exactly as in Rings; select a note to bring its links forward.

### Patch (3) — the node room

Wire material into tools, agents, gates and notes. The left panel becomes the node library, the right panel the inspector for the selected node.

* **Material** — any file (from the library search, or select a file anywhere and press `P`).
* **Tools** — your SYSTEM 8 tools and programs. Their inputs come from `exts` in config.json.
* **Agents and tasks** — run with the wired files as `{input}` / `{inputs}`.
* **Gate** — nothing after it runs until you press Accept. Agents propose, you commit.
* **Collect → note** — writes a note into `<vault>/_s8/collections/` linking everything wired in. After a reindex the links show up in the Graph.

Drag from a solid output (right side of a node) to a pale input (left side). Ports are typed — image, video, audio, 3D, text, any — and coloured like the file kinds. Inputs that fit light up; the others go grey, and trying anyway tells you why and what would fit between them. **Run** follows the wires. Patches are saved in `.s8/patches/` (in the browser for the sample data).

What Run cannot do yet: get a tool's *result* back by itself. A tool opens with its input; save the result into the project folder and the next reindex brings it back as material.

### Year (4) and Field (5)

Year: 4 quarters × (3 months × 4 weeks + one free week). Days 29–31 fall into the free week. Click a cell to see that week in the Field. Field: everything or every search hit, newest first.

Search (`/`): plain words match names, folders, prompts, titles, tags. Filters: `kind:ai`, `kind:3d`, `ext:blend`, `year:2024`, `year:2020-2023`, `in:architecture`, `work:mars`, `#tag`, `-word`. Enter shows results in the Field.

Left panel `[` = what exists (archive, sources, kinds, groups, sectors, settings, keys; in Patch the node library). Right panel `]` = what you can do (needs you, lens, focus with deadline / new group / new folder, selection with prompt, links, sidecar note, tools, run; in Patch the node inspector).

---

## Where things live

* `.s8/index.json.gz` — the index; `.s8/cache.json.gz` — parsed notes and prompts; `.s8/thumbs/` — thumbnails. Delete `.s8` any time; it is rebuilt.
* Sidecar notes: `<vault>/_s8/<sector>/<file name> · <id>.md` — plain Markdown with frontmatter (`s8: sidecar`, `source`, `visibility`, `tags`, `links`).
* Collection notes from the patch room: `<vault>/_s8/collections/<title>.md`. Patches: `.s8/patches/<id>.json`.
* Groups: `.s8/groups/<id>.json` (what the app reads) and `<vault>/_s8/groups/<name>.md` (a readable note). Project deadlines set in the app: `<vault>/_s8/projects/<project>.md`.
* New folders are made only inside the folders listed in `roots`.
* The bridge only listens on this computer unless you set `host`. Every request needs the token the bridge puts into the page; other websites cannot read your files.

## Updating from 1.2

Replace `s8.py` and the `web/` folder; keep your `config.json` and `.s8/`. On the first start the bridge refreshes the index once in the background, reading your notes again to pick up `deadline:` and `work:`; the control room works with the old index meanwhile.

## Not yet (next phases of the plan)

* Answering a waiting agent from the control room (today the agent must watch for your answer itself).
* Tools that hand their result back to the patch automatically (needs each SYSTEM 8 tool to save into the project folder or post back to the bridge).
* One bridge per machine joined in one view (Mac + PC).
* Photo dates from EXIF instead of file dates; meaning-based (embedding) search; pen layers on the year grid.
* The Builder question from the plan — whether the SYSTEM 8 Builder hosts these rooms or they stay separate.
