import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
	ResetDefaultsItem,
	SettingHeading,
	SettingItem,
	Toggle,
} from "../components/SettingControls";
import type { TabProps } from "../tabProps";

export function CryptoTab({ settings, update, reset }: TabProps) {
	const { t } = useTranslation();
	const [languageDraft, setLanguageDraft] = useState(
		settings.cryptoBlockLanguage
	);
	const [languageInvalid, setLanguageInvalid] = useState(false);

	const handleCryptoLanguageChange = (value: string) => {
		setLanguageDraft(value);
		const trimmed = value.trim();
		if (trimmed === "" || /\s/.test(trimmed)) {
			setLanguageInvalid(true);
			return;
		}
		setLanguageInvalid(false);
		update({ cryptoBlockLanguage: trimmed });
	};

	return (
		<>
			<SettingHeading
				name={t("settings.crypto.heading")}
				desc={t("settings.crypto.desc")}
			>
				<Toggle
					value={settings.cryptoBlockEnabled}
					onChange={(v) => update({ cryptoBlockEnabled: v })}
				/>
			</SettingHeading>

			{settings.cryptoBlockEnabled && (
				<>
					<SettingItem
						name={t("settings.cryptoLanguage.name")}
						desc={t("settings.cryptoLanguage.desc")}
					>
						<input
							type="text"
							placeholder="nya"
							value={languageDraft}
							className={languageInvalid ? "is-invalid" : ""}
							onChange={(e) =>
								handleCryptoLanguageChange(e.target.value)
							}
						/>
					</SettingItem>
					<SettingItem
						name={t("settings.cryptoHeight.name")}
						desc={t("settings.cryptoHeight.desc")}
					>
						<input
							type="number"
							value={settings.cryptoBlockHeight}
							onChange={(e) => {
								const val = parseInt(e.target.value, 10);
								if (!isNaN(val) && val > 0) {
									update({
										cryptoBlockHeight: Math.max(
											50,
											Math.min(1000, val)
										),
									});
								}
							}}
						/>
					</SettingItem>
				</>
			)}
			<ResetDefaultsItem
				name={t("settings.reset.tabName")}
				desc={t("settings.reset.tabDesc")}
				buttonText={t("settings.reset.button")}
				onReset={reset}
			/>
		</>
	);
}
