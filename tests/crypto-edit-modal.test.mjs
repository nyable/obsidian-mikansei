import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const urlFor = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
async function moduleUrl(path, dependencies) {
	const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
	let code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
	for (const [specifier, url] of Object.entries(dependencies)) code = code.replaceAll(`from "${specifier}"`, `from "${url}"`);
	return urlFor(code);
}
const obsidianUrl = urlFor(`
export class Modal {
    constructor(app) {
        this.app = app;
        this.modalEl = { addClass: (name) => { this.className = name; } };
        this.titleEl = { setText: (title) => { this.title = title; } };
        this.contentEl = { empty: () => {} };
    }
    open() { this.isOpen = true; globalThis.editHarness.modal = this; this.onOpen(); }
    close() { if (!this.isOpen) return; this.isOpen = false; this.onClose(); }
}
export class Notice { constructor(message) { globalThis.editHarness.notices.push(message); } }
`);
const serviceUrl = urlFor('export const safeLanguage = (value) => /^[a-zA-Z0-9_#+.\\-]{1,40}$/.test(value) ? value : "text"; export const cryptoErrorMessage = () => "failure";');
const i18nUrl = urlFor('export const i18n = { t: (key) => key };');
const { openCryptoEditor } = await import(await moduleUrl("src/features/crypto-block/CryptoEditModal.tsx", {
	"obsidian": obsidianUrl,
	"react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
	"react-dom/client": urlFor('export const createRoot = () => ({ render: (tree) => { globalThis.editHarness.tree = tree; }, unmount: () => { globalThis.editHarness.unmounts++; globalThis.editHarness.tree = null; } });'),
	"src/i18n": i18nUrl,
	"./CryptoConfirmModal": urlFor('export const askDirtyAction = (...args) => globalThis.editHarness.ask(...args);'),
	"./cryptoService": serviceUrl,
	"./components/CryptoEditDialog": urlFor('export const CryptoEditDialog = () => null;'),
}));

