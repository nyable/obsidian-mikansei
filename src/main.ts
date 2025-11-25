import { App, Plugin, PluginSettingTab, Setting, Editor, MarkdownView } from "obsidian";
import { matchBrackets } from "@codemirror/language";
import { highlightBracket, latestMatch } from "./extension/HightlightBracketMatching";
import { enhanceLinkPaste } from "./event/LinkPasteEnhancer";
import { codeBlockCrypto } from "./extension/CodeBlockCrypto";

interface PluginSettings {
	linkPasteEnhancer: boolean;
	fetchTitle: boolean;
	fetchTitleTimeout: number;
}

const DEFAULT_SETTINGS: PluginSettings = {
	linkPasteEnhancer: true,
	fetchTitle: true,
	fetchTitleTimeout: 1000,
};

export default class Mikansei extends Plugin {
	settings!: PluginSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new MikanseiSettingTab(this.app, this));
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
		if (this.settings.linkPasteEnhancer) {
			enhanceLinkPaste(this);
		}
		codeBlockCrypto(this);
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
		new Setting(containerEl)
			.setName("是否启用链接粘贴增强")
			.setDesc("启用后,粘贴链接时会弹出选项")
			.addToggle((cb) => {
				cb.setValue(pluginSetting.linkPasteEnhancer).onChange(
					async (value: boolean) => {
						pluginSetting.linkPasteEnhancer = value;
						await this.plugin.saveSettings();
					}
				);
			});
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
}
