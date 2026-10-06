import { Modal, Setting, type App } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { CryptoDialog } from "./components/CryptoDialog";
import type { CryptoDialogOptions } from "./types";
import { i18n } from "src/i18n";

/** Keep the modal open until validation and the requested operation succeed. */
export function openCryptoDialog(app: App, options: CryptoDialogOptions): Promise<boolean> {
	return new Promise((resolve) => new CryptoConfirmModal(app, options, resolve).open());
}

class CryptoConfirmModal extends Modal {
	private root: Root | null = null;
	private settled = false;
	private busy = false;
	constructor(app: App, private options: CryptoDialogOptions, private resolve: (success: boolean) => void) {
		super(app);
	}
	onOpen(): void {
		this.modalEl.addClass("nya-crypto-modal");
		this.titleEl.setText(this.options.title);
		this.root = createRoot(this.contentEl);
		this.root.render(<CryptoDialog options={{ ...this.options, onSubmit: async (data) => {
			this.busy = true;
			try { await this.options.onSubmit(data); } finally { this.busy = false; }
		} }} onSuccess={() => {
			this.settle(true);
			this.close();
		}} onCancel={() => this.close()} />);
	}
	close(): void {
		// Escape / outside click must not hide an in-flight file mutation.
		if (!this.busy) super.close();
	}
	onClose(): void {
		this.settle(false);
		this.root?.unmount();
		this.root = null;
		this.contentEl.empty();
	}
	private settle(success: boolean): void {
		if (this.settled) return;
		this.settled = true;
		this.resolve(success);
	}
}

export function askDirtyAction(app: App, signal?: AbortSignal): Promise<"save" | "discard" | "continue"> {
	return new Promise((resolve) => {
		if (signal?.aborted) { resolve("continue"); return; }
		const modal = new Modal(app);
		let settled = false;
		const choose = (action: "save" | "discard" | "continue") => {
			if (settled) return;
			settled = true;
			signal?.removeEventListener("abort", abort);
			resolve(action);
			modal.close();
		};
		const abort = () => choose("continue");
		signal?.addEventListener("abort", abort, { once: true });
		modal.titleEl.setText(i18n.t("crypto.ui.unsaved"));
		modal.contentEl.createEl("p", { text: i18n.t("crypto.ui.unsavedHint") });
		new Setting(modal.contentEl)
			.addButton((button) => button.setButtonText(i18n.t("crypto.ui.continueEditing")).onClick(() => choose("continue")))
			.addButton((button) => button.setButtonText(i18n.t("crypto.ui.discard")).setWarning().onClick(() => choose("discard")))
			.addButton((button) => button.setButtonText(i18n.t("crypto.ui.saveEncrypted")).setCta().onClick(() => choose("save")));
		modal.onClose = () => choose("continue");
		modal.open();
	});
}
