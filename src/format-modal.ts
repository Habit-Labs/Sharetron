import { App, Modal, Platform, setIcon } from 'obsidian';

export type ShareFormat = 'markdown' | 'pdf';

class FormatPickerModal extends Modal {
	private resolveFormat: (format: ShareFormat | null) => void;
	private resolved = false;

	constructor(app: App, resolve: (format: ShareFormat | null) => void) {
		super(app);
		this.resolveFormat = resolve;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('share-note-format-picker');
		this.setTitle('Share as...');

		const mdBtn = contentEl.createEl('button', { cls: 'share-note-format-btn' });
		const mdIcon = mdBtn.createSpan();
		setIcon(mdIcon, 'file-text');
		mdBtn.createSpan({ text: 'Markdown (.md)' });
		mdBtn.addEventListener('click', () => {
			if (!this.resolved) {
				this.resolved = true;
				this.resolveFormat('markdown');
			}
			this.close();
		});

		if (Platform.isDesktop) {
			const pdfBtn = contentEl.createEl('button', { cls: 'share-note-format-btn' });
			const pdfIcon = pdfBtn.createSpan();
			setIcon(pdfIcon, 'file-type');
			pdfBtn.createSpan({ text: 'PDF' });
			pdfBtn.addEventListener('click', () => {
				if (!this.resolved) {
					this.resolved = true;
					this.resolveFormat('pdf');
				}
				this.close();
			});
		}
	}

	onClose() {
		this.contentEl.empty();
		if (!this.resolved) {
			this.resolved = true;
			this.resolveFormat(null);
		}
	}
}

export function pickFormat(app: App): Promise<ShareFormat | null> {
	return new Promise((resolve) => {
		new FormatPickerModal(app, resolve).open();
	});
}
