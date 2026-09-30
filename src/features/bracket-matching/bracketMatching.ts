import { bracketMatching } from "@codemirror/language";
import type { Range } from "@codemirror/state";
import { Decoration } from "@codemirror/view";
import type Mikansei from "src/main";
import type { PluginSettings } from "src/settings/types";

export interface BracketMatch {
	start: { from: number; to: number };
	end: { from: number; to: number };
}

export let latestMatch: BracketMatch | null = null;

export const highlightBracket = (plugin: Mikansei) =>
	bracketMatching({
		renderMatch: (match) => {
			const { matched, start, end } = match;

			// Update the latest match
			if (matched && end) {
				latestMatch = { start, end };
			}

			const decorations: Range<Decoration>[] = [];

			// 未匹配且关闭了「高亮未匹配的括号」时，不产生任何标记
			if (!matched && !plugin.settings.highlightUnmatchedBrackets) {
				return decorations;
			}

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

/**
 * 把括号高亮的颜色与样式方案应用到全局：
 * 颜色写入 CSS 变量，样式方案切换 body 上的 class。
 */
export function applyBracketStyles(settings: PluginSettings): void {
	const body = document.body;
	body.style.setProperty(
		"--nya-bracket-match-color",
		settings.bracketMatchColor
	);
	body.style.setProperty(
		"--nya-bracket-miss-color",
		settings.bracketMissColor
	);
	body.classList.toggle(
		"nya-bracket-style-underline",
		settings.bracketStyle === "underline"
	);
	body.classList.toggle(
		"nya-bracket-style-background",
		settings.bracketStyle === "background"
	);
	body.classList.toggle(
		"nya-bracket-style-text",
		settings.bracketStyle === "text"
	);
}
