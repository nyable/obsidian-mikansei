import { bracketMatching } from "@codemirror/language";
import type { Range } from "@codemirror/state";
import { Decoration } from "@codemirror/view";
import type Mikansei from "src/main";

export const highlightBracket = (plugin: Mikansei) =>
	bracketMatching({
		renderMatch: (match, state) => {
			const { matched, start, end } = match;
			const decorations: Range<Decoration>[] = [];
			const className = matched
				? "nya-bracket-matched"
				: "nya-bracket-missed";

			decorations.push(
				Decoration.mark({
					class: className,
				}).range(start.from, start.to)
			);
			if (end) {
				decorations.push(
					Decoration.mark({
						class: className,
					}).range(end.from, end.to)
				);

				plugin.addCommand({
					id: "nya-jump-to-bracket",
					name: "Jump to bracket",
					icon: "braces",
					editorCheckCallback(checking, editor, ctx) {
						const offset = editor.posToOffset(
							editor.getCursor("from")
						);
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
					id: "nya-select-to-bracket2",
					name: "Select to bracket",
					icon: "braces",
					editorCheckCallback(checking, editor, ctx) {
						const offset = editor.posToOffset(
							editor.getCursor("from")
						);

						const displayFlag =
							(start.from <= offset && start.to >= offset) ||
							(end.from <= offset && end.to >= offset);

						if (displayFlag) {
							if (!checking) {
								const isEnd = start.to > end.to;

								editor.setSelection(
									editor.offsetToPos(
										isEnd ? start.to : start.from
									),
									editor.offsetToPos(
										isEnd ? end.from : end.to
									)
								);
							}
							return true;
						}

						return false;
					},
				});
			}
			return decorations;
		},
	});
