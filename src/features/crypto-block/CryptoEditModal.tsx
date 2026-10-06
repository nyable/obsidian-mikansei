import { Modal, Notice, type App } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { i18n } from "src/i18n";
import { askDirtyAction } from "./CryptoConfirmModal";
import { cryptoErrorMessage, safeLanguage } from "./cryptoService";
import { CryptoEditDialog } from "./components/CryptoEditDialog";
import type { CryptoContentDraft } from "./types";

export interface CryptoEditorHandle {
	finished: Promise<void>;
	dispose: () => void;
}

export function openCryptoEditor(app: App, initial: CryptoContentDraft, onSave: (draft: CryptoContentDraft) => Promise<void>): CryptoEditorHandle {
	let finish!: () => void;
	const finished = new Promise<void>((resolve) => { finish = resolve; });
	const modal = new CryptoEditModal(app, initial, onSave, finish);
	modal.open();
	return { finished, dispose: () => modal.dispose() };
}

class CryptoEditModal extends Modal {
	private root: Root | null = null;
	private draft: CryptoContentDraft;
	private initial: CryptoContentDraft;
	private busy = false;
	private closing = false;
	private ended = false;
	private error = "";
	private confirmation = new AbortController();

	constructor(app: App, initial: CryptoContentDraft, private onSave: ((draft: CryptoContentDraft) => Promise<void>) | null, private finish: () => void) {
		super(app);
		this.initial = { ...initial };
		this.draft = { ...initial };
	}

	private get dirty(): boolean {
		return this.draft.text !== this.initial.text || this.draft.remark !== this.initial.remark || this.draft.language !== this.initial.language;
	}

	onOpen(): void {
		this.modalEl.addClass("nya-crypto-edit-modal");
		this.titleEl.setText(i18n.t("crypto.ui.editTitle"));
		this.root = createRoot(this.contentEl);
		this.render();
	}

	private render(): void {
		if (this.ended) return;
		this.root?.render(<CryptoEditDialog draft={this.draft} dirty={this.dirty} busy={this.busy || this.closing} error={this.error}
			onChange={(draft) => {
				if (this.busy || this.closing || this.ended) return;
				this.draft = { ...draft };
				this.render();
			}}
			onSave={() => { if (!this.closing) void this.save(); }} onCancel={() => this.close()} />);
	}

	private async save(): Promise<void> {
		if (this.busy || this.ended || !this.dirty || !this.onSave) return;
		if (this.draft.language !== safeLanguage(this.draft.language)) {
			this.error = i18n.t("crypto.ui.languageInvalid");
			this.render();
			return;
		}
		this.busy = true;
		this.error = "";
		this.render();
		try {
			await this.onSave({ ...this.draft });
			if (!this.ended) super.close();
		} catch (failure) {
			if (!this.ended) this.error = cryptoErrorMessage(failure);
		} finally {
			this.busy = false;
			this.render();
		}
	}

	close(): void {
		// Every user exit (including Escape and backdrop clicks) follows the same guard.
		if (this.ended || this.busy || this.closing) return;
		if (!this.dirty) { super.close(); return; }
		void this.requestClose();
	}

	private async requestClose(): Promise<void> {
		this.closing = true;
		this.render();
		try {
			const choice = await askDirtyAction(this.app, this.confirmation.signal);
			if (this.ended) return;
			if (choice === "discard") super.close();
			else if (choice === "save") await this.save();
		} finally {
			this.closing = false;
			this.render();
		}
	}

	dispose(): void {
		if (this.ended) return;
		if (this.dirty && !this.busy) new Notice(i18n.t("crypto.ui.draftLost"), 8000);
		super.close();
	}

	onClose(): void {
		if (this.ended) return;
		this.ended = true;
		this.confirmation.abort();
		this.root?.unmount();
		this.root = null;
		this.contentEl.empty();
		this.draft = this.initial = { text: "", remark: "", language: "" };
		this.onSave = null;
		this.finish();
	}
}
