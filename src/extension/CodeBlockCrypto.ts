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
} from "src/utils/crypto-util";
import { mount, unmount, type Component } from "svelte";

const activeComponents: Map<
	HTMLElement,
	ReturnType<typeof CryptoCodeBlock>
> = new Map();

export const codeBlockCrypto = (plugin: Mikansei) => {
	// 注册代码块
	plugin.registerMarkdownCodeBlockProcessor("usagi", (source, el, ctx) => {
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
			},
		});
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
	 * 辅助函数：查找当前光标所在位置的 'jm' 代码块
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
				if (/^\s*```\s*usagi(\s.*)?/.test(firstLineText)) {
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
			new Notice("JM 代码块为空或无效，无法操作。");
			return;
		}

		const { password, remarks } = await dataProvider(); // 获取密码
		if (password === null) {
			new Notice("操作已取消。");
			return;
		}
		if (password.trim() === "") {
			new Notice("密码不能为空。");
			return;
		}

		try {
			let newContent: string;
			if (operation === "encrypt") {
				new Notice("JM Block: 加密中...");
				const encryptedObj = await encryptAesGcm(
					currentContent,
					password,
					remarks
				);
				newContent = stringToBase64(JSON.stringify(encryptedObj));
				editor.replaceRange(newContent, fromPos, toPos);
				new Notice("JM 代码块已加密。");
			} else {
				// decrypt
				if (currentContent.trim() === "") {
					new Notice("JM 代码块内容为空，无需解密。");
					return;
				}
				new Notice("JM Block: 解密中...");
				const decryptedResult = await decryptAesGcm(
					currentContent,
					password
				); // 假设此函数处理base64和JSON
				if (typeof decryptedResult?.text !== "string") {
					throw new Error("解密函数未返回预期的文本格式。");
				}
				newContent = decryptedResult.text;
				editor.replaceRange(newContent, fromPos, toPos);
				new Notice("JM 代码块已解密。");
			}
		} catch (e: unknown) {
			const error = e instanceof Error ? e : new Error(String(e));
			console.error(`JM Block ${operation} failed:`, error);
			new Notice(
				`${operation === "encrypt" ? "加密" : "解密"}失败: ${
					error.message
				}`
			);
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
