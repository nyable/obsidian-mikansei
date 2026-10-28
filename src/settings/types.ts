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

/** Validate the persistence boundary; TypeScript does not validate data.json. */
export function parseSettings(data: unknown): PluginSettings {
	const result = { ...DEFAULT_SETTINGS };
	if (!data || typeof data !== "object" || Array.isArray(data)) return result;
	const values = data as Record<string, unknown>;
	for (const key of ["linkPasteEnhancer", "fetchTitle", "cryptoBlockEnabled", "bracketMatchingEnabled", "highlightUnmatchedBrackets"] as const) {
		if (typeof values[key] === "boolean") result[key] = values[key];
	}
	for (const [key, min, max] of [["fetchTitleTimeout", 0, 10000], ["cryptoBlockHeight", 50, 1000], ["cryptoAutoLockMinutes", 0, 120]] as const) {
		const value = values[key];
		if (typeof value === "number" && Number.isInteger(value) && value >= min && value <= max) result[key] = value;
	}
	if (values.language === "auto" || values.language === "zh-CN" || values.language === "en") result.language = values.language;
	if (values.bracketStyle === "border" || values.bracketStyle === "underline" || values.bracketStyle === "background" || values.bracketStyle === "text") result.bracketStyle = values.bracketStyle;
	if (typeof values.cryptoBlockLanguage === "string" && /^[\w-]{1,40}$/.test(values.cryptoBlockLanguage)) result.cryptoBlockLanguage = values.cryptoBlockLanguage;
	for (const key of ["bracketMatchColor", "bracketMissColor"] as const) {
		if (typeof values[key] === "string" && /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(values[key])) result[key] = values[key];
	}
	return result;
}
