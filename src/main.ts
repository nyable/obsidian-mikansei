import { MarkdownView, Plugin } from "obsidian";
import type { Extension } from "@codemirror/state";
import { highlightBracket, applyBracketStyles, clearBracketStyles } from "./features/bracket-matching/bracketMatching";
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
	private readonly editorExtensions: Extension[] = [];
	private appliedSettings: PluginSettings | null = null;
	private disposeCrypto: (() => void) | null = null;
	private settingsWrites: Promise<void> = Promise.resolve();

	async onload() {
		await this.loadSettings();
		await initI18n(this.settings.language);
		this.addSettingTab(new MikanseiSettingTab(this.app, this));
		this.registerEditorExtension(this.editorExtensions);
		registerBracketCommands(this);
		enhanceLinkPaste(this);
		registerCryptoCommands(this);
		this.register(() => { this.disposeCrypto?.(); this.disposeCrypto = null; clearBracketStyles(); });
		this.applySettings();
	}

	/** Reconfigure only registrations affected by the changed settings. */
	applySettings(): void {
		const previous = this.appliedSettings;
		applyBracketStyles(this.settings);
		const bracketChanged = !previous || previous.bracketMatchingEnabled !== this.settings.bracketMatchingEnabled ||
			previous.highlightUnmatchedBrackets !== this.settings.highlightUnmatchedBrackets;
		const cryptoChanged = !previous || previous.cryptoBlockEnabled !== this.settings.cryptoBlockEnabled ||
			previous.cryptoBlockLanguage !== this.settings.cryptoBlockLanguage;
		if (bracketChanged) {
			this.editorExtensions.length = 0;
			if (this.settings.bracketMatchingEnabled) this.editorExtensions.push(highlightBracket(this));
		}
		if (cryptoChanged) {
			this.disposeCrypto?.();
			this.disposeCrypto = this.settings.cryptoBlockEnabled ? codeBlockCrypto(this) : null;
		}
		this.appliedSettings = { ...this.settings };
		if (bracketChanged || cryptoChanged) this.app.workspace.updateOptions();
		if (previous && cryptoChanged) {
			for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
				if (leaf.view instanceof MarkdownView) leaf.view.previewMode.rerender(true);
			}
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
		if (!Number.isInteger(this.settings.cryptoAutoLockMinutes) || this.settings.cryptoAutoLockMinutes < 0 || this.settings.cryptoAutoLockMinutes > 120) {
			this.settings.cryptoAutoLockMinutes = DEFAULT_SETTINGS.cryptoAutoLockMinutes;
		}
		if (!Number.isInteger(this.settings.fetchTitleTimeout) || this.settings.fetchTitleTimeout < 0 || this.settings.fetchTitleTimeout > 10000) {
			this.settings.fetchTitleTimeout = DEFAULT_SETTINGS.fetchTitleTimeout;
		}
		if (typeof this.settings.cryptoBlockLanguage !== "string" || !/^[\w-]{1,40}$/.test(this.settings.cryptoBlockLanguage)) {
			this.settings.cryptoBlockLanguage = DEFAULT_SETTINGS.cryptoBlockLanguage;
		}
	}

	async saveSettings() {
		const snapshot = { ...this.settings };
		// Serialize saves so slower earlier writes cannot overwrite newer settings.
		const write = this.settingsWrites.then(() => this.saveData(snapshot));
		this.settingsWrites = write.catch(() => {});
		await write;
	}
}
