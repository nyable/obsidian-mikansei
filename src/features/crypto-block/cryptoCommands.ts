import { MarkdownView, Notice, type Editor } from "obsidian";
import type Mikansei from "src/main";
import { i18n } from "src/i18n";
import { isEncryptedContent } from "./crypto";
import { openCryptoDialog } from "./CryptoConfirmModal";
import { parseFencedBlocks } from "./blockContent";
import { captureTarget, writeTarget } from "./blockStorage";
import { cryptoErrorMessage, encryptContent, unlockContent } from "./cryptoService";

export function registerCryptoCommands(plugin: Mikansei): void {
	for (const operation of ["encrypt", "decrypt"] as const) {
		plugin.addCommand({
			id: `nya-crypto-${operation}`,
			name: i18n.t(operation === "encrypt" ? "command.cryptoEncrypt" : "command.cryptoDecrypt"),
			editorCheckCallback(checking, editor, view) {
				if (!(view instanceof MarkdownView) || !view.file || !plugin.settings.cryptoBlockEnabled) return false;
				const block = parseFencedBlocks(editor.getValue()).find((item) =>
					item.language === plugin.settings.cryptoBlockLanguage && item.indent === "" &&
					editor.getCursor().line >= item.start && editor.getCursor().line <= item.end);
				if (!block || isEncryptedContent(block.body) !== (operation === "decrypt")) return false;
				if (!checking) void runCommand(plugin, editor, view, block.start, operation);
				return true;
			},
		});
	}
}

async function runCommand(plugin: Mikansei, editor: Editor, view: MarkdownView, start: number, operation: "encrypt" | "decrypt") {
	try {
		const target = await captureTarget(plugin.app, view.file!.path, start, plugin.settings.cryptoBlockLanguage, editor);
		await openCryptoDialog(plugin.app, {
			mode: operation,
			title: i18n.t(operation === "encrypt" ? "crypto.dialog.encryptTitle" : "crypto.ui.decryptPermanent"),
			submitLabel: i18n.t(operation === "encrypt" ? "crypto.dialog.submitEncrypt" : "crypto.ui.decryptPermanent"),
			description: i18n.t(operation === "encrypt" ? "crypto.ui.encryptHint" : "crypto.ui.permanentWarning"),
			onSubmit: async ({ password, remarks, language }) => {
				const body = operation === "encrypt"
					? await encryptContent(target.snapshot.block.body, password, remarks, language ?? "text")
					: (await unlockContent(target.snapshot.block.body, password)).text;
				await writeTarget(plugin.app, target, body);
				new Notice(i18n.t(operation === "encrypt" ? "crypto.notice.encryptSuccess" : "crypto.notice.decryptToFileSuccess"));
			},
		});
	} catch (error) {
		new Notice(cryptoErrorMessage(error));
	}
}
