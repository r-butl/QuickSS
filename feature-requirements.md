# Documentation Capture Tool — Feature Requirements

Open-source (MIT), Electron-based alternative to Scribe. Reference doc, updated as scope changes.

## Design Intent

Document in **one pass**: capture, caption, done. Never revisit a step after it's confirmed. Every design decision should optimize for finishing the doc during the capture session itself, not for speed-of-capture followed by a batch editing pass.

## Structure

**Guide → Thread → Step.** A Guide is the top-level container for one document (what ultimately gets exported). A Guide contains one or more Threads, each an ordered sequence of Steps representing one sub-workflow. A Guide persists and can be reopened across app launches to keep adding Threads, it isn't a disposable session.

**On-disk model**: folder-per-Guide, containing `manifest.json` (Guide/Thread/Step metadata) and an `images/` subfolder (raw screenshots). Atomic autosave (requirement 12) writes the image file first, then atomically swaps in the updated manifest, so the manifest never references an image that doesn't exist yet.

## Core Requirements

1. **Command-mode capture** — capture is triggered explicitly via hotkey, not on every click.
   - Two distinct hotkeys: one for full-screen capture, one for a cursor-region ("window") capture.
   - Cursor-region sizing: fixed default size (e.g. 800×600) centered on cursor, resized afterward via the crop tool. (Press-and-hold-to-grow considered and deferred, see Implementation Notes.)

