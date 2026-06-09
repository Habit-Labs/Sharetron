import { App, Component, MarkdownRenderer, Notice, TFile } from 'obsidian';
import { ShareFormat } from './format-modal';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

export async function desktopShare(app: App, file: TFile, format: ShareFormat): Promise<void> {
	try {
		if (format === 'markdown') {
			await shareMarkdown(app, file);
		} else {
			await sharePdf(app, file);
		}
	} catch (err: any) {
		console.error('Share Note: desktop share failed', err);
		new Notice(`Failed to share: ${err.message}`);
	}
}

async function shareMarkdown(app: App, file: TFile): Promise<void> {
	const fullPath = getFullPath(app, file);
	openShareMenu(fullPath);
}

async function sharePdf(app: App, file: TFile): Promise<void> {
	const markdown = await app.vault.read(file);

	const container = document.createElement('div');
	const component = new Component();
	component.load();
	await MarkdownRenderer.render(app, markdown, container, file.path, component);
	const htmlContent = container.innerHTML;
	component.unload();

	const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
pre { background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; }
code { font-family: 'SF Mono', Monaco, monospace; font-size: 0.9em; }
img { max-width: 100%; }
h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; }
p { line-height: 1.6; }
blockquote { border-left: 3px solid #ccc; padding-left: 16px; margin-left: 0; color: #555; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
th { background: #f5f5f5; }
</style>
</head>
<body>${htmlContent}</body>
</html>`;

	const htmlPath = path.join(os.tmpdir(), `sharetron-${file.basename}.html`);
	const pdfPath = path.join(os.tmpdir(), `${file.basename}.pdf`);

	fs.writeFileSync(htmlPath, fullHtml);

	const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
		const webview = document.createElement('webview') as any;
		webview.style.position = 'fixed';
		webview.style.left = '-9999px';
		webview.style.width = '800px';
		webview.style.height = '600px';
		webview.src = `file://${htmlPath}`;
		document.body.appendChild(webview);

		const cleanup = () => {
			if (webview.parentNode) document.body.removeChild(webview);
		};

		const timeout = setTimeout(() => {
			cleanup();
			reject(new Error('PDF conversion timed out'));
		}, 15000);

		webview.addEventListener('dom-ready', async () => {
			try {
				const buf = await webview.printToPDF({
					pageSize: 'Letter',
					printBackground: true,
				});
				clearTimeout(timeout);
				cleanup();
				resolve(Buffer.from(buf));
			} catch (err) {
				clearTimeout(timeout);
				cleanup();
				reject(err);
			}
		});

		webview.addEventListener('did-fail-load', () => {
			clearTimeout(timeout);
			cleanup();
			reject(new Error('Failed to load HTML for PDF conversion'));
		});
	});

	try { fs.unlinkSync(htmlPath); } catch { /* */ }
	fs.writeFileSync(pdfPath, pdfBuffer);

	openShareMenu(pdfPath, () => {
		try { fs.unlinkSync(pdfPath); } catch { /* */ }
	});
}

function getFullPath(app: App, file: TFile): string {
	const adapter = app.vault.adapter as any;
	if (typeof adapter.getFullPath === 'function') {
		return adapter.getFullPath(file.path);
	}
	return path.join(adapter.getBasePath(), file.path);
}

function openShareMenu(filePath: string, onClose?: () => void): void {
	const electron = require('electron');
	const ShareMenu = electron.ShareMenu || (electron.remote && electron.remote.ShareMenu);

	if (!ShareMenu) {
		new Notice('Share sheet is not available on this version of Obsidian.');
		return;
	}

	const shareMenu = new ShareMenu({ filePaths: [filePath] });
	shareMenu.popup({ callback: onClose });
}
