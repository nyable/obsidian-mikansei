import { useTranslation } from "react-i18next";
import { ResetDefaultsItem, SettingItem } from "../components/SettingControls";
import type { TabProps } from "../tabProps";

export function MiscTab({ plugin, reset }: TabProps) {
	const { t } = useTranslation();

	return (
		<>
			<SettingItem
				name={t("settings.reload.name")}
				desc={t("settings.reload.desc")}
			>
				<button
					className="mod-warning"
					onClick={() => {
						// @ts-ignore - app.commands 未包含在公开类型中
						plugin.app.commands.executeCommandById("app:reload");
					}}
				>
					{t("settings.reload.button")}
				</button>
			</SettingItem>

			<ResetDefaultsItem
				name={t("settings.reset.allName")}
				desc={t("settings.reset.allDesc")}
				buttonText={t("settings.reset.button")}
				onReset={reset}
			/>
		</>
	);
}
