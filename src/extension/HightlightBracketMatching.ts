import { bracketMatching } from "@codemirror/language";
import type { Range } from "@codemirror/state";
import { Decoration } from "@codemirror/view";
import type Mikansei from "src/main";

export let latestMatch: { start: { from: number; to: number }; end: { from: number; to: number } } | null = null;

export const highlightBracket = () =>
	bracketMatching({
		renderMatch: (match, state) => {
			const { matched, start, end } = match;

			// Update the latest match
			if (matched && end) {
				latestMatch = { start, end };
			}

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
			}
			return decorations;
		},
	});
