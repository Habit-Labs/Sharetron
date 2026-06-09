import { App, Platform, TFile } from 'obsidian';
import { pickFormat } from './format-modal';
import { desktopShare } from './desktop-share';
import { mobileShare } from './mobile-share';

export async function shareNote(app: App, file: TFile): Promise<void> {
	if (Platform.isMobile) {
		await mobileShare(app, file);
		return;
	}

	const format = await pickFormat(app);
	if (!format) return;

	await desktopShare(app, file, format);
}
