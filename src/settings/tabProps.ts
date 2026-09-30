import type Mikansei from "src/main";
import type { PluginSettings } from "./types";

export interface TabProps {
	plugin: Mikansei;
	settings: PluginSettings;
	update: (patch: Partial<PluginSettings>) => void;
	reset: () => void;
}
