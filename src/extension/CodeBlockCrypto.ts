import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	TFile,
	type EditorPosition,
	type SectionCache,
} from "obsidian";
import type Mikansei from "src/main";
import CryptoCodeBlock from "src/svelte/CryptoCodeBlock.svelte";
import DecryptConfirmForm from "src/svelte/DecryptConfirmForm.svelte";
import EncryptConfirmForm from "src/svelte/EncryptConfirmForm.svelte";
import {
	decryptAesGcm,
	encryptAesGcm,
	stringToBase64,
	isEncryptedContent,
} from "src/utils/crypto-util";
import { mount, unmount, type Component } from "svelte";

const activeComponents: Map<
	HTMLElement,
	ReturnType<typeof CryptoCodeBlock>
> = new Map();

export const codeBlockCrypto = (plugin: Mikansei) => {
	// 获取自定义的语言名称
	const langName = plugin.settings.cryptoBlockLanguage || "usagi";

	// 注册代码块
	plugin.registerMarkdownCodeBlockProcessor(langName, (source, el, ctx) => {
		const componentCache = activeComponents.get(el);
		if (componentCache) {
			unmount(componentCache);
			activeComponents.delete(el);
		}
		el.empty();

		const component = mount(CryptoCodeBlock, {
			target: el,
			props: {
				source: source,
				el: el,
				ctx: ctx,
				plugin: plugin,
			}
		})
		activeComponents.set(el, component);
	});
	// 注册命令
	plugin.addCommand({
		id: "nya-crypto-encrypt",
		name: "Encrypt(加密代码块)",
		editorCheckCallback(checking, editor, view) {
			// 1. 首先确保我们处于 MarkdownView 上下文
			if (!(view instanceof MarkdownView)) {
				// 此命令仅在 Markdown 编辑器视图中可用
				return false;
			}
			// 此后，可以安全地将 view 视为 MarkdownView
			const section = findCryptoCodeBlock(editor, view);
			if (!section) {
				return false; // 不在代码块内
			}
			if (checking) {
				return true; // 命令可用
			}

			// 获取密码
			const dialog = new ConfirmCryptoDialog(
				plugin.app,
				"encrypt",
				(data) => {
					excuteCodeBlockCommand(editor, section, "encrypt", () =>
						Promise.resolve(data)
					);
				}
			);
			dialog.open();
		},
	});
	plugin.addCommand({
		id: "nya-crypto-decrypt",
		name: "Decrypt(解密代码块)",
		editorCheckCallback(checking, editor, view) {
			if (!(view instanceof MarkdownView)) {
				return false;
			}
			const section = findCryptoCodeBlock(editor, view);
			if (!section) {
				return false;
			}
			if (checking) {
				return true;
			}
			// 获取密码
			const dialog = new ConfirmCryptoDialog(
				plugin.app,
				"decrypt",
				(data) => {
					excuteCodeBlockCommand(editor, section, "decrypt", () =>
						Promise.resolve(data)
					);
				}
			);
			dialog.open();
		},
	});

	/**
	 * 辅助函数：查找当前光标所在位置的加密代码块
	 */
	function findCryptoCodeBlock(
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
		const langName = plugin.settings.cryptoBlockLanguage || "usagi";
		// 构造动态正则表达式，转义特殊字符
		const escapedLang = langName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const codeBlockPattern = new RegExp(`^\\s*\`\`\`\\s*${escapedLang}(\\s.*)?`);

		const cursor = editor.getCursor();
		for (const section of fileCache.sections) {
			if (
				section.type === "code" &&
				cursor.line >= section.position.start.line &&
				cursor.line <= section.position.end.line
			) {
				const firstLineText = editor.getLine(
					section.position.start.line
				);
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
	async function excuteCodeBlockCommand(
		editor: Editor,
		section: SectionCache,
		operation: "encrypt" | "decrypt",
		dataProvider: () => Promise<CryptoConfirmData>
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
			new Notice("加密代码块为空或无效，无法操作");
			return;
		}

		// 仅在解密时检查内容状态
		if (operation === "decrypt") {
			const isEncrypted = isEncryptedContent(currentContent);
			if (!isEncrypted) {
				new Notice(
					"⚠️ 此代码块未加密，无需解密\n提示：只有已加密的内容才能解密",
					4000
				);
				return;
			}
		}

		const { password, remarks } = await dataProvider(); // 获取密码
		if (password === null) {
			new Notice("操作已取消");
			return;
		}
		if (password.trim() === "") {
			new Notice("❌ 密码不能为空");
			return;
		}

		try {
			let newContent: string;
			if (operation === "encrypt") {
				const loadingNotice = new Notice("🔐 正在加密...", 0);
				try {
					const encryptedObj = await encryptAesGcm(
						currentContent,
						password,
						remarks
					);
					newContent = stringToBase64(JSON.stringify(encryptedObj));
					editor.replaceRange(newContent, fromPos, toPos);
					loadingNotice.hide();
					new Notice("✅ 加密成功", 3000);
				} catch (err) {
					loadingNotice.hide();
					throw err;
				}
			} else {
				// decrypt
				if (currentContent.trim() === "") {
					new Notice("⚠️ 加密代码块内容为空，无需解密");
					return;
				}

				const loadingNotice = new Notice("🔓 正在解密...", 0);
				try {
					const decryptedResult = await decryptAesGcm(
						currentContent,
						password
					);
					if (typeof decryptedResult?.text !== "string") {
						throw new Error("解密函数未返回预期的文本格式");
					}
					newContent = decryptedResult.text;
					editor.replaceRange(newContent, fromPos, toPos);
					loadingNotice.hide();
					new Notice("✅ 解密成功", 3000);
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
					errorMessage = "❌ 解密失败：数据格式不正确，可能已损坏";
				} else if (errorMsg.includes("decrypt") || errorMsg.includes("解密") || errorMsg.includes("password")) {
					errorMessage = "❌ 解密失败：密码错误或数据已损坏";
				} else if (errorMsg.includes("base64")) {
					errorMessage = "❌ 解密失败：数据编码错误";
				} else if (errorMsg.includes("json") || errorMsg.includes("parse")) {
					errorMessage = "❌ 解密失败：数据结构损坏";
				} else {
					errorMessage = `❌ 解密失败：${error.message}`;
				}
			} else {
				// encrypt
				if (errorMsg.includes("password") || errorMsg.includes("密码")) {
					errorMessage = "❌ 加密失败：密码处理出错";
				} else if (errorMsg.includes("memory") || errorMsg.includes("内存")) {
					errorMessage = "❌ 加密失败：内容过大";
				} else {
					errorMessage = `❌ 加密失败：${error.message}`;
				}
			}

			new Notice(errorMessage, 5000);
		}
	}
};

class ConfirmCryptoDialog extends Modal {
	form: ReturnType<Component> | null = null;
	onSubmit: (data: CryptoConfirmData) => void;
	type: "encrypt" | "decrypt";
	constructor(
		app: App,
		type: "encrypt" | "decrypt",
		onSubmit: (data: CryptoConfirmData) => void
	) {
		super(app);
		this.type = type;
		this.onSubmit = onSubmit;
	}
	onOpen(): void {
		const type = this.type;
		if (type == "encrypt") {
			this.form = mount(EncryptConfirmForm, {
				target: this.contentEl,
				props: {
					submitHandler: (data: CryptoConfirmData) => {
						this.onSubmit(data);
						this.close();
					},
				},
			});
		} else if (type == "decrypt") {
			this.form = mount(DecryptConfirmForm, {
				target: this.contentEl,
				props: {
					submitHandler: (data: CryptoConfirmData) => {
						this.onSubmit(data);
						this.close();
					},
				},
			});
		}
	}

	onClose(): void {
		if (this.form) {
			unmount(this.form);
			this.form = null;
		}
		this.contentEl.empty();
	}
}

export interface CryptoConfirmData {
	password: string;
	remarks: string;
}