import { App, Component, MarkdownRenderer, Notice, TFile, arrayBufferToBase64 } from 'obsidian';
import { ShareFormat } from './format-modal';

const PDF_RENDER_TIMEOUT_MS = 15000;

const IMAGE_MIME: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp',
	svg: 'image/svg+xml',
	bmp: 'image/bmp',
};

export async function desktopShare(app: App, file: TFile, format: ShareFormat): Promise<void> {
	try {
		if (format === 'markdown') {
			await shareMarkdown(app, file);
		} else {
			await sharePdf(app, file);
		}
	} catch (err: any) {
		console.error('Sharetron: desktop share failed', err);
		new Notice(`Failed to share: ${err.message}`);
	}
}

async function shareMarkdown(app: App, file: TFile): Promise<void> {
	const fullPath = getFullPath(app, file);
	openShareMenu(fullPath);
}

async function sharePdf(app: App, file: TFile): Promise<void> {
	const os = require('os');
	const path = require('path');
	const fs = require('fs');

	const markdown = await app.vault.read(file);

	const container = document.createElement('div');
	const component = new Component();
	component.load();
	await MarkdownRenderer.render(app, markdown, container, file.path, component);
	component.unload();

	// Obsidian's renderer injects interactive UI (copy-code etc.) that has no place in print
	container.querySelectorAll('.copy-code-button, .edit-block-button').forEach((el) => el.remove());

	await inlineEmbeddedImages(app, container, file);

	const html = buildPrintDocument(container.innerHTML);
	const suffix = Math.random().toString(36).slice(2, 10);
	const htmlPath = path.join(os.tmpdir(), `sharetron-${suffix}.html`);
	fs.writeFileSync(htmlPath, html, { mode: 0o600 });

	try {
		const pdfData = await printHtmlToPdf(htmlPath);
		const pdfPath = path.join(os.tmpdir(), `sharetron-${file.basename}-${suffix}.pdf`);
		fs.writeFileSync(pdfPath, pdfData, { mode: 0o600 });
		openShareMenu(pdfPath);
	} finally {
		try { fs.unlinkSync(htmlPath); } catch { /* */ }
	}
}

// Renders the temp HTML file in a hidden <webview> and prints it via Electron's
// printToPDF, which is available from the renderer on the webview element.
function printHtmlToPdf(htmlPath: string): Promise<Uint8Array> {
	return new Promise((resolve, reject) => {
		const webview = document.createElement('webview') as any;
		webview.src = `file://${htmlPath}`;
		webview.style.position = 'fixed';
		webview.style.left = '-9999px';
		webview.style.width = '816px';
		webview.style.height = '1056px';

		let settled = false;
		const cleanup = () => webview.remove();

		const timer = window.setTimeout(() => {
			if (settled) return;
			settled = true;
			cleanup();
			reject(new Error('Timed out while rendering the PDF.'));
		}, PDF_RENDER_TIMEOUT_MS);

		webview.addEventListener('did-finish-load', async () => {
			if (settled) return;
			try {
				const data: Uint8Array = await webview.printToPDF({
					pageSize: 'Letter',
					printBackground: true,
				});
				if (settled) return;
				settled = true;
				window.clearTimeout(timer);
				cleanup();
				resolve(data);
			} catch (err) {
				if (settled) return;
				settled = true;
				window.clearTimeout(timer);
				cleanup();
				reject(err);
			}
		});

		document.body.appendChild(webview);
	});
}

// The webview loads a plain file:// document, so vault resources (app:// URLs and
// unrendered internal-embed spans) must be inlined as data: URLs before printing.
async function inlineEmbeddedImages(app: App, container: HTMLElement, file: TFile): Promise<void> {
	for (const embed of Array.from(container.querySelectorAll('span.internal-embed[src]'))) {
		const src = embed.getAttribute('src');
		if (!src) continue;
		const target = app.metadataCache.getFirstLinkpathDest(src, file.path);
		const mime = target && IMAGE_MIME[target.extension.toLowerCase()];
		if (!target || !mime) continue;
		const data = await app.vault.readBinary(target);
		const img = document.createElement('img');
		img.src = `data:${mime};base64,${arrayBufferToBase64(data)}`;
		embed.replaceWith(img);
	}

	for (const img of Array.from(container.querySelectorAll('img'))) {
		const src = img.getAttribute('src');
		if (!src || !src.startsWith('app://')) continue;
		const target = resolveResourceFile(app, src);
		const mime = target && IMAGE_MIME[target.extension.toLowerCase()];
		if (!target || !mime) continue;
		const data = await app.vault.readBinary(target);
		img.src = `data:${mime};base64,${arrayBufferToBase64(data)}`;
	}
}

// Resource URLs look like app://<id>/<url-encoded absolute path>?<mtime>.
// Map back to a vault file by stripping the vault base path — no enumeration.
function resolveResourceFile(app: App, resourceUrl: string): TFile | null {
	try {
		const absPath = decodeURIComponent(new URL(resourceUrl).pathname);
		const adapter = app.vault.adapter as any;
		const basePath: string = adapter.getBasePath ? adapter.getBasePath() : '';
		if (!basePath || !absPath.startsWith(basePath + '/')) return null;
		const file = app.vault.getAbstractFileByPath(absPath.slice(basePath.length + 1));
		return file instanceof TFile ? file : null;
	} catch {
		return null;
	}
}

function buildPrintDocument(bodyHtml: string): string {
	return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
	body {
		font-family: -apple-system, BlinkMacSystemFont, sans-serif;
		line-height: 1.6;
		color: black;
		background: white;
		margin: 40px;
	}
	img { max-width: 100%; }
	pre, code {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		background: #f5f5f5;
		border-radius: 4px;
	}
	pre { padding: 12px; overflow-wrap: break-word; white-space: pre-wrap; }
	code { padding: 1px 4px; }
	blockquote {
		border-left: 3px solid #ccc;
		margin-left: 0;
		padding-left: 16px;
		color: #444;
	}
	table { border-collapse: collapse; }
	th, td { border: 1px solid #ccc; padding: 4px 10px; }
	a { color: #2563eb; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

function getFullPath(app: App, file: TFile): string {
	const path = require('path');
	const adapter = app.vault.adapter as any;
	if (typeof adapter.getFullPath === 'function') {
		return adapter.getFullPath(file.path);
	}
	return path.join(adapter.getBasePath(), file.path);
}

function openShareMenu(filePath: string, onClose?: () => void): void {
	const electron = require('electron');
	// ShareMenu is a main-process API; in Obsidian's renderer it is only reachable
	// through the remote module Obsidian exposes via @electron/remote.
	const ShareMenu = (electron.remote && electron.remote.ShareMenu) || electron.ShareMenu;

	if (!ShareMenu) {
		new Notice('Share sheet is not available on this version of Obsidian.');
		return;
	}

	const shareMenu = new ShareMenu({ filePaths: [filePath] });
	shareMenu.popup({ callback: onClose });
}
