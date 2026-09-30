import { SuggestModal } from "obsidian";
import type { App } from "obsidian";

export interface LinkAction {
	label: string;
	value: string;
	callback: (value: string) => void;
}

export class LinkActionModal extends SuggestModal<LinkAction> {
	constructor(app: App) {
		super(app);
	}

	getSuggestions(query: string): LinkAction[] {
		return [];
	}

	renderSuggestion(action: LinkAction, el: HTMLElement) {
		el.createEl("div", { text: action.label });
		el.createEl("div", {
			text: action.value,
			attr: {
				style: "font-size: 12px;text-overflow: ellipsis;overflow: hidden;",
			},
		});
	}

	onChooseSuggestion(
		suggestion: LinkAction,
		evt: MouseEvent | KeyboardEvent
	) {}
}
