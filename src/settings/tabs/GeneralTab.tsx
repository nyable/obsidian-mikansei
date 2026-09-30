import { useTranslation } from "react-i18next";
import { Notice } from "obsidian";
import { i18n, resolveLocale } from "src/i18n";
import {
	ResetDefaultsItem,
	SettingHeading,
	SettingItem,
} from "../components/SettingControls";
import type { TabProps } from "../tabProps";
import type { LanguageSetting } from "../types";

export function GeneralTab({ settings, update, reset }: TabProps) {
	const { t } = useTranslation();

	const handleLanguageChange = async (value: LanguageSetting) => {
		update({ language: value });
		await i18n.changeLanguage(resolveLocale(value));
		new Notice(i18n.t("settings.languageChanged"));
	};

	return (
		<>
			<SettingHeading name={t("settings.general.heading")} />
			<SettingItem
				name={t("settings.general.language.name")}
				desc={t("settings.general.language.desc")}
			>
				<select
					className="dropdown"
					value={settings.language}
					onChange={(e) =>
						handleLanguageChange(e.target.value as LanguageSetting)
					}
				>
					<option value="auto">
						{t("settings.general.language.auto")}
					</option>
					<option value="zh-CN">
						{t("settings.general.language.zhCN")}
					</option>
					<option value="en">
						{t("settings.general.language.en")}
					</option>
				</select>
			</SettingItem>
			<ResetDefaultsItem
				name={t("settings.reset.tabName")}
				desc={t("settings.reset.tabDesc")}
				buttonText={t("settings.reset.button")}
				onReset={reset}
			/>
		</>
	);
}
