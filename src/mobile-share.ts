import { App, Notice, TFile } from 'obsidian';
import { errorMessage } from './util';

export async function mobileShare(app: App, file: TFile): Promise<void> {
	try {
		const content = await app.vault.read(file);
		const shareFile = new File([content], file.name, { type: 'text/markdown' });

		if (navigator.canShare && navigator.canShare({ files: [shareFile] })) {
			await navigator.share({ files: [shareFile] });
		} else {
			new Notice('Sharing is not available on this device.');
		}
	} catch (err: unknown) {
		if (err instanceof DOMException && err.name === 'AbortError') return;
		console.error('Sharetron: mobile share failed', err);
		new Notice(`Failed to share: ${errorMessage(err)}`);
	}
}
