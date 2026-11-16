# SYSTEM 8 · Control room — build 1.6

The working control room from design plan v0.1: one index of your archive, rings that zoom fractally from everything down to single files, lenses that split the circle into up to four independently zoomable slices, virtual groups, a graph on the same rings with bundled links, a patch room for wiring material into tools and live links that let tools drive each other, search, the year grid with deadlines, links straight into your tools, tasks and agents that can ask for you, and sidecar notes.

It is two parts:

| File | What it does |
|---|---|
| `s8.py` | **The bridge.** One Python file, nothing to install. Indexes the folders you list, serves the control room at `http://127.0.0.1:8808/`, streams files and thumbnails to it, opens files in your programs, runs your tasks. |
| `web/` | **The control room.** Plain HTML/CSS/JS, no build step. Open the folder in Cursor and edit directly. |

Without the bridge, `web/index.html` runs on a built-in sample archive (717,440 invented items) so the interface can be shown anywhere.

---

## New in 1.6 — sets, prompts, AI, sequences, 3D materials, bridges

A file wire now carries a **package**: many files, text, and (for 3D) one material made of named maps. New nodes, under *Flow* in the patch library:

| Node | Takes | Gives | What Run does |
|---|---|---|---|
| **File set** | — | many files | Holds up to 500 files: press *Use picked* after shift-clicking files anywhere, or choose a virtual folder (the set then follows it). |
| **Prompt · text** | — | text | The text you type. A note from the archive can be wired into the same input. |
| **AI engine** (one row per entry in `engines`) | prompt · references · video | image, video or text | With a `cmd`: runs it. Without: copies the prompt, shows the references in one folder (links, nothing copied) and opens the engine's address. |
| **PNG sequence → video** | frames | video | ffmpeg makes one MP4 from the stills in name order, saved beside the first frame. |
| **Material group** | texture · bump · light · reflection · normal · displacement · transparency | material | Collects the maps; each input takes one image. |
| **3D import · Blender** | object · material | 3D | Starts Blender with `bridges/blender_import.py`: imports the file, builds one Principled material from the group. |
| **Send to · Resolume Arena / Avenue** | video · image | — | Each file into the next clip of a layer, through Resolume's web server (Preferences › Webserver, port 8080). |
| **Send to · DaVinci Resolve** | video · image | — | Into the media pool of the open project, optionally numbered stills as one clip (`bridges/resolve_import.py`; needs Resolve Studio with external scripting set to Local). |
| **Send to · Resolume Wire** | video · image | — | Opens Wire with the first file and shows the rest. Wire has no way to be handed files from outside. |

Templates: *Prompt + references → AI*, *PNG sequence → video → Resolume*, *3D object + material group → Blender*. Lessons: *Feed an AI*, *3D object with a material group*.

**config.json** — two new blocks (see `config.example.json`):

```json
"engines": [
  { "id": "comfy", "name": "ComfyUI · local", "where": "local", "gives": "image", "url": "http://127.0.0.1:8188/", "cmd": [] },
  { "id": "midjourney", "name": "Midjourney", "where": "cloud", "gives": "image", "url": "https://www.midjourney.com/imagine" }
],
"bridges": { "ffmpeg": "ffmpeg", "blender": { "mac": "/Applications/Blender.app/Contents/MacOS/Blender" }, "resolume": { "url": "http://127.0.0.1:8080" } }
```

An engine's `cmd` is any program of yours; it is handed the job through placeholders: `{job}` (a JSON file with prompt, files, slots, out folder), `{prompt}`, `{prompt_file}`, `{files}` (one argument per file), `{files_file}`, `{refs}` (folder of links), `{out}`, `{python}`. Its output is the log under *Run*; a line starting `S8:` asks for you. Every job leaves a folder in `.s8/jobs/`.

The pick bar (naming a virtual folder) now uses the interface's own surface: pale panel, dark action, red-orange only on the count.

