import {
	MarkdownView,
	Notice,
	TFile,
	type Editor,
	type EditorPosition,
	type SectionCache,
} from "obsidian";
import type Mikansei from "src/main";
import { i18n } from "src/i18n";
import {
	decryptAesGcm,
	encryptAesGcm,
	isEncryptedContent,
	stringToBase64,
} from "./crypto";
import { openCryptoDialog } from "./CryptoConfirmModal";
import type { CryptoConfirmData } from "./types";

type Operation = "encrypt" | "decrypt";

export function registerCryptoCommands(plugin: Mikansei): void {
	plugin.addCommand({
		id: "nya-crypto-encrypt",
		name: i18n.t("command.cryptoEncrypt"),
		editorCheckCallback(checking, editor, view) {
			// 1. 首先确保我们处于 MarkdownView 上下文
			if (!(view instanceof MarkdownView)) {
				// 此命令仅在 Markdown 编辑器视图中可用
				return false;
			}
			// 此后，可以安全地将 view 视为 MarkdownView
			const section = findCryptoCodeBlock(plugin, editor, view);
			if (!section) {
				return false; // 不在代码块内
			}
			if (checking) {
				return true; // 命令可用
			}

			void runCommand(plugin, editor, section, "encrypt");
			return true;
		},
	});

	plugin.addCommand({
		id: "nya-crypto-decrypt",
		name: i18n.t("command.cryptoDecrypt"),
		editorCheckCallback(checking, editor, view) {
			if (!(view instanceof MarkdownView)) {
				return false;
			}
			const section = findCryptoCodeBlock(plugin, editor, view);
			if (!section) {
				return false;
			}
			if (checking) {
				return true;
			}

			void runCommand(plugin, editor, section, "decrypt");
			return true;
		},
	});
}

async function runCommand(
	plugin: Mikansei,
	editor: Editor,
	section: SectionCache,
	operation: Operation
): Promise<void> {
	const data = await openCryptoDialog(plugin.app, operation);
	// 用户取消（关闭对话框）时不执行任何操作
	if (!data) return;
	await executeCodeBlockCommand(editor, section, operation, data);
}

/**
 * 辅助函数：查找当前光标所在位置的加密代码块
 */
function findCryptoCodeBlock(
	plugin: Mikansei,
	editor: Editor,
	view: MarkdownView
): SectionCache | null {
	// view.file 应该存在，因为我们已经检查了 view 是 MarkdownView 的实例
	const fileCache = plugin.app.metadataCache.getFileCache(
		view.file as TFile
	);
	if (!fileCache || !fileCache.sections) {
		return null;
	}

	// 获取自定义的语言名称
	const langName = plugin.settings.cryptoBlockLanguage || "nya";
	// 构造动态正则表达式，转义特殊字符
	const escapedLang = langName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const codeBlockPattern = new RegExp(`^\\s*\`\`\`\\s*${escapedLang}(\\s.*)?`);

	const cursor = editor.getCursor();
	for (const section of fileCache.sections) {
		if (
			section.type === "code" &&
			cursor.line >= section.position.start.line &&
			cursor.line <= section.position.end.line
		) {
			const firstLineText = editor.getLine(section.position.start.line);
			if (codeBlockPattern.test(firstLineText)) {
				// 确保是标准的多行代码块结构，以便内容提取逻辑正确
				if (
					section.position.start.line < section.position.end.line
				) {
					return section;
				}
			}
		}
	}
	return null;
}

/**
 * 辅助函数：处理代码块的加解密操作
 */
