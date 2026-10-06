import { Component, MarkdownRenderer, type App } from "obsidian";
import { safeLanguage } from "./cryptoService";

/** Keep the entire plaintext inside one fence, including embedded Markdown fences. */
export function previewMarkdown(text: string, language: string): string {
	const length = (text.match(/`{3,}/g) ?? []).reduce((maximum, run) => Math.max(maximum, run.length + 1), 3);
	const fence = "`".repeat(length);
	return `${fence}${safeLanguage(language)}\n${text}\n${fence}`;
}

class PreviewOwner extends Component {
	private disposed = false;

	onunload(): void { this.disposed = true; }

	addChild<T extends Component>(child: T): T {
		// A third-party async processor may finish after the preview has closed.
		if (this.disposed) { child.unload(); return child; }
		return super.addChild(child);
	}

	register(callback: () => unknown): void {
		if (this.disposed) callback();
		else super.register(callback);
	}
}

/** Obsidian owns the rendered DOM; React owns only the empty outer container. */
export function renderCryptoPreview(app: App, parent: Component, container: HTMLElement, sourcePath: string, text: string, language: string) {
	const host = container.ownerDocument.createElement("div");
	container.replaceChildren(host);
	const owner = parent.addChild(new PreviewOwner());
	let disposed = false;
	owner.register(() => { disposed = true; host.remove(); host.replaceChildren(); });
	const dispose = () => {
		if (disposed) return;
		disposed = true;
		parent.removeChild(owner);
		host.remove();
		host.replaceChildren();
	};
	const finished = (async () => {
		try {
			await MarkdownRenderer.render(app, previewMarkdown(text, language), host, sourcePath, owner);
		} finally {
			if (disposed) host.replaceChildren();
		}
	})();
	return { dispose, finished };
}
