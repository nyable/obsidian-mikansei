import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const urlFor = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
async function moduleUrl(path, dependencies = {}) {
	let code = ts.transpileModule(await readFile(new URL(`../${path}`, import.meta.url), "utf8"), {
		compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
	}).outputText;
	for (const [specifier, url] of Object.entries(dependencies)) code = code.replaceAll(`from "${specifier}"`, `from "${url}"`);
	return urlFor(code);
}
const blockUrl = await moduleUrl("src/features/crypto-block/blockContent.ts");
const obsidianUrl = urlFor(`
export class MarkdownView { file = { path: "note.md" }; }
export class Notice { constructor(message) { globalThis.commandHarness.notices.push(message); } }
export class Modal {
    modalEl = { addClass() {} }; titleEl = { setText() {} }; contentEl = { empty() {}, createEl() {} };
    open() { this.isOpen = true; globalThis.commandHarness.modal = this; this.onOpen?.(); }
    close() { if (this.isOpen) { this.isOpen = false; this.onClose(); } }
}
export class Setting { addButton(callback) { const button = { setButtonText() { return this; }, setWarning() { return this; }, onClick(callback) { globalThis.commandHarness.buttons.push(callback); return this; } }; callback(button); return this; } }
`);
const i18nUrl = urlFor('export const i18n = { t: (key) => key };');
const dialogUrl = await moduleUrl("src/features/crypto-block/CryptoConfirmModal.tsx", {
	"obsidian": obsidianUrl, "src/i18n": i18nUrl,
	"react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
	"react-dom/client": urlFor('export const createRoot = () => ({ render: (tree) => { globalThis.commandHarness.tree = tree; globalThis.commandHarness.dialogs++; }, unmount: () => { globalThis.commandHarness.unmounts++; } });'),
	"./components/CryptoDialog": urlFor('export const CryptoDialog = () => null;'),
});
const { openCryptoDialog } = await import(dialogUrl);
const { confirmModal } = await import(await moduleUrl("src/shared/confirmModal.ts", { "obsidian": obsidianUrl }));
const { MarkdownView } = await import(obsidianUrl);
const { registerCryptoCommands } = await import(await moduleUrl("src/features/crypto-block/cryptoCommands.ts", {
	"obsidian": obsidianUrl, "src/i18n": i18nUrl, "./blockContent": blockUrl,
	"./CryptoConfirmModal": dialogUrl,
	"./crypto": urlFor('export const isEncryptedContent = (source) => source === "cipher";'),
	"./blockStorage": urlFor(`
export const captureTarget = async (...args) => { await globalThis.commandHarness.capture?.(); return { snapshot: { block: { body: "cipher" } } }; };
export const writeTarget = async (app, target, body, validate) => { await globalThis.commandHarness.queued?.(); validate(); globalThis.commandHarness.writes.push(body); };
`),
	"./cryptoService": urlFor('export const encryptContent = async () => "cipher"; export const unlockContent = async () => { await globalThis.commandHarness.decrypt?.(); return { text: "plaintext" }; }; export const cryptoErrorMessage = () => "failure";'),
}));
const tick = () => new Promise((resolve) => setImmediate(resolve));
function harness() {
	const state = { dialogs: 0, unmounts: 0, notices: [], writes: [], tree: null, buttons: [] };
	globalThis.commandHarness = state;
	const commands = [], cleanups = [];
	const plugin = { app: {}, settings: { cryptoBlockEnabled: true, cryptoBlockLanguage: "nya" }, addCommand: (command) => commands.push(command), register: (cleanup) => cleanups.push(cleanup) };
	const cancel = registerCryptoCommands(plugin);
	const view = new MarkdownView();
	const editor = { getValue: () => "```nya\ncipher\n```", getCursor: () => ({ line: 1 }) };
	const run = () => commands[1].editorCheckCallback(false, editor, view);
	return { state, plugin, cancel, run, cleanups };
}

test("repeated commands share a per-file gate, released when the dialog closes", async () => {
	const { state, run, cancel } = harness();
	assert.equal(run(), true);
	assert.equal(run(), false);
	await tick();
	assert.equal(state.dialogs, 1);
	state.modal.close();
	await tick();
	assert.equal(run(), true);
	await tick();
	state.modal.close();
	cancel();
});

test("commands reject disable and identifier changes after password work, without writing", async () => {
	for (const patch of [{ cryptoBlockEnabled: false }, { cryptoBlockLanguage: "other" }]) {
		const { state, plugin, run } = harness();
		run(); await tick();
		let finish;
		state.decrypt = () => new Promise((resolve) => { finish = resolve; });
		const submit = state.tree.props.options.onSubmit({ password: "correct" });
		Object.assign(plugin.settings, patch);
		finish();
		await assert.rejects(submit);
		assert.deepEqual(state.writes, []);
		state.modal.close();
	}
});

test("unload cancels busy dialogs and their late computations cannot write", async () => {
	const { state, run, cleanups } = harness();
	run(); await tick();
	let finish;
	state.decrypt = () => new Promise((resolve) => { finish = resolve; });
	const options = state.tree.props.options;
	const submit = options.onSubmit({ password: "correct" });
	state.modal.close();
	assert.equal(state.modal.isOpen, true, "User close must not hide an active mutation");
	cleanups.forEach((cleanup) => cleanup());
	assert.equal(state.modal.isOpen, false);
	assert.equal(state.modal.options, null);
	finish();
	await assert.rejects(submit);
	await assert.rejects(options.onSubmit({ password: "late" }));
	assert.deepEqual(state.writes, []);
	assert.equal(run(), false);
	assert.equal(state.unmounts, 1);
});

test("cancellation during capture or host write queuing prevents late writes", async () => {
	for (const phase of ["capture", "queued"]) {
		const { state, run, cancel } = harness();
		let finish;
		state[phase] = () => new Promise((resolve) => { finish = resolve; });
		run(); await tick();
		const submit = phase === "queued" ? state.tree.props.options.onSubmit({ password: "correct" }) : null;
		if (submit) await tick();
		cancel(); finish();
		if (submit) await assert.rejects(submit);
		await tick();
		assert.deepEqual(state.writes, []);
		if (phase === "capture") assert.equal(state.dialogs, 0);
	}
});

test("a cancelled dialog does not open, and successful commands preserve the original target", async () => {
	const { state, run } = harness();
	const controller = new AbortController(); controller.abort();
	assert.equal(await openCryptoDialog({}, {}, controller.signal), false);
	assert.equal(state.dialogs, 0);
	run(); await tick();
	await state.tree.props.options.onSubmit({ password: "correct" });
	state.tree.props.onSuccess();
	await tick();
	assert.deepEqual(state.writes, ["plaintext"]);
	assert.equal(state.modal.isOpen, false);
});

test("plaintext confirmation cancellation closes the modal and ignores later choices", async () => {
	const { state } = harness();
	const controller = new AbortController();
	const pending = confirmModal({}, { title: "Confirm", message: "Plaintext", confirmText: "Yes", cancelText: "No" }, controller.signal);
	controller.abort();
	assert.equal(await pending, false);
	assert.equal(state.modal.isOpen, false);
	state.buttons[1]();
	assert.equal(await pending, false);
	assert.equal(await confirmModal({}, {}, controller.signal), false);
});
