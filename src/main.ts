import { Notice, Platform, Plugin, TFile } from 'obsidian';
import { shareNote } from './share';

export default class ShareNotePlugin extends Plugin {
	async onload() {
		if (!Platform.isMacOS && !(Platform as any).isIosApp) return;

		this.addRibbonIcon('share', 'Share note', () => {
			const file = this.app.workspace.getActiveFile();
			if (!file) {
				new Notice('No note is open to share.');
				return;
			}
			shareNote(this.app, file);
		});

		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				if (!(file instanceof TFile) || file.extension !== 'md') return;
				menu.addItem((item) => {
					item.setTitle('Share note')
						.setIcon('share')
						.onClick(() => shareNote(this.app, file));
				});
			})
		);

		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu, _editor, view) => {
				const file = view.file;
				if (!file) return;
				menu.addItem((item) => {
					item.setTitle('Share note')
						.setIcon('share')
						.onClick(() => shareNote(this.app, file));
				});
			})
		);

		this.addCommand({
			id: 'share-note',
			name: 'Share note',
			callback: () => {
				const file = this.app.workspace.getActiveFile();
				if (!file) {
					new Notice('No note is open to share.');
					return;
				}
				shareNote(this.app, file);
			},
		});
	}

	onunload() {}
}
