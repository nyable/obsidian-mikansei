import { PluginSettingTab } from "obsidian";
import type { App } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import type Mikansei from "src/main";
import { SettingsView } from "./SettingsView";

export class MikanseiSettingTab extends PluginSettingTab {
	plugin: Mikansei;
	private root: Root | null = null;

	constructor(app: App, plugin: Mikansei) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		this.root ??= createRoot(this.containerEl);
		this.root.render(createElement(SettingsView, { plugin: this.plugin }));
	}

	hide(): void {
		this.root?.unmount();
		this.root = null;
	}
}
