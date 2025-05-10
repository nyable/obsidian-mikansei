import { App, Editor, SuggestModal } from "obsidian";
import type Mikansei from "src/main";
import { getUrlTitle } from "../utils/http-util";
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
		el.createEl("div", {
			text: action.value,
			attr: {
				style: "font-size: 12px;text-overflow: ellipsis;overflow: hidden;",
			},
		});
	}

	onChooseSuggestion(action: LinkAction, evt: MouseEvent | KeyboardEvent) {}
}

async function replaceByText(
	editor: Editor,
	url: string,
	text: string,
	title: string,
	fetchTitle: boolean,
	timeout: number
) {
	let finalTitle = title;
	if (fetchTitle) {
		const webTitle = await getUrlTitle(url, timeout);
		if (webTitle) {
			finalTitle = webTitle;
		}
	}
	const titleLength = finalTitle.length;
	const urlLength = url.length;
	let finalLink = text;

	if (text.startsWith(`[${title}]`) && title != finalTitle) {
		finalLink = text.replace(`[${title}]`, `[${finalTitle}]`);
	}

	editor.replaceSelection(finalLink);
	const { ch, line } = editor.getCursor();

	const cursorCh = ch - urlLength - titleLength - 3;
	editor.setCursor(line, cursorCh);
	editor.setSelection(
		{
			line: line,
			ch: cursorCh,
		},
		{
			line: line,
			ch: cursorCh + titleLength,
		}
	);
}

export const enhanceLinkPaste = (plugin: Mikansei) => {
	const { fetchTitle, fetchTitleTimeout } = plugin.settings;
	plugin.registerEvent(
		plugin.app.workspace.on("editor-paste", async (evt, editor) => {
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
						const urlStr = url.toString();
						const title = decodeURI(
							url.pathname.split("/").pop() || ""
						);

						const model = new LinkActionModal(plugin.app);

						const suggestions = [
							{
								label: "1. 作为链接",
								value: `[${title}](${urlStr})`,
								callback: (value: string) => {
									replaceByText(
										editor,
										urlStr,
										value,
										title,
										fetchTitle,
										fetchTitleTimeout
									);
								},
							},
							{
								label: "2. 作为文本",
								value: originText,
								callback: (value: string) => {
									editor.replaceSelection(value);
								},
							},
							{
								label: "3. 作为图片",
								value: `![${title}](${urlStr})`,
								callback: (value: string) => {
									replaceByText(
										editor,
										urlStr,
										value,
										title,
										fetchTitle,
										fetchTitleTimeout
									);
								},
							},
						];

						model.getSuggestions = (q: string) => {
							return suggestions.filter((s) =>
								s.label.includes(q)
							);
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