Not tested against the real programs: Blender, Resolume and Resolve were not available where this was built. ffmpeg, the job folders, engine commands and the Resolume calls (against a stand-in server) were.

---

## New in 1.5 — live links between tools

The patch room now has **two kinds of connection**, and they never mix:

| | Material wire | Live link |
|---|---|---|
| Carries | files | one number, 0–1 |
| When | once, when you press **Run** | every frame, while the control room is open |
| Drawn | between file ports (coloured by kind) | between the small bars on node rows |

It speaks the same link language as the SYSTEM 8 Builder: a **signal** is a number 0–1; a **parameter** owns its min, max and default; the **link** owns the mapping — in range, out range, curve (linear, ease, exp, log), smoothing, quantize, invert. When a source goes quiet (controller unplugged, tool closed) the tool keeps its own value.

* **Sources** (library → *Live · signals and tools*): *Time · pointer* (sine, triangle, beat, bar, pointer x/y), *Sliders · 8*, *MIDI · controller* (Connect, then Learn and move a knob), and every parameter or signal of a joined tool.
* **Targets:** parameters of a joined tool. Drag from a row's right bar to another row's left bar. Select the link to shape it in the right panel, with meters for the signal before and after mapping. Delete removes it.
* **Templates** (library → *Templates · start from one*): *Pad plays the ring*, *Slow drift · the clock plays*, *Desk · eight sliders*, *MIDI knobs · CC 1–4* (live links); *Image → SC3NE → CUTOUT*, *Moodboard → note*, *Photo → THRESHOLD → MIRROR* (file wires). Each opens as a new patch; the template stays as it is.
* **Help** (top of the left panel, switched by the *Help on / off* pill): a card that says what is in front of you — the view, the picked files, the selected node or link — and short lessons you step through (*Make a virtual folder*, *Bring files in and link them*, *Wire files into a tool*, *Link tools live*, *Shape a link*, *Play with a MIDI controller*, *Make your own tool join*, *Lenses*, *Triangles*). The lesson that fits the moment is marked *for this*; some steps can do the action for you or point at the part of the screen they mean.
* **Try it:** open the patch *Live · the pad plays the ring* — the pad drives the ring's radius, twist and weight, time drives its petals, slider 1 its spin.
* **Link check** (right panel with nothing selected, or with a live node selected): is the hub on, the clock, MIDI, and one row per SYSTEM 8 tool — *joined · follows the contract*, *joined · n problems* (each problem listed), or *does not load s8link.js yet*. **Probe** opens the tool with the hub address and waits eight seconds for it to say hello. This is the test of whether a tool is ready.

### How a tool joins (once)

Copy `web/s8link.js` next to the tool, or load it from the bridge, and declare a table of named numbers:

```html
<script src="http://127.0.0.1:8808/s8link.js"></script>
<script>
S8Link.join({
  tool: 'keha', name: 'KEHÄ',                      // the tool id from config.json
  params: {                                        // scalars only — a colour is three parameters
    radius: { get: () => r, set: v => r = v, min: 0, max: 400, default: 120 },
    petals: { get: () => n, set: v => n = Math.round(v), min: 3, max: 64, default: 12 },
  },
  signals: { pressure: () => pen.pressure },       // optional: what it gives out, 0–1
  actions: { reset: () => reset() },               // optional: things that can be triggered
});
</script>
```

* With no bridge the tool runs exactly as before (LOCAL first). With the bridge it shows up as joined, and every parameter is also a source.
* Setters are called at most once per frame, already clamped to min–max.
* Where the hub is: found by itself when the tool is served by the bridge (`toolsDir` → `http://127.0.0.1:8808/tools/…`) or when it loads `s8link.js` from the bridge; otherwise add `?s8=ws://127.0.0.1:8808/ws` to the tool's address. *Probe* does that for you.
* A working example: `http://127.0.0.1:8808/link-example.html`.

### The hub

