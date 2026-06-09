import { App, Notice, TFile } from 'obsidian';

export async function mobileShare(app: App, file: TFile): Promise<void> {
	try {
		const content = await app.vault.read(file);
		const shareFile = new File([content], file.name, { type: 'text/markdown' });

		if (navigator.canShare && navigator.canShare({ files: [shareFile] })) {
			await navigator.share({ files: [shareFile] });
		} else {
			await navigator.clipboard.writeText(content);
			new Notice('Share not available — content copied to clipboard.');
		}
	} catch (err: any) {
		if (err instanceof DOMException && err.name === 'AbortError') return;
		console.error('Sharetron: mobile share failed', err);
		new Notice(`Failed to share: ${err.message}`);
	}
}
