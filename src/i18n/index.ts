import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import zhCN from "./locales/zh-CN";
import en from "./locales/en";

export const SUPPORTED_LANGUAGES: string[] = ["zh-CN", "en"];

/**
 * 读取 Obsidian 当前界面语言，并规范化为本项目支持的语言。
 * Obsidian 把界面语言存在 localStorage 的 "language" 键里。
 */
function detectObsidianLocale(): string {
	const raw =
		window.localStorage.getItem("language") ||
		window.navigator.language ||
		"en";
	return raw.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

/**
 * 把设置里的语言值解析为实际使用的语言。
 * "auto" 时跟随 Obsidian。
 */
export function resolveLocale(setting: string): string {
	if (setting === "zh-CN" || setting === "en") {
		return setting;
	}
	return detectObsidianLocale();
}

let initialized = false;

export async function initI18n(setting: string): Promise<void> {
	if (initialized) {
		await i18n.changeLanguage(resolveLocale(setting));
		return;
	}
	await i18n.use(initReactI18next).init({
		lng: resolveLocale(setting),
		fallbackLng: "en",
		supportedLngs: [...SUPPORTED_LANGUAGES],
		resources: {
			"zh-CN": { translation: zhCN },
			en: { translation: en },
		},
		interpolation: { escapeValue: false },
		react: { useSuspense: false },
	});
	initialized = true;
}

export { i18n };
