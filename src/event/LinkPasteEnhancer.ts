import { App, Editor, SuggestModal } from "obsidian";
import type Mikansei from "src/main";

interface LinkAction {
	label: string;
	value: string;
	callback: (value: string) => void;
}

class LinkActionModal extends SuggestModal<LinkAction> {
	constructor(app: App) {
		super(app);
	}
	getSuggestions(query: string): LinkAction[] {
		return [];
	}

	renderSuggestion(action: LinkAction, el: HTMLElement) {
		el.createEl("div", { text: action.label });
		el.createEl("small", { text: action.value });
	}

	onChooseSuggestion(action: LinkAction, evt: MouseEvent | KeyboardEvent) {}
}

function replaceAsValue(editor: Editor, url: URL, value: string) {
	const lastPath = decodeURI(url.pathname.split("/").pop() || "");
	editor.replaceSelection(value);
	const { ch, line } = editor.getCursor();

	const cursorCh = ch - url.toString().length - 3 - lastPath.length;
	editor.setCursor(line, cursorCh);
	editor.setSelection(
		{
			line: line,
			ch: cursorCh,
		},
		{
			line: line,
			ch: cursorCh + lastPath.length,
		}
	);
}

export const enhanceLinkPaste = (plugin: Mikansei) => {
	plugin.registerEvent(
		plugin.app.workspace.on("editor-paste", (evt, editor) => {
			const dataType = "text/plain";
			const clipData = evt.clipboardData;

			if (clipData) {
				if (clipData.types.includes(dataType)) {
					const originText = clipData.getData(dataType);
					const trimText = originText.trim();
					if (
						!trimText.includes("\n") &&
						/^https?:\/\/\S+/.test(trimText)
					) {
						evt.preventDefault();
						evt.stopPropagation();
						const url = new URL(trimText);
						const lastPath = decodeURI(
							url.pathname.split("/").pop() || ""
						);
						const model = new LinkActionModal(plugin.app);

						const suggestions = [
							{
								label: "作为链接",
								value: `[${lastPath}](${url.toString()})`,
								callback: (value: string) => {
									replaceAsValue(editor, url, value);
								},
							},
							{
								label: "作为文本",
								value: originText,
								callback: (value: string) => {
									editor.replaceSelection(value);
								},
							},
							{
								label: "作为图片",
								value: `![${lastPath}](${url.toString()})`,
								callback: (value: string) => {
									replaceAsValue(editor, url, value);
								},
							},
						];

						model.getSuggestions = (q: string) => {
							return suggestions
								.map((s, index) => {
									s.label = `${index + 1}. ${s.label}`;
									return s;
								})
								.filter((s) => s.label.includes(q));
						};
						model.onChooseSuggestion = (
							suggestion: LinkAction,
							evt: MouseEvent | KeyboardEvent
						) => {
							suggestion.callback(suggestion.value);
						};
						model.open();
					}
				}
			}
		})
	);
};
