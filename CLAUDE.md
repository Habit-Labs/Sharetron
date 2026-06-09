# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev    # esbuild watch build → main.js
npm run build  # tsc type-check (noEmit) + minified production build
```

There are no tests. `main.js` is gitignored — it's a build artifact, attached to GitHub releases instead of committed.

Local dev loop: the vault at `~/Desktop/Notes` symlinks `.obsidian/plugins/sharetron` to this repo. After a rebuild, reload the plugin inside Obsidian (disable/enable in Community plugins, or `app.plugins.disablePlugin('sharetron')` / `enablePlugin` from the dev console) — Obsidian does not pick up a new `main.js` on its own.

## Hard constraints

- **Zero runtime dependencies, deliberately.** PDF generation went through jspdf/html2canvas once and was ripped out (npm audit critical, 850KB bundle). It now uses Electron's `printToPDF` on a hidden `<webview>`. Do not add runtime deps; `npm audit` must stay at 0 vulnerabilities for community-plugin trust.
- **No top-level Node/Electron imports.** `manifest.json` has `isDesktopOnly: false`, so `main.js` must evaluate on mobile where `fs`/`os`/`path`/`electron` don't exist. All Node builtins are lazily `require()`d inside desktop-only code paths. A top-level `import * as fs from 'fs'` will crash the plugin on iOS at load time.
- **`Platform.isMacOS` is true on iOS.** Obsidian derives it from `navigator.appVersion.indexOf("Mac")`, and iOS user agents contain "like Mac OS X". Never use it alone to mean "desktop Mac" — gate desktop-only behavior on `Platform.isDesktop`/`isDesktopApp` and mobile on `isIosApp`/`isMobile`. (This shipped a duplicate mobile menu item in 1.0.1 before being caught.)
- **`ShareMenu` is only reachable via `electron.remote`.** It's a main-process API; `require('electron').ShareMenu` is always `undefined` in the renderer. Obsidian exposes it through its `@electron/remote` wiring as `electron.remote.ShareMenu` — that lookup in `desktop-share.ts` is not dead code, it's the only working path. (This was once "cleaned up" and broke sharing entirely.)

## Architecture

Flow: `main.ts` (lifecycle, UI entry points) → `share.ts` (platform router) → `desktop-share.ts` or `mobile-share.ts`.

- `main.ts` — registers ribbon/toolbar/context-menu/command entry points; gates the whole plugin to macOS + iOS at `onload` (Electron's `ShareMenu` is macOS-only, so Windows/Linux get a no-op); on desktop, deletes `sharetron-*` temp files older than 1 hour from the OS tmpdir.
- `desktop-share.ts` — Markdown shares hand the vault file path straight to the share sheet. PDF shares: `MarkdownRenderer.render()` → strip Obsidian's interactive UI (copy-code buttons) → inline vault-embedded images as base64 `data:` URLs (the webview is a plain `file://` document and can't resolve `app://` resources) → write temp HTML → hidden `<webview>` → `printToPDF()` → temp PDF (mode 0600, random suffix) → `ShareMenu.popup()`.
- `format-modal.ts` — Markdown/PDF picker; PDF button only on desktop.

**Temp PDF lifecycle is intentional:** the PDF is *not* deleted in the ShareMenu callback — the callback fires when the sheet closes, but the share target (Messages, AirDrop) reads the file afterwards; immediate deletion produces empty attachments. Cleanup happens on next plugin load instead. The temp *HTML* is different: it's deleted immediately after `printToPDF` returns, since the PDF bytes are already in memory.

## Releasing

Community-plugin requirements already wired in: `manifest.json` id is `sharetron` (ids must not contain "obsidian"; the name "Share Note" is taken by an existing plugin — don't revert to it), `versions.json` maps plugin version → `minAppVersion` and must be updated together with `manifest.json` on every release. GitHub release tag is the bare version (`1.0.0`, no `v` prefix) with `main.js`, `manifest.json`, `styles.css` as assets.
