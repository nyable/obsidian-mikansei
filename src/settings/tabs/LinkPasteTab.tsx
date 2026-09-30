import { useTranslation } from "react-i18next";
import {
	ResetDefaultsItem,
	SettingHeading,
	SettingItem,
	Toggle,
} from "../components/SettingControls";
import type { TabProps } from "../tabProps";
import { DEFAULT_SETTINGS } from "../types";

export function LinkPasteTab({ settings, update, reset }: TabProps) {
	const { t } = useTranslation();

	return (
		<>
			<SettingHeading
				name={t("settings.linkPaste.heading")}
				desc={t("settings.linkPaste.desc")}
			>
				<Toggle
					value={settings.linkPasteEnhancer}
					onChange={(v) => update({ linkPasteEnhancer: v })}
				/>
			</SettingHeading>

			{settings.linkPasteEnhancer && (
				<>
					<SettingItem
						name={t("settings.fetchTitle.name")}
						desc={t("settings.fetchTitle.desc")}
					>
						<Toggle
							value={settings.fetchTitle}
							onChange={(v) => update({ fetchTitle: v })}
						/>
					</SettingItem>
					<SettingItem
						name={t("settings.fetchTimeout.name")}
						desc={t("settings.fetchTimeout.desc")}
					>
						<input
							type="number"
							min={0}
							max={10000}
							step={100}
							value={settings.fetchTitleTimeout}
							onChange={(e) => {
								update({
									fetchTitleTimeout:
										parseInt(e.target.value, 10) ||
										DEFAULT_SETTINGS.fetchTitleTimeout,
								});
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