const initial = { text: "secret", remark: "public", language: "dataview" };
function harness(options = {}) {
	const state = {
		tree: null, modal: null, notices: [], saves: [], choices: [], unmounts: 0,
		async ask(app, signal) { this.choices.push(signal); return "continue"; },
		async save(draft) { this.saves.push(draft); },
		...options,
	};
	globalThis.editHarness = state;
	const handle = openCryptoEditor({}, initial, (draft) => state.save(draft));
	return { state, handle };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("editor owns a cloned local draft and clean closing performs no write", async () => {
	const { state, handle } = harness();
	assert.equal(state.modal.title, "crypto.ui.editTitle");
	assert.equal(state.modal.className, "nya-crypto-edit-modal");
	assert.notEqual(state.tree.props.draft, initial);
	state.modal.close();
	await handle.finished;
	assert.equal(state.saves.length, 0);
	assert.equal(state.choices.length, 0);
	assert.equal(state.unmounts, 1);
});

test("every dirty close path asks before discarding and continues without losing the draft", async () => {
	const { state, handle } = harness();
	state.tree.props.onChange({ ...initial, text: "changed" });
	state.tree.props.onCancel();
	await tick();
	assert.equal(state.modal.isOpen, true);
	assert.equal(state.tree.props.draft.text, "changed");
	assert.equal(state.tree.props.busy, false);
	assert.equal(state.saves.length, 0);
	assert.equal(state.choices.length, 1);
	state.ask = async () => "discard";
	state.modal.close(); // Escape/backdrop use the same Modal.close override.
	await handle.finished;
	assert.equal(state.saves.length, 0);
	assert.equal(state.modal.draft.text, "");
	assert.equal(initial.text, "secret");
});

test("save from the dirty-exit prompt encrypts the current draft and closes on success", async () => {
	const { state, handle } = harness({ ask: async () => "save" });
	state.tree.props.onChange({ text: "changed", remark: "new public remark", language: "js" });
	state.modal.close();
	await handle.finished;
	assert.deepEqual(state.saves, [{ text: "changed", remark: "new public remark", language: "js" }]);
	assert.equal(state.modal.isOpen, false);
});

test("failed saves retain draft and error in the same modal for retry", async () => {
	let attempts = 0;
	const { state, handle } = harness({ async save(draft) {
		if (++attempts === 1) throw new Error("conflict");
		this.saves.push(draft);
	} });
	state.tree.props.onChange({ ...initial, text: "changed" });
	state.tree.props.onSave();
	await tick();
	assert.equal(state.modal.isOpen, true);
	assert.equal(state.tree.props.error, "failure");
	assert.equal(state.tree.props.draft.text, "changed");
	assert.equal(state.tree.props.busy, false);
	state.tree.props.onSave();
	await handle.finished;
	assert.equal(state.saves.length, 1);
});

test("failed save from a close prompt also keeps the editor open", async () => {
	const { state, handle } = harness({ ask: async () => "save", save: async () => { throw new Error("conflict"); } });
	state.tree.props.onChange({ ...initial, text: "changed" });
	state.modal.close();
	await tick();
	assert.equal(state.modal.isOpen, true);
	assert.equal(state.tree.props.error, "failure");
	assert.equal(state.tree.props.busy, false);
	handle.dispose(); await handle.finished;
});

test("invalid language blocks saving even from the close prompt", async () => {
	const { state, handle } = harness({ ask: async () => "save" });
	state.tree.props.onChange({ ...initial, language: "bad language" });
	state.modal.close();
	await tick();
	assert.equal(state.saves.length, 0);
	assert.equal(state.tree.props.error, "crypto.ui.languageInvalid");
	assert.equal(state.modal.isOpen, true);
	handle.dispose(); await handle.finished;
});

test("in-flight saving rejects duplicate saves, edits, and user close", async () => {
	let complete;
	const { state, handle } = harness({ save: (draft) => new Promise((resolve) => { state.saves.push(draft); complete = resolve; }) });
	state.tree.props.onChange({ ...initial, text: "changed" });
	const callbacks = state.tree.props;
	callbacks.onSave(); callbacks.onSave(); callbacks.onCancel();
	callbacks.onChange({ ...initial, text: "lost change" });
	assert.equal(state.saves.length, 1);
	assert.equal(state.modal.isOpen, true);
	assert.equal(state.modal.draft.text, "changed");
	complete(); await handle.finished;
});

test("disposing the source view clears drafts and closes a pending dirty confirmation", async () => {
	let aborted = false;
	const { state, handle } = harness({ ask: (app, signal) => new Promise((resolve) => {
		signal.addEventListener("abort", () => { aborted = true; resolve("continue"); }, { once: true });
	}) });
	state.tree.props.onChange({ ...initial, text: "changed" });
	state.modal.close();
	handle.dispose(); handle.dispose();
	await handle.finished; await tick();
	assert.equal(aborted, true);
	assert.equal(state.modal.isOpen, false);
	assert.equal(state.modal.draft.text, "");
	assert.equal(state.modal.initial.text, "");
	assert.equal(state.modal.onSave, null);
	assert.equal(state.unmounts, 1);
	assert.deepEqual(state.notices, ["crypto.ui.draftLost"]);
});

test("disposing during a successful write does not announce a lost draft or reopen the modal", async () => {
	let complete;
	const { state, handle } = harness({ save: () => new Promise((resolve) => { complete = resolve; }) });
	state.tree.props.onChange({ ...initial, text: "changed" });
	state.tree.props.onSave();
	handle.dispose(); await handle.finished;
	complete(); await tick();
	assert.equal(state.modal.isOpen, false);
	assert.equal(state.notices.length, 0);
	assert.equal(state.unmounts, 1);
});

// Also check keyboard submission and semantic fields in the real React form.
const { CryptoEditDialog } = await import(await moduleUrl("src/features/crypto-block/components/CryptoEditDialog.tsx", {
	"react": urlFor('export const useId = () => "test";'),
	"react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
	"react-i18next": urlFor('export const useTranslation = () => ({ t: (key) => key });'),
	"../cryptoService": serviceUrl,
}));
test("edit form submits Ctrl/Cmd+Enter but not composition, invalid language, or busy saves", () => {
	let saves = 0;
	const props = { draft: initial, dirty: true, busy: false, error: "", onChange() {}, onCancel() {}, onSave: () => { saves++; } };
	const event = { key: "Enter", ctrlKey: true, nativeEvent: { isComposing: false }, preventDefault() {} };
	CryptoEditDialog(props).props.onKeyDown(event);
	CryptoEditDialog(props).props.onKeyDown({ ...event, ctrlKey: false, metaKey: true });
	CryptoEditDialog(props).props.onKeyDown({ ...event, nativeEvent: { isComposing: true } });
	CryptoEditDialog({ ...props, busy: true }).props.onKeyDown(event);
	CryptoEditDialog({ ...props, draft: { ...initial, language: "bad language" } }).props.onKeyDown(event);
	assert.equal(saves, 2);
});
