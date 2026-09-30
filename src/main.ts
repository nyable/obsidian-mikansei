import { Plugin } from "obsidian";
import { highlightBracket, applyBracketStyles } from "./features/bracket-matching/bracketMatching";
import { registerBracketCommands } from "./features/bracket-matching/bracketCommands";
import { enhanceLinkPaste } from "./features/link-paste/linkPasteEnhancer";
import { codeBlockCrypto } from "./features/crypto-block/codeBlockProcessor";
import { registerCryptoCommands } from "./features/crypto-block/cryptoCommands";
import { MikanseiSettingTab } from "./settings/SettingsTab";
import { DEFAULT_SETTINGS, type PluginSettings } from "./settings/types";
import { initI18n } from "./i18n";
import "./styles/index.scss";

export default class Mikansei extends Plugin {
	settings!: PluginSettings;

	async onload() {
		await this.loadSettings();
		await initI18n(this.settings.language);
		applyBracketStyles(this.settings);
		this.addSettingTab(new MikanseiSettingTab(this.app, this));

		if (this.settings.bracketMatchingEnabled) {
			this.registerEditorExtension([highlightBracket(this)]);

			registerBracketCommands(this);
		}

		if (this.settings.linkPasteEnhancer) {
			enhanceLinkPaste(this);
		}
		if (this.settings.cryptoBlockEnabled) {
			codeBlockCrypto(this);
			registerCryptoCommands(this);
		}
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