2. **Capture command window** — a small persistent window/HUD during Guide capture showing:
   - A running tally of step counts across all Threads in the Guide (e.g. "Thread 1: 8 · Thread 2: 3 active"), computed live since steps can move between threads, see #3, not incremented on capture
   - Control to start a new thread
   - Toggle into **overview mode** (see #3) and back into capture mode

3. **Threads** — a Guide is composed of one or more threads, each thread being an ordered sequence of steps representing one sub-workflow of the overall tutorial. Overview mode is where threads and their step order are viewed/edited. **Steps are movable between threads in overview mode** (not fixed at capture time): steps have a stable ID independent of thread membership, and each thread stores an ordered array of step IDs rather than owning steps directly. Steps dragged out with no destination land in an "unsorted" bucket rather than being lost. Threads auto-name at creation ("Thread 1," "Thread 2," ...) and are renameable in overview mode. Capturing before any thread exists in a Guide auto-creates "Thread 1" rather than blocking or erroring.

4. **Post-capture preview with inline caption** — core to the one-pass flow, not optional:
   - Immediately after capture, show a preview of the shot
   - Add caption/text on the spot, while context is fresh
   - **Enter**: confirm, append to the current thread, return to capture mode
   - **Esc**: discard, return to capture mode to retry

5. **Full-screen capture** — captures the whole desktop, not scoped to a single browser tab or window. On multi-monitor setups, captures the display currently under the cursor at the moment the hotkey is pressed, not the primary display and not all displays stitched together.

6. **Capture-invisible command window** — the command window (and preview window) must not appear in the screenshots it takes.

7. **Cursor handling**:
   - Raw capture is always taken cursor-free
   - Cursor position is stored as metadata on every capture, regardless of visibility setting
   - A **global hotkey** (same keybinding everywhere) toggles cursor visibility, but the toggle is scoped **per capture**, not app-wide. Pressing it during preview sets whether that step's cursor shows on save.
   - Since the cursor is composited at render time from stored position data (not baked into the image), the per-step toggle remains editable later in the editor/overview mode, not locked in at save time.

8. **Editor / overview mode** — add/edit/delete steps: edit caption and description text, reorder steps within a thread and move steps across threads (see #3), crop screenshots (see #9), delete a step entirely, all metadata-only except delete. No annotation tools (arrows, callouts, redaction/blur) in scope for now, text and crop only.

9. **Croppable images** — metadata-only, non-destructive: crop stored as metadata, original image never mutated, always resizable/undoable/reversible later.

10. **Flexible/structured data format** — underlying storage supports easy transformation, not locked to one export type.

11. **Multi-format export** — JSON, PDF, Markdown (and others as needed). Whole-Guide export only for v1, not per-Thread: a Thread is defined as a sub-workflow of "the overall tutorial" (#3), so exporting a fragment doesn't match the model's own semantics. Per-Thread export can be added later if a real use case shows up.

12. **Autosave, every confirmed step** — the Guide is written to disk immediately after each step is confirmed (Enter in the preview), not only on explicit save/exit. A crash should lose at most the currently-unconfirmed preview, never previously confirmed steps. Writes must be atomic (write to a temp file, then rename into place) so an interrupted write can't corrupt the Guide, frequent saves only improve durability if each individual write is safe.

13. **Keybindings** — configurable in settings. Defaults (base letter with a required modifier prefix, e.g. `Ctrl+Shift+<key>` / `Cmd+Shift+<key>` on macOS, bare letters can't be global hotkeys or they'd hijack normal typing system-wide):
    - `F` — full-screen capture
    - `R` — region (cursor-area) capture
    - `C` — cursor visibility toggle (per-capture, see #7)
    - `N` — start new thread
    - `O` — toggle overview mode

14. **Guide creation / library** — on app launch, a minimal picker: "New Guide" (prompts for a title, creates the on-disk folder per the Structure section, drops straight into capture mode) or "Open Guide" (recent-list / file picker for an existing Guide folder).

15. **Settings panel** — holds, at minimum, the keybinding configuration from requirement 13. Other future settings (default region-capture size, etc.) live here too.

## Implementation Notes (from feasibility discussion)

- **Command-mode trigger**: Electron's built-in `globalShortcut` API for system-wide hotkeys. No native input-hook module required.
- **Full-screen capture**: Electron's `desktopCapturer` API supports capturing entire screens or specific windows natively.
- **Capture-invisible window**: `win.setContentProtection(true)` — on Windows, uses `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` (fully excluded on Windows 10 2004+). On macOS, sets `NSWindowSharingType.none`. Caveat: newer macOS apps using `ScreenCaptureKit` can bypass this and capture the window anyway, an Apple-side limitation, not an Electron bug. This applies to both the command window and the preview window.
- **Cursor handling**: most OS capture APIs (Windows `BitBlt`, macOS `CGWindowListCreateImage`) exclude the cursor by default, so the cursor-free raw capture is close to free. Cursor position is queried at capture time (`GetCursorInfo` on Windows, `CGEvent` position on macOS) and stored alongside the step, always. Rendering the cursor back in is a compositing step using the stored icon + coordinate, gated by a per-step boolean (`cursorVisible: true/false` in the step's metadata). The hotkey is a fixed global keybinding, but each press only mutates the currently-active step's flag, never a shared/session-wide value. This keeps it editable per-step in overview mode after the fact, since nothing is baked into pixels.
- **Cropping**: standard canvas-based editing in the renderer process (e.g. `react-image-crop`, `cropperjs`). No native dependencies. Stored as metadata, not baked into pixels, consistent with the cursor-compositing approach.
- **Export formats**: PDF via Electron's `webContents.printToPDF()`, JSON and Markdown as straightforward serialization.
- **Cursor-region sizing**: capture the full frame at every hotkey press regardless of mode, then for the cursor-region hotkey, attach a default crop rectangle centered on cursor position as metadata. No pixels are discarded; resizing later reuses the crop tool (#9) rather than new code.
  - Press-and-hold-to-grow was considered and deferred: requires a native key-hold hook (`uiohook-napi`) plus a live-updating overlay, meaningfully more engineering for a capability the fixed+resize approach already covers.
- **Post-capture preview**: a normal focused popup window, so Enter/Esc are plain local keydown listeners. No native dependency for the interaction itself, just for the content-protection exclusion (see above).
