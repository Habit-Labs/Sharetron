import { App, Component, MarkdownRenderer, Notice, TFile } from 'obsidian';
import { ShareFormat } from './format-modal';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
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
	component.unload();

	container.style.position = 'fixed';
	container.style.left = '-9999px';
	container.style.width = '800px';
	container.style.background = 'white';
	container.style.color = 'black';
	container.style.padding = '40px';
	container.style.fontFamily = '-apple-system, BlinkMacSystemFont, sans-serif';
	container.style.lineHeight = '1.6';
	document.body.appendChild(container);

	const canvas = await html2canvas(container, {
		scale: 2,
		useCORS: true,
		backgroundColor: '#ffffff',
	});

	document.body.removeChild(container);

	const imgData = canvas.toDataURL('image/png');
	const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
	const pageWidth = pdf.internal.pageSize.getWidth();
	const pageHeight = pdf.internal.pageSize.getHeight();
	const imgWidth = pageWidth;
	const imgHeight = (canvas.height * pageWidth) / canvas.width;

	let yOffset = 0;
	while (yOffset < imgHeight) {
		if (yOffset > 0) pdf.addPage();
		pdf.addImage(imgData, 'PNG', 0, -yOffset, imgWidth, imgHeight);
		yOffset += pageHeight;
	}

	const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
	const pdfPath = path.join(os.tmpdir(), `sharetron-${file.basename}.pdf`);
	fs.writeFileSync(pdfPath, pdfBuffer);

	openShareMenu(pdfPath);
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
