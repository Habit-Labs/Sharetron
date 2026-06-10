# Sharetron

Share Obsidian notes through the native OS share sheet — as Markdown or PDF.

## Features

- **Share as Markdown** — hands the original `.md` file to the macOS share sheet (Messages, Mail, AirDrop, etc.).
- **Share as PDF** — renders the note with Obsidian's own Markdown renderer and prints it to a real, text-based PDF (selectable text, embedded images), then opens the share sheet.
- **Mobile** — on iOS, shares the note via the system share sheet using the Web Share API.
- Share from the ribbon icon, the editor toolbar, the file/editor context menus, or the command palette (`Share note`).

## Platform support

| Platform | Markdown | PDF |
|---|---|---|
| macOS | ✅ | ✅ |
| iOS | ✅ | — |
| Windows / Linux / Android | — | — |

The desktop share sheet uses Electron's `ShareMenu`, which is a macOS-only API, so the plugin is intentionally inactive on Windows and Linux.

## Privacy & security

- **No network calls.** The plugin never sends your notes anywhere; sharing is handled entirely by the operating system's share sheet.
- **No runtime dependencies.** PDF generation uses Electron's built-in `printToPDF` — there are no third-party libraries bundled.
- **No clipboard access.** Sharing goes through the OS share sheet only.
- Shared PDFs are written to the OS temporary directory with owner-only permissions (`0600`) so the share target (Messages, AirDrop, …) can read them. They are not deleted immediately — the share target may still be reading the file after the sheet closes — but any Sharetron temp files older than one hour are cleaned up the next time the plugin loads.

### About the "filesystem access" disclosure

Obsidian's safety scorecard flags this plugin for direct filesystem access. That access exists for exactly one reason: the macOS share sheet needs a real file on disk, so the generated PDF is written to the OS temporary directory (writing it inside your vault would sync temp files to all your devices). The plugin writes only its own `sharetron-*` temp files there, and deletes only those. Nothing else on your system is read or written.

### Release provenance

Release assets are built and published by [GitHub Actions](.github/workflows/release.yml) with [artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations). You can cryptographically verify that any release asset was built from this repository's source:

```bash
gh attestation verify main.js -R Habit-Labs/Sharetron
```

## Installation (manual)

Copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/sharetron/`, then enable **Sharetron** in Settings → Community plugins.

## Development

```bash
npm install
npm run dev    # watch build
npm run build  # type-check + production build
```

## License

[MIT](LICENSE)
