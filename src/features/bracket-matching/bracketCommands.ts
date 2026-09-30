import { MarkdownView } from "obsidian";
import type Mikansei from "src/main";
import { i18n } from "src/i18n";
import { latestMatch } from "./bracketMatching";

export function registerBracketCommands(plugin: Mikansei): void {
	plugin.addCommand({
		id: "nya-bracket-jump",
		name: i18n.t("command.bracketJump"),
		icon: "braces",
		editorCheckCallback: (checking, editor, view) => {
			if (!(view instanceof MarkdownView)) return false;

			if (!latestMatch) return false;

			const { start, end } = latestMatch;
			const offset = editor.posToOffset(editor.getCursor("from"));

			const displayFlag =
				(start.from <= offset && start.to >= offset) ||
				(end.from <= offset && end.to >= offset);

			if (displayFlag) {
				if (!checking) {
					editor.setCursor(editor.offsetToPos(end.to));
				}
				return true;
			}

			return false;
		},
	});

	plugin.addCommand({
		id: "nya-bracket-select",
		name: i18n.t("command.bracketSelect"),
		icon: "braces",
		editorCheckCallback: (checking, editor, view) => {
			if (!(view instanceof MarkdownView)) return false;

			if (!latestMatch) return false;

			const { start, end } = latestMatch;
			const offset = editor.posToOffset(editor.getCursor("from"));

			const displayFlag =
				(start.from <= offset && start.to >= offset) ||
				(end.from <= offset && end.to >= offset);

			if (displayFlag) {
				if (!checking) {
					const isEnd = start.to > end.to;

					editor.setSelection(
						editor.offsetToPos(isEnd ? start.to : start.from),
						editor.offsetToPos(isEnd ? end.from : end.to)
					);
				}
				return true;
			}

			return false;
		},
	});
}
