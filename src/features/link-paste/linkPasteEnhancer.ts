import { Notice } from "obsidian";
import type Mikansei from "src/main";
import { getUrlTitle } from "src/shared/http";
import { i18n } from "src/i18n";
import { LinkActionModal, type LinkAction } from "./LinkActionModal";

function parseLink(text: string): { url: string; title: string } | null {
	const trimmed = text.trim();
	if (!/^https?:\/\/\S+$/i.test(trimmed)) return null;
	try {
		const url = new URL(trimmed);
		let title = url.pathname.split("/").pop() || url.hostname;
		try { title = decodeURI(title); } catch { /* Keep malformed escapes as literal text. */ }
		return { url: url.toString(), title };
	} catch { return null; }
}

const escapeLabel = (text: string) => text.replace(/\s+/g, " ").replace(/[\\[\]]/g, "\\$&");
const markdownLink = (title: string, url: string, image: boolean) =>
	`${image ? "!" : ""}[${escapeLabel(title)}](${url.replace(/\(/g, "%28").replace(/\)/g, "%29")})`;

export const enhanceLinkPaste = (plugin: Mikansei) => {
	let loaded = true;
	plugin.register(() => { loaded = false; });
	plugin.registerEvent(plugin.app.workspace.on("editor-paste", (evt, editor, info) => {
		if (!plugin.settings.linkPasteEnhancer || evt.defaultPrevented) return;
		const original = evt.clipboardData?.getData("text/plain");
		if (!original) return;
		const link = parseLink(original);
		if (!link) return; // Invalid input must retain the editor's native paste behavior.

		const document = editor.getValue();
		const file = info.file;
		const from = editor.getCursor("from");
		const to = editor.getCursor("to");
		const fromOffset = editor.posToOffset(from);
		const toOffset = editor.posToOffset(to);
		const canInsert = () => loaded && plugin.settings.linkPasteEnhancer && info.file === file && editor.getValue() === document;
		const insert = async (kind: "link" | "text" | "image") => {
			if (!canInsert()) {
				if (loaded) new Notice(i18n.t("linkPaste.documentChanged"));
				return;
			}
			const image = kind === "image";
			const fallback = kind === "text" ? original : markdownLink(link.title, link.url, image);
			// Insert immediately, before any network request. Cursor movement never changes the target.
			editor.replaceRange(fallback, from, to);
			const labelStart = fromOffset + (image ? 2 : 1);
			if (kind === "text") {
				editor.setCursor(editor.offsetToPos(fromOffset + fallback.length));
				return;
			}
			const selectLabel = (title: string) => editor.setSelection(
				editor.offsetToPos(labelStart), editor.offsetToPos(labelStart + escapeLabel(title).length));
			selectLabel(link.title);
			const { fetchTitle, fetchTitleTimeout } = plugin.settings;
			if (!fetchTitle) return;
			const expected = document.slice(0, fromOffset) + fallback + document.slice(toOffset);
			const title = await getUrlTitle(link.url, fetchTitleTimeout);
			// Never overwrite edits, a changed selection, a disabled feature or an unloaded plugin.
			if (!title || !loaded || !plugin.settings.linkPasteEnhancer || !plugin.settings.fetchTitle || info.file !== file ||
				editor.getValue() !== expected || editor.posToOffset(editor.getCursor("from")) !== labelStart ||
				editor.posToOffset(editor.getCursor("to")) !== labelStart + escapeLabel(link.title).length) return;
			editor.replaceRange(markdownLink(title, link.url, image), from, editor.offsetToPos(fromOffset + fallback.length));
			selectLabel(title);
		};
		const model = new LinkActionModal(plugin.app);
		const suggestions: LinkAction[] = [
			{ label: `1. ${i18n.t("linkPaste.asLink")}`, value: markdownLink(link.title, link.url, false), callback: () => insert("link") },
			{ label: `2. ${i18n.t("linkPaste.asText")}`, value: original, callback: () => insert("text") },
			{ label: `3. ${i18n.t("linkPaste.asImage")}`, value: markdownLink(link.title, link.url, true), callback: () => insert("image") },
		];
		model.getSuggestions = (query: string) => suggestions.filter((item) => item.label.includes(query));
		model.onChooseSuggestion = (suggestion: LinkAction) => {
			void Promise.resolve(suggestion.callback(suggestion.value)).catch((error: unknown) => {
				console.error("Mikansei: link paste failed", error);
				if (loaded) new Notice(i18n.t("linkPaste.failed"));
			});
		};
		// Do not consume the event until validation and modal setup have succeeded.
		model.open();
		evt.preventDefault();
		evt.stopPropagation();
	}));
};
