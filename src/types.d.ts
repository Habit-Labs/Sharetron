// Ambient typings for APIs Obsidian's Electron renderer exposes without
// official type declarations: window.require, the <webview> tag, and
// the macOS ShareMenu reachable through @electron/remote.

interface PrintToPDFOptions {
	pageSize: string;
	printBackground: boolean;
}

interface SharetronWebview extends HTMLElement {
	src: string;
	printToPDF(options: PrintToPDFOptions): Promise<Uint8Array>;
}

interface ShareMenuInstance {
	popup(options?: { callback?: () => void }): void;
}

interface ShareMenuConstructor {
	new (options: { filePaths: string[] }): ShareMenuInstance;
}

interface SharetronElectron {
	remote?: { ShareMenu?: ShareMenuConstructor };
	ShareMenu?: ShareMenuConstructor;
}

interface Window {
	require: NodeJS.Require;
}
