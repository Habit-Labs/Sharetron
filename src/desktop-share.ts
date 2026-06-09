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

	const electron = require('electron');
	const { BrowserWindow } = electron.remote || electron;

	const win = new BrowserWindow({
		show: false,
		width: 800,
		height: 600,
		webPreferences: { offscreen: true },
	});

	await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);

	const pdfBuffer = await win.webContents.printToPDF({
		printBackground: true,
		pageSize: 'Letter',
		margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
	});

	win.destroy();

	const tmpPath = path.join(os.tmpdir(), `${file.basename}.pdf`);
	fs.writeFileSync(tmpPath, pdfBuffer);

	openShareMenu(tmpPath, () => {
		try { fs.unlinkSync(tmpPath); } catch { /* already cleaned up */ }
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
