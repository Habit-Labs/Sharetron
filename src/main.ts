import { MarkdownView, Notice, Platform, Plugin, TFile } from 'obsidian';
import { shareNote } from './share';

export default class SharetronPlugin extends Plugin {
	private actionButtons: HTMLElement[] = [];

	async onload() {
		if (!Platform.isMacOS && !(Platform as any).isIosApp) return;

		this.cleanupOldTempFiles();

		this.addRibbonIcon('share', 'Share note', () => {
			const file = this.app.workspace.getActiveFile();
			if (!file) {
				new Notice('No note is open to share.');
				return;
			}
			shareNote(this.app, file);
		});

		const addShareActions = () => {
			this.app.workspace.iterateAllLeaves((leaf) => {
				const view = leaf.view;
				if (view instanceof MarkdownView) {
					const existing = view.containerEl.querySelector('.view-action[aria-label="Share note"]');
					if (!existing) {
						const btn = view.addAction('share', 'Share note', () => {
							const file = view.file;
							if (file) shareNote(this.app, file);
						});
						this.actionButtons.push(btn);
					}
				}
			});
		};

		this.app.workspace.onLayoutReady(addShareActions);
		this.registerEvent(this.app.workspace.on('layout-change', addShareActions));

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

	onunload() {
		for (const btn of this.actionButtons) {
			btn.remove();
		}
		this.actionButtons = [];
	}

	private cleanupOldTempFiles() {
		if (!Platform.isDesktop) return;
		try {
			const os = require('os');
			const path = require('path');
			const fs = require('fs');
			const tmpDir = os.tmpdir();
			for (const f of fs.readdirSync(tmpDir)) {
				if (f.startsWith('sharetron-') && (f.endsWith('.pdf') || f.endsWith('.html'))) {
					const fullPath = path.join(tmpDir, f);
					const stat = fs.statSync(fullPath);
					if (Date.now() - stat.mtimeMs > 3600000) {
						try { fs.unlinkSync(fullPath); } catch { /* */ }
					}
				}
			}
		} catch { /* */ }
	}
}
