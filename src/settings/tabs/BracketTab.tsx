import { useTranslation } from "react-i18next";
import { ColorInput } from "../components/ColorInput";
import {
	ResetDefaultsItem,
	SettingHeading,
	SettingItem,
	Toggle,
} from "../components/SettingControls";
import type { TabProps } from "../tabProps";
import type { BracketStyle } from "../types";

const STYLE_OPTIONS = [
	{ value: "border", key: "settings.bracketStyle.border" },
	{ value: "underline", key: "settings.bracketStyle.underline" },
	{ value: "background", key: "settings.bracketStyle.background" },
	{ value: "text", key: "settings.bracketStyle.text" },
] as const;

export function BracketTab({ settings, update, reset }: TabProps) {
	const { t } = useTranslation();

	return (
		<>
			<SettingHeading
				name={t("settings.bracket.heading")}
				desc={t("settings.bracket.desc")}
			>
				<Toggle
					value={settings.bracketMatchingEnabled}
					onChange={(v) => update({ bracketMatchingEnabled: v })}
				/>
			</SettingHeading>

			{settings.bracketMatchingEnabled && (
				<>
					<SettingItem
						name={t("settings.bracketStyle.name")}
						desc={t("settings.bracketStyle.desc")}
					>
						<select
							className="dropdown"
							value={settings.bracketStyle}
							onChange={(e) =>
								update({
									bracketStyle: e.target.value as BracketStyle,
								})
							}
						>
							{STYLE_OPTIONS.map((option) => (
								<option key={option.value} value={option.value}>
									{t(option.key)}
								</option>
							))}
						</select>
					</SettingItem>

					<ColorInput
						name={t("settings.bracketMatchColor.name")}
						desc={t("settings.bracketMatchColor.desc")}
						value={settings.bracketMatchColor}
						onChange={(v) => update({ bracketMatchColor: v })}
						ariaLabel={t("settings.color.open")}
					/>

					<ColorInput
						name={t("settings.bracketMissColor.name")}
						desc={t("settings.bracketMissColor.desc")}
						value={settings.bracketMissColor}
						onChange={(v) => update({ bracketMissColor: v })}
						ariaLabel={t("settings.color.open")}
					/>

					<SettingItem
						name={t("settings.bracketHighlightUnmatched.name")}
						desc={t("settings.bracketHighlightUnmatched.desc")}
					>
						<Toggle
							value={settings.highlightUnmatchedBrackets}
							onChange={(v) =>
								update({ highlightUnmatchedBrackets: v })
							}
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
