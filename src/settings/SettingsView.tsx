import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Notice } from "obsidian";
import type Mikansei from "src/main";
import { i18n, resolveLocale } from "src/i18n";
import { confirmModal } from "src/shared/confirmModal";
import { applyBracketStyles } from "src/features/bracket-matching/bracketMatching";
import { DEFAULT_SETTINGS, type PluginSettings } from "./types";
import type { TabProps } from "./tabProps";
import { GeneralTab } from "./tabs/GeneralTab";
import { LinkPasteTab } from "./tabs/LinkPasteTab";
import { BracketTab } from "./tabs/BracketTab";
import { CryptoTab } from "./tabs/CryptoTab";
import { MiscTab } from "./tabs/MiscTab";

interface SettingsViewProps {
	plugin: Mikansei;
}

const TABS = [
	{ id: "general", label: "tabs.general" },
	{ id: "linkPaste", label: "tabs.linkPaste" },
	{ id: "bracket", label: "tabs.bracket" },
	{ id: "crypto", label: "tabs.crypto" },
	{ id: "misc", label: "tabs.misc" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// 每个 tab 覆盖的设置键，「其他」为全部键
const TAB_KEYS: Record<TabId, (keyof PluginSettings)[]> = {
	general: ["language"],
	linkPaste: ["linkPasteEnhancer", "fetchTitle", "fetchTitleTimeout"],
	bracket: [
		"bracketMatchingEnabled",
		"bracketStyle",
		"bracketMatchColor",
		"bracketMissColor",
		"highlightUnmatchedBrackets",
	],
	crypto: ["cryptoBlockEnabled", "cryptoBlockLanguage", "cryptoBlockHeight", "cryptoAutoLockMinutes"],
	misc: Object.keys(DEFAULT_SETTINGS) as (keyof PluginSettings)[],
};

// 同一会话内记住上次打开的 tab
let lastTab: TabId = "general";

export function SettingsView({ plugin }: SettingsViewProps) {
	const { t } = useTranslation();
	const [settings, setSettings] = useState<PluginSettings>(() => ({
		...plugin.settings,
	}));
	const [activeTab, setActiveTab] = useState<TabId>(lastTab);

	const selectTab = (id: TabId) => {
		lastTab = id;
		setActiveTab(id);
	};

	const update = (patch: Partial<PluginSettings>) => {
		// Draft flushes on tab unmount must merge with the latest committed settings.
		const next = { ...plugin.settings, ...patch };
		setSettings(next);
		Object.assign(plugin.settings, next);
		void plugin.saveSettings();
		applyBracketStyles(next);
	};

	const resetTab = async () => {
		const keys = TAB_KEYS[activeTab];
		const ok = await confirmModal(plugin.app, {
			title: i18n.t("settings.reset.confirmTitle"),
			message: i18n.t("settings.reset.confirmMessage"),
			confirmText: i18n.t("settings.reset.confirm"),
			cancelText: i18n.t("settings.reset.cancel"),
		});
		if (!ok) return;

		const patch = Object.fromEntries(
			keys.map((key) => [key, DEFAULT_SETTINGS[key]])
		) as Partial<PluginSettings>;
		update(patch);

		if (keys.includes("language")) {
			await i18n.changeLanguage(
				resolveLocale(DEFAULT_SETTINGS.language)
			);
		}
		new Notice(i18n.t("settings.reset.done"));
	};

	const tabProps: TabProps = {
		plugin,
		settings,
		update,
		reset: () => {
			void resetTab();
		},
	};

	const renderTab = () => {
		switch (activeTab) {
			case "general":
				return <GeneralTab {...tabProps} />;
			case "linkPaste":
				return <LinkPasteTab {...tabProps} />;
			case "bracket":
				return <BracketTab {...tabProps} />;
			case "crypto":
				return <CryptoTab {...tabProps} />;
			case "misc":
				return <MiscTab {...tabProps} />;
			default:
				return null;
		}
	};

	return (
		<div className="mikansei-settings">
			<div className="mikansei-tabs">
				{TABS.map((tab) => (
					<div
						key={tab.id}
						className={
							"mikansei-tab" +
							(activeTab === tab.id ? " is-active" : "")
						}
						role="button"
						tabIndex={0}
						onClick={() => selectTab(tab.id)}
					>
						{t(tab.label)}
					</div>
				))}
			</div>
			<div className="mikansei-tab-content">{renderTab()}</div>
		</div>
	);
}
