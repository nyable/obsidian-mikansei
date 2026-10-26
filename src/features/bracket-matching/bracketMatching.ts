import { bracketMatching, matchBrackets } from "@codemirror/language";
import type { EditorState, Range } from "@codemirror/state";
import { Decoration } from "@codemirror/view";
import { editorInfoField, type Editor } from "obsidian";
import type Mikansei from "src/main";
import type { PluginSettings } from "src/settings/types";

export interface BracketMatch {
	start: { from: number; to: number };
	end: { from: number; to: number };
}

// Weak keys keep matching context local without retaining closed editors.
const editorStates = new WeakMap<Editor, EditorState>();

/** Resolve the current cursor against the current editor, never a previous render's offsets. */
export function currentBracketMatch(editor: Editor): BracketMatch | null {
	const state = editorStates.get(editor);
	if (!state || state.doc.toString() !== editor.getValue() || editor.somethingSelected()) return null;
	const pos = editor.posToOffset(editor.getCursor());
	const match = matchBrackets(state, pos, -1)
		|| (pos > 0 && matchBrackets(state, pos - 1, 1))
		|| matchBrackets(state, pos, 1)
		|| (pos < state.doc.length && matchBrackets(state, pos + 1, -1));
	return match && match.matched && match.end ? { start: match.start, end: match.end } : null;
}

export const highlightBracket = (plugin: Mikansei) =>
	bracketMatching({
		renderMatch: (match, state) => {
			const editor = state.field(editorInfoField, false)?.editor;
			if (editor) editorStates.set(editor, state);
			const { matched, start, end } = match;

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

export function clearBracketStyles(): void {
	document.body.style.removeProperty("--nya-bracket-match-color");
	document.body.style.removeProperty("--nya-bracket-miss-color");
	document.body.classList.remove("nya-bracket-style-underline", "nya-bracket-style-background", "nya-bracket-style-text");
}

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
