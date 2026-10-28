import { useTranslation } from "react-i18next";
import {
	ResetDefaultsItem,
	SettingHeading,
	SettingItem,
	Toggle,
} from "../components/SettingControls";
import type { TabProps } from "../tabProps";
import { useDebouncedDraft } from "../components/useDebouncedDraft";

const validTimeout = (value: string) => {
	const number = Number(value);
	return value.trim() && Number.isInteger(number) && number >= 0 && number <= 10000 ? String(number) : null;
};

export function LinkPasteTab({ settings, update, reset }: TabProps) {
	const { t } = useTranslation();
	const timeout = useDebouncedDraft(String(settings.fetchTitleTimeout), validTimeout,
		(value) => update({ fetchTitleTimeout: Number(value) }));

	return (
		<>
			<SettingHeading
				name={t("settings.linkPaste.heading")}
				desc={t("settings.linkPaste.desc")}
			>
				<Toggle
					label={t("settings.linkPaste.heading")}
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
							label={t("settings.fetchTitle.name")}
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
							value={timeout.draft}
							aria-label={t("settings.fetchTimeout.name")}
							aria-invalid={timeout.invalid}
							onChange={(e) => timeout.change(e.target.value)}
							onBlur={timeout.flush}
						/>
					</SettingItem>
				</>
			)}
			<ResetDefaultsItem
				name={t("settings.reset.tabName")}
				desc={t("settings.reset.tabDesc")}
				buttonText={t("settings.reset.button")}
				onReset={() => { timeout.flush(); reset(); }}
			/>
		</>
	);
}
