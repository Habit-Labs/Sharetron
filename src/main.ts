import { MarkdownView, Notice, Platform, Plugin, TFile } from 'obsidian';
import { shareNote } from './share';

export default class ShareNotePlugin extends Plugin {
	private viewsWithAction = new WeakSet<MarkdownView>();

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

		const addShareActions = () => {
			this.app.workspace.iterateAllLeaves((leaf) => {
				const view = leaf.view;
				if (view instanceof MarkdownView && !this.viewsWithAction.has(view)) {
					this.viewsWithAction.add(view);
					view.addAction('share', 'Share note', () => {
						const file = view.file;
						if (file) shareNote(this.app, file);
					});
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

	onunload() {}
}
