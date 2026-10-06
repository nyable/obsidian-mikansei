import { MarkdownView, TFile, type App, type Editor } from "obsidian";
import { BlockConflictError, captureBlock, locateBlock, replaceBlock, replacementLines, type BlockSnapshot } from "./blockContent";
import { i18n } from "src/i18n";

export interface BlockTarget {
	file: TFile;
	snapshot: BlockSnapshot;
}

function fileEditor(app: App, file: TFile): Editor | undefined {
	let editor: Editor | undefined;
	for (const leaf of app.workspace.getLeavesOfType("markdown")) {
		if (leaf.view instanceof MarkdownView && leaf.view.file === file && leaf.view.getMode() === "source") {
			if (editor && editor.getValue() !== leaf.view.editor.getValue()) throw new BlockConflictError();
			editor = leaf.view.editor;
		}
	}
	return editor;
}

export async function captureTarget(app: App, path: string, start: number, language: string, editor?: Editor): Promise<BlockTarget> {
	const file = app.vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile)) throw new Error(i18n.t("crypto.error.noFile"));
	const openEditor = fileEditor(app, file);
	if (editor && openEditor && editor.getValue() !== openEditor.getValue()) throw new BlockConflictError();
	const currentEditor = editor ?? openEditor;
	const document = currentEditor ? currentEditor.getValue() : await app.vault.read(file);
	return { file, snapshot: captureBlock(document, start, language) };
}

export async function writeTarget(app: App, target: BlockTarget, body: string): Promise<void> {
	// Prefer the live editor so unsaved edits are respected and the operation is undoable.
	const editor = fileEditor(app, target.file);
	if (editor) {
		const document = editor.getValue();
		const block = locateBlock(document, target.snapshot);
		editor.replaceRange(
			replacementLines(block, body).join("\n"),
			{ line: block.start, ch: 0 },
			{ line: block.end, ch: editor.getLine(block.end).length }
		);
	} else {
		await app.vault.process(target.file, (document) => replaceBlock(document, target.snapshot, body));
	}
}
