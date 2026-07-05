# Documentation Capture Tool — Implementation Instruction Sheet

Companion to `feature-requirements.md` (the product spec). This doc sequences the build into phases and marks two kinds of hard stops:

- **STOP — Verify**: something a human has to physically test (permission dialogs, real multi-monitor hardware, actual capture behavior). An agent cannot confirm these by reading code; work should pause here until a person checks and reports back.
- **STOP — Decide**: an implementation-level decision the feature spec doesn't cover (library choice, file layout, naming). Work should pause and get an explicit answer before continuing, so it isn't silently decided by whatever the agent picks first.

Phases are ordered so each one only depends on what's already built. Requirement numbers below refer to `feature-requirements.md`.

---

## Phase 0 — Project scaffolding

**Implement:**
- Initialize Electron project (main + renderer + preload processes)
- Pick and wire up a build tool

**STOP — Decide:**
- TypeScript or plain JS?
- Build tooling: `electron-vite`, `electron-forge`, or `electron-builder` + custom config?
- State management in the renderer: React Context, Zustand, Redux, or none (prop drilling for this scope)?
- Test framework, if any, for this pass (unit tests on the data layer at minimum are cheap; UI tests are optional for v1)
- Monorepo (separate packages for main/renderer/shared types) or a single flat package?

Nothing below this line should start until Phase 0's decisions are answered, they affect every file structure choice downstream.

---

## Phase 1 — Data model & persistence layer

**Implement:**
- Guide / Thread / Step types (Thread stores an ordered array of Step IDs, not owned Steps directly, per requirement 3)
- `manifest.json` schema, read/write
- On-disk layout per Structure section: folder-per-Guide, `manifest.json` + `images/` subfolder
- Atomic write utility (write image → temp file → rename into place; write manifest → temp file → rename into place) per requirement 12
- "Unsorted" bucket as a real, addressable container (requirement 3), not just a UI label

**STOP — Decide:**
- Exact `manifest.json` schema, and a version field for future migrations
- Image file format: PNG (lossless, simplest) vs JPEG (smaller, lossy)? Recommend PNG for v1, screenshots of UI text compress poorly and lose fidelity under JPEG.
- Where do app-level settings (requirement 15) live vs. per-Guide data? (Likely Electron's `app.getPath('userData')` for settings, separate from the user-chosen Guide folder location.)

**STOP — Verify:**
- Crash-safety test: kill the process mid-write (image write and manifest write separately) and confirm the Guide never ends up in a corrupted or inconsistent state.

---

## Phase 2 — App shell & Guide creation/library

**Implement:**
- Launch picker: "New Guide" (prompt for title, create folder) / "Open Guide" (recent list + file picker) — requirement 14
- Main window shell, navigation between capture mode and overview mode

**STOP — Verify:**
- Walk through the actual New/Open flow and confirm it matches the "minimal, no friction" intent, this is a UX judgment call, not a correctness check.

---

## Phase 3 — Capture engine

**Implement:**
- `globalShortcut` registration for all five default hotkeys (requirement 13)
- `desktopCapturer` full-screen capture (requirement 5)
- Cursor-region capture: fixed default size, centered on cursor, stored as a crop rectangle over the full frame (requirement 1, implementation notes)
- Multi-monitor logic: capture the display currently under the cursor at hotkey press (requirement 5)
- Cursor-free raw capture + cursor position metadata capture (requirement 7)
- Auto-create "Thread 1" on first capture if no thread exists yet (requirement 3)

**STOP — Decide:**
- Exact `Accelerator` strings per OS (`CommandOrControl+Shift+F` vs separate mac/Windows bindings) and a check for conflicts with common OS/app-reserved shortcuts before shipping these as defaults.

**STOP — Verify:**
- macOS Screen Recording permission flow: grant it manually, confirm capture actually works, and note whether dev-mode rebuilds require re-granting (known macOS quirk).
- Multi-monitor test on real hardware: confirm the "active display under cursor" logic actually picks the right screen. This cannot be verified without physical multi-monitor hardware.

---

## Phase 4 — Command window & content protection

**Implement:**
- Small persistent HUD window (requirement 2): running tally across all Threads, new-thread control, overview-mode toggle
- `win.setContentProtection(true)` on the command window (requirement 6)

**STOP — Verify:**
- This is the highest-risk verification in the whole build. Manually test that the command window is actually excluded from: OS screenshot tools, Zoom/Meet screen share, QuickTime screen recording, and at least one `ScreenCaptureKit`-based app on macOS (to confirm the known bypass documented in the spec actually happens, and decide if it's acceptable). Do this on both a real Mac and a real Windows machine before trusting this feature at all, this cannot be confirmed by reading code.

---

## Phase 5 — Post-capture preview

**Implement:**
- Preview popup window, content-protection applied same as Phase 4 (requirement 6)
- Caption/description text fields (requirement 4)
- Enter (confirm, append, return to capture) / Esc (discard, retry) handlers (requirement 4)
- Per-capture cursor visibility toggle (requirement 7): compositing the stored cursor icon + coordinate at render time, never baked into the saved image

**STOP — Verify:**
- Re-run the content-protection capture tests from Phase 4 against this window specifically, it's a separate window instance and needs its own confirmation.

---

## Phase 6 — Editor / overview mode

**Implement:**
- Thread list UI with live step-count tallies
- Reorder within a thread; move steps across threads, including into/out of the "unsorted" bucket (requirement 3, 8)
- Crop tool, non-destructive/metadata-only (requirement 9)
- Caption/description editing, step delete (requirement 8)
- Thread rename (requirement 3)

**STOP — Decide:**
- Drag-and-drop library: `dnd-kit`, `react-dnd`, or native HTML5 drag events? Not specified anywhere in the feature spec.

**STOP — Verify:**
- Drag-and-drop UX feel. This is a polish loop, expect several rounds of "try it, adjust" rather than a one-shot implementation. Don't treat the first working version as done.

---

## Phase 7 — Export

**Implement:**
- JSON export (near-direct serialization of the manifest)
- Markdown export (templated from Guide → Thread → Step)
- PDF export via `webContents.printToPDF()`
- Whole-Guide export only, no per-Thread export in v1 (requirement 11)

**STOP — Verify:**
- Visual review of actual PDF and Markdown output quality/formatting. Inherently subjective, needs human eyes on the rendered output, not just "did it generate a file."

---

## Phase 8 — Settings panel

**Implement:**
- Keybinding configuration UI (requirement 13, 15)
- Persistence of settings, separate from Guide data (per Phase 1's decision on settings location)

---

## Phase 9 — Packaging & distribution

**Implement:**
- `electron-builder` (or chosen tool from Phase 0) configuration, icons, app metadata

**STOP — Decide:**
- Code-signing/notarization approach for macOS, and code-signing for Windows. Costs money/accounts (Apple Developer Program, a Windows code-signing cert) — worth deciding whether v1 ships unsigned (with the associated Gatekeeper/SmartScreen warnings) or whether that investment happens before first release.

**STOP — Verify:**
- Actually run a signed (or intentionally unsigned) build on a clean machine and confirm what a new user sees, Gatekeeper prompts, SmartScreen warnings, first-launch permission requests, end to end. This can't be verified from a dev environment alone.

---

## Traceability

Every requirement in `feature-requirements.md` (1–15) maps to a phase above. If a requirement doesn't clearly map to a phase, that's a sign the plan has a gap, stop and fix the plan before writing more code.
