import { Plugin } from "obsidian";
import { highlightBracket } from "./extension/HightlightBracketMatching";
import { enhanceLinkPaste } from "./event/LinkPasteEnhancer";

interface PluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: PluginSettings = {
	mySetting: "default",
};

export default class Mikansei extends Plugin {
	settings!: PluginSettings;

	async onload() {
		await this.loadSettings();
		this.registerEditorExtension([highlightBracket(this)]);
		enhanceLinkPaste(this);
	}

	onunload() {}

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
