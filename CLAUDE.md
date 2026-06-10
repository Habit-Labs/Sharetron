# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev    # esbuild watch build → main.js
npm run build  # tsc type-check (noEmit) + minified production build
npm run lint   # eslint-plugin-obsidianmd — same ruleset as Obsidian's review bot
```

There are no tests. `main.js` is gitignored — it's a build artifact, attached to GitHub releases instead of committed.

Local dev loop: the vault at `~/Desktop/Notes` symlinks `.obsidian/plugins/sharetron` to this repo. After a rebuild, reload the plugin inside Obsidian (disable/enable in Community plugins, or `app.plugins.disablePlugin('sharetron')` / `enablePlugin` from the dev console) — Obsidian does not pick up a new `main.js` on its own.

## Hard constraints

- **Zero runtime dependencies, deliberately.** PDF generation went through jspdf/html2canvas once and was ripped out (npm audit critical, 850KB bundle). It now uses Electron's `printToPDF` on a hidden `<webview>`. Do not add runtime deps; `npm audit` must stay at 0 vulnerabilities for community-plugin trust.
- **No top-level Node/Electron imports.** `manifest.json` has `isDesktopOnly: false`, so `main.js` must evaluate on mobile where `fs`/`os`/`path`/`electron` don't exist. The blessed pattern (zero lint flags, used by Obsidian's own importer plugin): `window.require('fs') as typeof import('fs')` behind a guard on the **literal** `Platform.isDesktop` (the lint rule does not accept `isDesktopApp` or a variable). `window.require` is declared in `src/types.d.ts`. A top-level `import * as fs from 'fs'` will crash the plugin on iOS at load time.
- **The automated review scorecard is public, and its ruleset is local now.** Obsidian's bot runs `eslint-plugin-obsidianmd` (public package) — `npm run lint` must be clean before any release. Errors block approval (e.g. `obsidianmd/no-static-styles-assignment`: static styles must be CSS classes, not `el.style.*` or literal `setCssStyles`); Warnings show publicly. The scanner additionally runs `@typescript-eslint/no-unsafe-*`/`require-await`/`no-floating-promises` at warn — so no `as any` casts (declare minimal ambient interfaces in `src/types.d.ts` instead), `void` fire-and-forget promises, and use `activeDocument` over `document` (popout windows). Exact final gate: the dashboard preview scan at community.obsidian.md before pushing the tag. The 1.0.2 rejection came entirely from never running this locally. Other flag sources to avoid: `vault.getFiles()`/`getMarkdownFiles()` enumeration (use `metadataCache.getFirstLinkpathDest` or `getAbstractFileByPath`), `navigator.clipboard`. Keep `fs` writes confined to `sharetron-*` files in the OS tmpdir, and keep the README "filesystem access" section accurate.
- **`Platform.isMacOS` is true on iOS.** Obsidian derives it from `navigator.appVersion.indexOf("Mac")`, and iOS user agents contain "like Mac OS X". Never use it alone to mean "desktop Mac" — gate desktop-only behavior on `Platform.isDesktop`/`isDesktopApp` and mobile on `isIosApp`/`isMobile`. (This shipped a duplicate mobile menu item in 1.0.1 before being caught.)
- **`ShareMenu` is only reachable via `electron.remote`.** It's a main-process API; `require('electron').ShareMenu` is always `undefined` in the renderer. Obsidian exposes it through its `@electron/remote` wiring as `electron.remote.ShareMenu` — that lookup in `desktop-share.ts` is not dead code, it's the only working path. (This was once "cleaned up" and broke sharing entirely.)

## Architecture

Flow: `main.ts` (lifecycle, UI entry points) → `share.ts` (platform router) → `desktop-share.ts` or `mobile-share.ts`.

- `main.ts` — registers ribbon/toolbar/context-menu/command entry points; gates the whole plugin to macOS + iOS at `onload` (Electron's `ShareMenu` is macOS-only, so Windows/Linux get a no-op); on desktop, deletes `sharetron-*` temp files older than 1 hour from the OS tmpdir.
- `desktop-share.ts` — Markdown shares hand the vault file path straight to the share sheet. PDF shares: `MarkdownRenderer.render()` → strip Obsidian's interactive UI (copy-code buttons) → inline vault-embedded images as base64 `data:` URLs (the webview is a plain `file://` document and can't resolve `app://` resources) → write temp HTML → hidden `<webview>` → `printToPDF()` → temp PDF (mode 0600, random suffix) → `ShareMenu.popup()`.
- `format-modal.ts` — Markdown/PDF picker; PDF button only on desktop.

**Temp PDF lifecycle is intentional:** the PDF is *not* deleted in the ShareMenu callback — the callback fires when the sheet closes, but the share target (Messages, AirDrop) reads the file afterwards; immediate deletion produces empty attachments. Cleanup happens on next plugin load instead. The temp *HTML* is different: it's deleted immediately after `printToPDF` returns, since the PDF bytes are already in memory.

## Releasing

To cut a release: bump the version in `manifest.json`, `package.json`, and `versions.json` (maps plugin version → `minAppVersion`) together, commit, then push a tag named exactly the bare version (`1.0.3`, no `v` prefix). `.github/workflows/release.yml` builds, generates artifact attestations, and publishes the GitHub release with `main.js`/`manifest.json`/`styles.css` — do NOT `gh release create` locally; locally-built assets have no provenance attestation. Obsidian installs by matching the release tag to the `manifest.json` version.

Directory submission happens at community.obsidian.md (web portal; sign in, link a GitHub account whose Habit-Labs org membership is **public**) — the old obsidianmd/obsidian-releases PR process is dead. Every version gets an automated review whose results appear on the plugin's public page. Status: submitted June 2026, pending review.

Identity constraints: id `sharetron` (ids must not contain "obsidian"); the name "Share Note" is taken by an existing plugin — don't revert to it.
