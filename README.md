# Smart Question Timer

A Chrome-first, installable productivity timer for creating, uploading, solving, reviewing, checking, correcting, and sending questions back to creators. It is a client-only React PWA: there is no account, server, subscription, analytics tracker, or cloud dependency.

## What is included

- Timestamp-based active, paused, and elapsed timers that survive refreshes, tab closure, sleep, and Chrome/PWA restarts.
- Atomic lap recording with a 300 ms duplicate guard, immediate IndexedDB persistence, undo, notes, invalidation, restoration, and confirmed deletion.
- Creation, Uploading, Solving, Discrepancy Checking, Send Back to Creator, Review, Correction, and user-managed custom modes.
- Chrome Document Picture-in-Picture floating timer, standard and micro layouts, and shared actions/state with the main app.
- Dashboard, session history, summaries, analytics by date/mode/project/hour, targets, and guarded personal records.
- Full JSON backup/restore (merge or replace with a safety backup) and session, lap, daily, and mode CSV exports.
- Light/dark/system themes, keyboard shortcuts, accessible controls, reduced-motion support, install prompt, offline app shell, and update notification.
- Hash routing, relative production assets, and a GitHub Pages deployment workflow.

## Install and run locally

Requirements: Node.js 22 or newer and a current version of Google Chrome.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Other supported commands:

```bash
npm test
npm run lint
npm run build
npm run preview
```

The production output is written to `dist/`.

## Install as a Chrome PWA

1. Open the app in desktop Chrome (a secure hosted URL or localhost).
2. Open **Settings** inside the app and choose **Install PWA**, or use Chrome’s install icon/menu.
3. Confirm installation. Chrome opens the app in a standalone application window and may offer Start menu and desktop shortcut options.

This is an installed web app, not a native Windows executable. After its first successful load, the cached application shell works offline. Personal productivity data remains in the browser profile that installed the app.

## Keyboard shortcuts

- `Space`: record a question
- `P`: pause or resume
- `Ctrl+Z`: undo the latest question
- `F`: open or focus the floating timer
- `M`: switch floating standard/micro layout
- `Escape`: close dialogs

Shortcuts are ignored while typing in inputs, textareas, selects, or content-editable controls.

## Backup, restore, and browser storage

IndexedDB is the primary store for sessions, laps, pauses, work modes, settings, targets, records, and the active-session reference. No productivity history is placed in `localStorage` and nothing is uploaded automatically.

Use **Backup & Export → Full JSON Backup** periodically. Restore validates the file before changes. **Merge** skips existing session IDs. **Replace** downloads a safety backup before replacing local data. Clearing Chrome site data, using a different Chrome profile, or uninstalling the profile can remove IndexedDB data.

## GitHub Pages

Push the repository to GitHub and enable **Settings → Pages → Source: GitHub Actions**. The included workflow installs dependencies, tests, lints, builds, and deploys `dist/`. Relative Vite assets and `HashRouter` prevent repository-subpath and refresh 404 problems.

## Testing

Vitest covers active-time math, pause exclusion, averages, rates, median, fastest/slowest laps, undo/delete, invalid-lap exclusion, targets, estimates, timestamp restoration, duplicate cooldown, backup validation, duplicate-safe merge, shared floating state, and shortcut typing guards.

Before release, run:

```bash
npm test && npm run lint && npm run build
```

## Known platform limitations

- Document Picture-in-Picture is a desktop-Chrome capability. If unavailable, the main timer continues normally and the app explains the requirement.
- Chrome may restrict exact floating-window resizing; the in-window standard/micro layout still switches and is remembered.
- Notification delivery and PWA installation controls depend on Chrome permissions and secure-context rules.
- Data is intentionally device/profile-local; there is no automatic cross-device sync.
- Browser/PWA storage can be evicted under exceptional storage pressure. JSON backups are the recovery mechanism.