The bridge is the hub: `ws://127.0.0.1:8808/ws`. It checks each tool's table when the tool says hello (min below max, default inside the range, numbers only), relays signals and values, and holds the clock (`clock.beat`, `clock.bar`, BPM set in the Link check). It does not evaluate links — the control room does, so links run while the control room is open in any view. The socket needs no token because it never touches files; pages from other computers or websites are refused unless listed in `allowOrigins`. Timing and pixel-derived values are never sent over it.

**The SYSTEM 8 Builder** already has a NET backend that listens for exactly these messages. Point it at `ws://127.0.0.1:8808/ws`: serve the Builder from `toolsDir` (then it is the same origin), or, if you open it as a file, add `"null"` to `allowOrigins`. It then sees every joined tool's signals as NETWORK sources. It does not yet publish its own signals or join with a table — that is the one change the Builder needs.

---

## New in 1.4 — pick, name, link, bring in

* **Pick several files:** shift-click (or ⌘/Ctrl-click) files on the rings, in the list (`L`) or in the Field. Picked files get a small red-orange square. *Pick all here* in the right panel picks everything in the focus (up to 5,000). Esc clears.
* **Name them as a virtual folder:** a bar appears at the bottom while files are picked. Type a name, press *Make virtual folder* — it opens as a lens and is listed under *Virtual folders* in the left panel. The same bar can *Add to…* an existing virtual folder, *Remove from* the one you are in, *Link them* or *Unlink*.
* **Rename** a virtual folder in the left panel (*Rename*). Its note in the vault is renamed with it.
* **Link files:** *Link them* links every picked file to every other (more than 24: each to the first one picked). Links show in the Graph at once and when a file is selected on the rings. With the bridge they are written into each file's sidecar note (`links:`), so Obsidian sees them too, and kept in `.s8/links.json`.
* **Bring files in:** drag files from Finder or Explorer onto the page, or press *Bring files…* in the right panel. They are **copied** into the folder you are zoomed into — or, when the focus spans several folders, into `Inbox` in your first folder. Nothing is overwritten (a second `board.png` becomes `board (2).png`). The new files appear at once, already picked, so you can name them as a virtual folder straight away; if a virtual folder is open as a lens, they are added to it.

A virtual folder never moves or copies files. Only *Bring files* writes files to disk, and only new ones.

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
* Links you make: `.s8/links.json` and the `links:` of each file's sidecar note.
* Files you bring in: the folder you were zoomed into, or `<first folder>/Inbox`.
* Groups (virtual folders): `.s8/groups/<id>.json` (what the app reads) and `<vault>/_s8/groups/<name>.md` (a readable note). Project deadlines set in the app: `<vault>/_s8/projects/<project>.md`.
* New folders are made only inside the folders listed in `roots`.
* The bridge only listens on this computer unless you set `host`. Every request needs the token the bridge puts into the page; other websites cannot read your files.

## Updating from 1.5

Replace `s8.py` and the `web/` folder, add the `bridges/` folder, and copy the `engines` and `bridges` blocks from `config.example.json` into your `config.json`.

## Updating from 1.4

Replace `s8.py` and the `web/` folder; keep `config.json` and `.s8/`. Nothing is reindexed.

## Updating from 1.2

Replace `s8.py` and the `web/` folder; keep your `config.json` and `.s8/`. On the first start the bridge refreshes the index once in the background, reading your notes again to pick up `deadline:` and `work:`; the control room works with the old index meanwhile.

## Not yet (next phases of the plan)

* Live links when the control room is closed (today the control room evaluates them; the hub only relays).
* Answering a waiting agent from the control room (today the agent must watch for your answer itself).
* Tools that hand their result back to the patch automatically (needs each SYSTEM 8 tool to save into the project folder or post back to the bridge).
* One bridge per machine joined in one view (Mac + PC).
* Photo dates from EXIF instead of file dates; meaning-based (embedding) search; pen layers on the year grid.
* The Builder question from the plan — whether the SYSTEM 8 Builder hosts these rooms or they stay separate.