async function executeCodeBlockCommand(
	editor: Editor,
	section: SectionCache,
	operation: Operation,
	{ password, remarks, language }: CryptoConfirmData
): Promise<void> {
	const contentStartLine = section.position.start.line + 1;
	const contentEndLine = section.position.end.line - 1;

	let fromPos: EditorPosition | null = null;
	let toPos: EditorPosition | null = null;
	let currentContent = "";

	if (contentStartLine <= contentEndLine) {
		fromPos = { line: contentStartLine, ch: 0 };
		toPos = {
			line: contentEndLine,
			ch: editor.getLine(contentEndLine).length,
		};
		currentContent = editor.getRange(fromPos, toPos);
	}

	if (!fromPos || !toPos) {
		// 也捕获了 contentStartLine > contentEndLine 的空块情况
		new Notice(i18n.t("crypto.notice.emptyBlock"));
		return;
	}

	// 检查内容状态
	const isEncrypted = isEncryptedContent(currentContent);
	if (operation === "decrypt") {
		if (!isEncrypted) {
			new Notice(i18n.t("crypto.notice.notEncrypted"), 4000);
			return;
		}
	} else if (operation === "encrypt") {
		if (isEncrypted) {
			new Notice(i18n.t("crypto.notice.alreadyEncrypted"), 4000);
			return;
		}
	}

	// 获取密码
	if (password === null) {
		new Notice(i18n.t("crypto.notice.cancelled"));
		return;
	}
	if (password.trim() === "") {
		new Notice(i18n.t("crypto.notice.passwordEmpty"));
		return;
	}

	try {
		let newContent: string;
		if (operation === "encrypt") {
			const loadingNotice = new Notice(i18n.t("crypto.notice.encrypting"), 0);
			try {
				const encryptedObj = await encryptAesGcm(
					currentContent,
					password,
					remarks,
					language
				);
				newContent = stringToBase64(JSON.stringify(encryptedObj));
				editor.replaceRange(newContent, fromPos, toPos);
				loadingNotice.hide();
				new Notice(i18n.t("crypto.notice.encryptSuccess"), 3000);
			} catch (err) {
				loadingNotice.hide();
				throw err;
			}
		} else {
			// decrypt
			if (currentContent.trim() === "") {
				new Notice(i18n.t("crypto.notice.decryptEmpty"));
				return;
			}

			const loadingNotice = new Notice(i18n.t("crypto.notice.decrypting"), 0);
			try {
				const decryptedResult = await decryptAesGcm(
					currentContent,
					password
				);
				if (typeof decryptedResult?.text !== "string") {
					throw new Error(
						i18n.t("crypto.error.unexpectedDecryptResult")
					);
				}
				newContent = decryptedResult.text;
				editor.replaceRange(newContent, fromPos, toPos);
				loadingNotice.hide();
				new Notice(i18n.t("crypto.notice.decryptSuccess"), 3000);
			} catch (err) {
				loadingNotice.hide();
				throw err;
			}
		}
	} catch (e: unknown) {
		const error = e instanceof Error ? e : new Error(String(e));
		console.error(`加密代码块 ${operation} 操作失败:`, error);

		// 根据错误类型提供更友好的提示
		let errorMessage = "";
		const errorMsg = error.message.toLowerCase();

		if (operation === "decrypt") {
			if (errorMsg.includes("invalid") || errorMsg.includes("格式")) {
				errorMessage = i18n.t("crypto.notice.decryptFailedBadFormat");
			} else if (
				errorMsg.includes("decrypt") ||
				errorMsg.includes("解密") ||
				errorMsg.includes("password")
			) {
				errorMessage = i18n.t(
					"crypto.notice.decryptFailedWrongPassword"
				);
			} else if (errorMsg.includes("base64")) {
				errorMessage = i18n.t("crypto.notice.decryptFailedEncoding");
			} else if (errorMsg.includes("json") || errorMsg.includes("parse")) {
				errorMessage = i18n.t("crypto.notice.decryptFailedStructure");
			} else {
				errorMessage = i18n.t("crypto.notice.decryptFailedGeneric", {
					message: error.message,
				});
			}
		} else {
			// encrypt
			if (errorMsg.includes("password") || errorMsg.includes("密码")) {
				errorMessage = i18n.t("crypto.notice.encryptFailedPassword");
			} else if (
				errorMsg.includes("memory") ||
				errorMsg.includes("内存")
			) {
				errorMessage = i18n.t("crypto.notice.encryptFailedTooLarge");
			} else {
				errorMessage = i18n.t("crypto.notice.encryptFailedGeneric", {
					message: error.message,
				});
			}
		}

		new Notice(errorMessage, 5000);
	}
}
