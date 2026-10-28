import { MarkdownView, Notice, type Editor } from "obsidian";
import type Mikansei from "src/main";
import { i18n } from "src/i18n";
import { isEncryptedContent } from "./crypto";
import { openCryptoDialog } from "./CryptoConfirmModal";
import { BlockConflictError, parseFencedBlocks } from "./blockContent";
import { captureTarget, writeTarget } from "./blockStorage";
import { cryptoErrorMessage, encryptContent, unlockContent } from "./cryptoService";

export function registerCryptoCommands(plugin: Mikansei): () => void {
	let disposed = false;
	const pending = new Map<string, AbortController>();
	const cancel = () => {
		for (const controller of pending.values()) controller.abort();
		pending.clear();
	};
	plugin.register(() => { disposed = true; cancel(); });
	for (const operation of ["encrypt", "decrypt"] as const) {
		plugin.addCommand({
			id: `nya-crypto-${operation}`,
			name: i18n.t(operation === "encrypt" ? "command.cryptoEncrypt" : "command.cryptoDecrypt"),
			editorCheckCallback(checking, editor, view) {
				if (disposed || !(view instanceof MarkdownView) || !view.file || !plugin.settings.cryptoBlockEnabled) return false;
				const block = parseFencedBlocks(editor.getValue()).find((item) =>
					item.language === plugin.settings.cryptoBlockLanguage && item.indent === "" &&
					editor.getCursor().line >= item.start && editor.getCursor().line <= item.end);
				if (!block || isEncryptedContent(block.body) !== (operation === "decrypt")) return false;
				// One command per file while capturing, waiting for a password or writing.
				const path = view.file.path;
				if (pending.has(path)) return false;
				if (!checking) {
					const controller = new AbortController();
					pending.set(path, controller);
					const language = plugin.settings.cryptoBlockLanguage;
					const validate = () => {
						if (disposed || controller.signal.aborted || !plugin.settings.cryptoBlockEnabled || plugin.settings.cryptoBlockLanguage !== language) throw new BlockConflictError();
					};
					void runCommand(plugin, editor, path, block.start, language, operation, controller.signal, validate)
						.finally(() => { if (pending.get(path) === controller) pending.delete(path); });
				}
				return true;
			},
		});
	}
	return cancel;
}

async function runCommand(plugin: Mikansei, editor: Editor, path: string, start: number, language: string, operation: "encrypt" | "decrypt", signal: AbortSignal, validate: () => void) {
	try {
		validate();
		const target = await captureTarget(plugin.app, path, start, language, editor);
		validate();
		await openCryptoDialog(plugin.app, {
			mode: operation,
			title: i18n.t(operation === "encrypt" ? "crypto.dialog.encryptTitle" : "crypto.ui.decryptPermanent"),
			submitLabel: i18n.t(operation === "encrypt" ? "crypto.dialog.submitEncrypt" : "crypto.ui.decryptPermanent"),
			description: i18n.t(operation === "encrypt" ? "crypto.ui.encryptHint" : "crypto.ui.permanentWarning"),
			onSubmit: async ({ password, remarks, language }) => {
				validate();
				const body = operation === "encrypt"
					? await encryptContent(target.snapshot.block.body, password, remarks, language ?? "text")
					: (await unlockContent(target.snapshot.block.body, password)).text;
				validate();
				await writeTarget(plugin.app, target, body, validate);
				new Notice(i18n.t(operation === "encrypt" ? "crypto.notice.encryptSuccess" : "crypto.notice.decryptToFileSuccess"));
			},
		}, signal);
	} catch (error) {
		if (!signal.aborted) new Notice(cryptoErrorMessage(error));
	}
}
