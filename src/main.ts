import { App, Plugin, PluginSettingTab, Setting, Editor, MarkdownView } from "obsidian";
import { matchBrackets } from "@codemirror/language";
import { highlightBracket, latestMatch } from "./extension/HightlightBracketMatching";
import { enhanceLinkPaste } from "./event/LinkPasteEnhancer";
import { codeBlockCrypto } from "./extension/CodeBlockCrypto";

interface PluginSettings {
	linkPasteEnhancer: boolean;
	fetchTitle: boolean;
	fetchTitleTimeout: number;
	cryptoBlockEnabled: boolean;
	cryptoBlockLanguage: string;
	cryptoBlockHeight: number;
	bracketMatchingEnabled: boolean;
}

const DEFAULT_SETTINGS: PluginSettings = {
	linkPasteEnhancer: true,
	fetchTitle: true,
	fetchTitleTimeout: 1000,
	cryptoBlockEnabled: true,
	cryptoBlockLanguage: "nya",
	cryptoBlockHeight: 300,
	bracketMatchingEnabled: true,
};

export default class Mikansei extends Plugin {
	settings!: PluginSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new MikanseiSettingTab(this.app, this));

		if (this.settings.bracketMatchingEnabled) {
			this.registerEditorExtension([highlightBracket()]);

			this.addCommand({
				id: "nya-bracket-jump",
				name: "Jump to bracket(跳转到匹配符号)",
				icon: "braces",
				editorCheckCallback: (checking, editor, view) => {
					if (!(view instanceof MarkdownView)) return false;

					if (!latestMatch) return false;

					const { start, end } = latestMatch;
					const offset = editor.posToOffset(editor.getCursor("from"));

					const displayFlag =
						(start.from <= offset && start.to >= offset) ||
						(end.from <= offset && end.to >= offset);

					if (displayFlag) {
						if (!checking) {
							editor.setCursor(editor.offsetToPos(end.to));
						}
						return true;
					}

					return false;
				},
			});

			this.addCommand({
				id: "nya-bracket-select",
				name: "Select to bracket(选择到匹配符号)",
				icon: "braces",
				editorCheckCallback: (checking, editor, view) => {
					if (!(view instanceof MarkdownView)) return false;

					if (!latestMatch) return false;

					const { start, end } = latestMatch;
					const offset = editor.posToOffset(editor.getCursor("from"));

					const displayFlag =
						(start.from <= offset && start.to >= offset) ||
						(end.from <= offset && end.to >= offset);

					if (displayFlag) {
						if (!checking) {
							const isEnd = start.to > end.to;

							editor.setSelection(
								editor.offsetToPos(
									isEnd ? start.to : start.from
								),
								editor.offsetToPos(
									isEnd ? end.from : end.to
								)
							);
						}
						return true;
					}

					return false;
				},
			});
		}

		if (this.settings.linkPasteEnhancer) {
			enhanceLinkPaste(this);
		}
		if (this.settings.cryptoBlockEnabled) {
			codeBlockCrypto(this);
		}
	}

	onunload() { }

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class MikanseiSettingTab extends PluginSettingTab {
	plugin: Mikansei;

	constructor(app: App, plugin: Mikansei) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const pluginSetting = this.plugin.settings;

		// Link Paste Enhancer Group
		new Setting(containerEl)
			.setHeading()
			.setName("链接粘贴增强 (Link Paste Enhancer)")
			.setDesc("启用后,粘贴链接时会弹出选项")
			.addToggle((cb) => {
				cb.setValue(pluginSetting.linkPasteEnhancer).onChange(
					async (value: boolean) => {
						pluginSetting.linkPasteEnhancer = value;
						await this.plugin.saveSettings();
						this.display(); // Refresh to show/hide sub-settings
					}
				);
			});

		if (pluginSetting.linkPasteEnhancer) {
			new Setting(containerEl)
				.setName("获取网页标题")
				.setDesc("启用后,将会获取URL的title作为标题")
				.addToggle((cb) => {
					cb.setValue(pluginSetting.fetchTitle).onChange(
						async (value: boolean) => {
							pluginSetting.fetchTitle = value;
							await this.plugin.saveSettings();
						}
					);
				});
			new Setting(containerEl)
				.setName("获取网页标题超时时间(毫秒)")
				.setDesc("超过此时间后直接使用默认标题")
				.addText((cb) => {
					cb.inputEl.type = "number";
					cb.inputEl.min = "0";
					cb.inputEl.max = "10000";
					cb.inputEl.step = "100";

					cb.setValue(String(pluginSetting.fetchTitleTimeout)).onChange(
						async (value: string) => {
							pluginSetting.fetchTitleTimeout =
								parseInt(value, 10) ||
								DEFAULT_SETTINGS.fetchTitleTimeout;
							await this.plugin.saveSettings();
						}
					);
				});
		}

		// Bracket Matching Group
		new Setting(containerEl)
			.setHeading()
			.setName("括号匹配高亮 (Bracket Matching)")
			.setDesc("启用后,高亮匹配的括号并提供跳转/选择命令")
			.addToggle((cb) => {
				cb.setValue(pluginSetting.bracketMatchingEnabled).onChange(
					async (value: boolean) => {
						pluginSetting.bracketMatchingEnabled = value;
						await this.plugin.saveSettings();
						// this.display(); // No sub-settings to show/hide, but maybe useful if we add more later
					}
				);
			});

		// Crypto Block Group
		new Setting(containerEl)
			.setHeading()
			.setName("加密代码块 (Crypto Code Block)")
			.setDesc("启用后,支持渲染加密的代码块")
			.addToggle((cb) => {
				cb.setValue(pluginSetting.cryptoBlockEnabled).onChange(
					async (value: boolean) => {
						pluginSetting.cryptoBlockEnabled = value;
						await this.plugin.saveSettings();
						this.display(); // Refresh to show/hide sub-settings
					}
				);
			});

		if (pluginSetting.cryptoBlockEnabled) {
			new Setting(containerEl)
				.setName("加密代码块语言名称")
				.setDesc(
					"自定义加密代码块的语言标识符（如 ```nya）。修改后需要重新加载插件才能生效。"
				)
				.addText((cb) => {
					cb.setPlaceholder("nya")
						.setValue(pluginSetting.cryptoBlockLanguage)
						.onChange(async (value: string) => {
							// 验证：不能为空，不能包含空白字符
							const trimmed = value.trim();
							if (trimmed === "") {
								cb.inputEl.addClass("is-invalid");
								return;
							}
							if (/\s/.test(trimmed)) {
								cb.inputEl.addClass("is-invalid");
								return;
							}
							cb.inputEl.removeClass("is-invalid");
							pluginSetting.cryptoBlockLanguage = trimmed;
							await this.plugin.saveSettings();
						});
				});
			new Setting(containerEl)
				.setName("预览详情最大高度 (px)")
				.setDesc("设置解密内容预览区域的最大高度，默认 300px")
				.addText((cb) => {
					const minSize = 50
					const maxSize = 1000
					cb.inputEl.type = "number";
					cb.setValue(String(pluginSetting.cryptoBlockHeight)).onChange(
						async (value: string) => {
							const val = parseInt(value, 10);
							if (!isNaN(val) && val > 0) {
								pluginSetting.cryptoBlockHeight = Math.max(minSize, Math.min(maxSize, val));
								await this.plugin.saveSettings();
							}
						}
					);
				});
		}

		// Quick Restart Button
		new Setting(containerEl)
			.setName("重载 Obsidian")
			.setDesc("重新加载Obsidian以生效一些设置")
			.addButton((cb) => {
				cb.setButtonText("重载")
					.onClick(() => {
						// @ts-ignore
						this.app.commands.executeCommandById("app:reload");
					}).setWarning()
			});
	}
}
