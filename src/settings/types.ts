export type LanguageSetting = "auto" | "zh-CN" | "en";

export type BracketStyle = "border" | "underline" | "background" | "text";

export interface PluginSettings {
	language: LanguageSetting;
	linkPasteEnhancer: boolean;
	fetchTitle: boolean;
	fetchTitleTimeout: number;
	cryptoBlockEnabled: boolean;
	cryptoBlockLanguage: string;
	cryptoBlockHeight: number;
	cryptoAutoLockMinutes: number;
	bracketMatchingEnabled: boolean;
	bracketStyle: BracketStyle;
	bracketMatchColor: string;
	bracketMissColor: string;
	highlightUnmatchedBrackets: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	language: "auto",
	linkPasteEnhancer: true,
	fetchTitle: true,
	fetchTitleTimeout: 1000,
	cryptoBlockEnabled: true,
	cryptoBlockLanguage: "nya",
	cryptoBlockHeight: 300,
	cryptoAutoLockMinutes: 5,
	bracketMatchingEnabled: true,
	bracketStyle: "border",
	bracketMatchColor: "#808080",
	bracketMissColor: "#ff0000",
	highlightUnmatchedBrackets: true,
};
