import { useId } from "react";
import { useTranslation } from "react-i18next";
import { ResetDefaultsItem, SettingHeading, SettingItem, Toggle } from "../components/SettingControls";
import { useDebouncedDraft } from "../components/useDebouncedDraft";
import type { TabProps } from "../tabProps";

const validIdentifier = (value: string) => /^[\w-]{1,40}$/.test(value.trim()) ? value.trim() : null;
const validNumber = (value: string, min: number, max: number) => {
	const number = Number(value);
	return value.trim() && Number.isInteger(number) && number >= min && number <= max ? String(number) : null;
};

export function CryptoTab({ settings, update, reset }: TabProps) {
	const { t } = useTranslation();
	const id = useId();
	const language = useDebouncedDraft(settings.cryptoBlockLanguage, validIdentifier,
		(value) => update({ cryptoBlockLanguage: value }));
	const height = useDebouncedDraft(String(settings.cryptoBlockHeight), (value) => validNumber(value, 50, 1000),
		(value) => update({ cryptoBlockHeight: Number(value) }));
	const timeout = useDebouncedDraft(String(settings.cryptoAutoLockMinutes), (value) => validNumber(value, 0, 120),
		(value) => update({ cryptoAutoLockMinutes: Number(value) }));

	return <>
		<SettingHeading name={t("settings.crypto.heading")} desc={t("settings.crypto.desc")}>
			<Toggle value={settings.cryptoBlockEnabled} onChange={(value) => update({ cryptoBlockEnabled: value })} />
		</SettingHeading>
		{settings.cryptoBlockEnabled && <>
			<SettingItem name={t("settings.cryptoLanguage.name")} desc={t("settings.cryptoLanguage.desc")}>
				<input type="text" value={language.draft} aria-label={t("settings.cryptoLanguage.name")}
					aria-invalid={language.invalid} aria-describedby={language.invalid ? `${id}-language-error` : undefined}
					className={language.invalid ? "is-invalid" : ""} onChange={(event) => language.change(event.target.value)} onBlur={language.flush} />
			</SettingItem>
			{language.invalid && <p id={`${id}-language-error`} className="crypto-error" role="alert">{t("crypto.ui.identifierInvalid")}</p>}
			<SettingItem name={t("settings.cryptoHeight.name")} desc={t("settings.cryptoHeight.desc")}>
				<input type="number" min={50} max={1000} step={1} value={height.draft} aria-label={t("settings.cryptoHeight.name")}
					aria-invalid={height.invalid} onChange={(event) => height.change(event.target.value)} onBlur={height.flush} />
			</SettingItem>
			<SettingItem name={t("settings.cryptoAutoLock.name")} desc={t("settings.cryptoAutoLock.desc")}>
				<input type="number" min={0} max={120} step={1} value={timeout.draft} aria-label={t("settings.cryptoAutoLock.name")}
					aria-invalid={timeout.invalid} onChange={(event) => timeout.change(event.target.value)} onBlur={timeout.flush} />
			</SettingItem>
		</>}
		<ResetDefaultsItem name={t("settings.reset.tabName")} desc={t("settings.reset.tabDesc")}
			buttonText={t("settings.reset.button")} onReset={() => {
				language.flush(); height.flush(); timeout.flush(); reset();
			}} />
	</>;
}
