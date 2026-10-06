import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { compile } from "sass";

// Exercise the real component action callbacks without mounting an Obsidian window.
const urlFor = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
async function loadModule(path, dependencies) {
	const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
	let code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
	for (const [specifier, dependency] of Object.entries(dependencies)) code = code.replaceAll(`from "${specifier}"`, `from "${dependency}"`);
	return import(urlFor(code));
}
const hookUrl = urlFor(`
export const useMemo = (factory) => factory();
export const useCallback = (callback) => callback;
export const useEffect = (effect) => { globalThis.cryptoHarness.effects.push(effect); };
export const useId = () => "test";
export const useState = (initial) => {
    const index = globalThis.cryptoHarness.stateIndex++;
    return [globalThis.cryptoHarness.states[index] ?? initial, (value) => {
        globalThis.cryptoHarness.updates[index] = value;
        if (index === 1 && value === false) globalThis.cryptoHarness.complete();
    }];
};
export const useRef = (initial) => {
    const index = globalThis.cryptoHarness.refIndex++;
    const ref = { current: index === 0 ? globalThis.cryptoHarness.session : initial };
    globalThis.cryptoHarness.refs.push(ref);
    return ref;
};
`);
const autoLockUrl = urlFor(ts.transpileModule(await readFile(new URL("../src/features/crypto-block/autoLock.ts", import.meta.url), "utf8"), {
	compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText);
const { CryptoCodeBlockView } = await loadModule("src/features/crypto-block/components/CryptoCodeBlockView.tsx", {
	"react": hookUrl,
	"react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
	"lucide-react": import.meta.resolve("lucide-react"),
	"react-i18next": urlFor('export const useTranslation = () => ({ t: (key) => key });'),
	"obsidian": urlFor('export class Menu {} export class Notice { constructor(message) { globalThis.cryptoHarness.notices.push(message); } }'),
	"src/shared/confirmModal": urlFor('export const confirmModal = (...args) => globalThis.cryptoHarness.confirm(...args);'),
	"../CryptoConfirmModal": urlFor('export const openCryptoDialog = (...args) => globalThis.cryptoHarness.dialog(...args); export const askDirtyAction = async () => "continue";'),
	"../CryptoEditModal": urlFor('export const openCryptoEditor = (...args) => globalThis.cryptoHarness.editor(...args);'),
	"../crypto": urlFor('export const isEncryptedContent = () => true;'),
	"../blockStorage": urlFor('export const captureTarget = async () => globalThis.cryptoHarness.target; export const writeTarget = async (...args) => globalThis.cryptoHarness.write(...args);'),
	"../blockContent": urlFor('export class BlockConflictError extends Error {}'),
	"../cryptoService": urlFor('export const readBundle = () => ({ remark: "public" }); export const safeLanguage = (value) => value; export const encryptContent = async (...args) => { globalThis.cryptoHarness.encryptCalls.push(args); return "cipher"; }; export const unlockContent = (...args) => globalThis.cryptoHarness.unlock(...args); export const cryptoErrorMessage = () => "failure";'),
	"../autoLock": autoLockUrl,
	"../previewRendering": urlFor('export const renderCryptoPreview = () => { throw new Error("Direct decryption must not render a preview"); };'),
});

function buttons(tree) {
	if (!tree || typeof tree !== "object") return [];
	if (Array.isArray(tree)) return tree.flatMap(buttons);
	return [...(tree.type === "button" ? [tree] : []), ...buttons(tree.props?.children)];
}
function harness(options = {}) {
	let complete;
	const finished = new Promise((resolve) => { complete = resolve; });
	const state = {
		stateIndex: 0, refIndex: 0, states: [], updates: {}, session: null, effects: [], refs: [],
		complete, notices: [], writes: [], dialogCalls: [], confirmations: [], unlockCalls: [], editorCalls: [], encryptCalls: [],
		target: { snapshot: { block: { body: "cipher" } } },
		async unlock(source, password) {
			this.unlockCalls.push({ source, password });
			if (password !== "correct") throw new Error("wrong password");
			return { text: "plaintext", remark: "public", language: "dataview" };
		},
		async write(app, target, text) { this.writes.push({ target, text }); },
		async dialog(app, dialog) { this.dialogCalls.push(dialog); await dialog.onSubmit({ password: "correct" }); return true; },
		async confirm(app, confirmation) { this.confirmations.push(confirmation); return true; },
		editor(app, initial, save) {
			this.editorCalls.push({ initial, save });
			return { finished: Promise.resolve(), dispose() {} };
		},
		...options,
	};
	globalThis.cryptoHarness = state;
	const tree = CryptoCodeBlockView({ source: "cipher", el: { ownerDocument: { addEventListener() {}, removeEventListener() {} } }, ctx: { sourcePath: "note.md", getSectionInfo: () => ({ lineStart: 0 }) }, plugin: { app: {}, settings: { cryptoBlockLanguage: "nya", cryptoBlockHeight: 300, cryptoAutoLockMinutes: 5 } } });
	const button = buttons(tree).find((item) => item.props["aria-label"] === "crypto.ui.decryptPermanent");
	assert.ok(button, "Permanent decryption must be directly accessible on the toolbar");
	return { state, tree, button, finished };
}

test("locked toolbar decrypts directly with an explicit plaintext warning, without unlocking a preview", async () => {
	const { state, button, finished } = harness();
	button.props.onClick();
	await finished;
	assert.equal(state.dialogCalls[0].title, "crypto.ui.decryptPermanent");
	assert.equal(state.dialogCalls[0].description, "crypto.ui.permanentWarning");
	assert.deepEqual(state.unlockCalls, [{ source: "cipher", password: "correct" }]);
	assert.equal(state.writes[0].text, "plaintext");
	assert.equal(state.updates[0], null, "The operation must not set unlocked preview content");
	assert.ok(state.notices.includes("crypto.notice.decryptToFileSuccess"));
});

test("cancelling direct decryption performs no decrypt or write", async () => {
	const { state, button, finished } = harness({ dialog: async () => false });
	button.props.onClick(); await finished;
	assert.equal(state.unlockCalls.length, 0);
	assert.equal(state.writes.length, 0);
});

test("direct decryption propagates errors to the same dialog callback for retry", async () => {
	const { state, button, finished } = harness({
		async dialog(app, dialog) {
			await assert.rejects(dialog.onSubmit({ password: "wrong" }), /wrong password/);
			assert.equal(this.writes.length, 0);
			await dialog.onSubmit({ password: "correct" });
			return true;
		},
	});
	button.props.onClick(); await finished;
	assert.equal(state.unlockCalls.length, 2);
	assert.equal(state.writes.length, 1);
});

test("a direct write failure remains retryable without opening the preview", async () => {
	let attempts = 0;
	const { state, button, finished } = harness({
		async write(app, target, text) {
			if (++attempts === 1) throw new Error("file conflict");
			this.writes.push({ target, text });
		},
		async dialog(app, dialog) {
			await assert.rejects(dialog.onSubmit({ password: "correct" }), /file conflict/);
			assert.equal(this.writes.length, 0);
			assert.equal(this.notices.length, 0);
			await dialog.onSubmit({ password: "correct" });
			return true;
		},
	});
	button.props.onClick(); await finished;
	assert.equal(state.writes.length, 1);
	assert.equal(state.updates[0], null);
});

test("already unlocked decryption confirms without asking for the password again", async () => {
	const session = { text: "plaintext", remark: "public", language: "dataview", target: { snapshot: { block: { body: "cipher" } } } };
	const { state, button, finished } = harness({ session, states: [session, session] });
	button.props.onClick(); await finished;
	assert.equal(state.dialogCalls.length, 0);
	assert.equal(state.unlockCalls.length, 0);
	assert.equal(state.confirmations[0].message, "crypto.ui.permanentWarning");
	assert.equal(state.writes[0].text, "plaintext");
});

test("cancelling unlocked confirmation never writes plaintext", async () => {
	const session = { text: "plaintext", remark: "public", language: "text" };
	const { state, button, finished } = harness({ session, states: [session, session], confirm: async () => false });
	button.props.onClick(); await finished;
	assert.equal(state.writes.length, 0);
});

test("while the editor is open, stale toolbar actions cannot decrypt or lock the session", async () => {
	const session = { text: "plaintext", remark: "public", language: "text" };
	let closeEditor;
	const { state, tree, button, finished } = harness({ session, states: [session], editor(app, initial, save) {
		this.editorCalls.push({ initial, save });
		return { finished: new Promise((resolve) => { closeEditor = resolve; }), dispose() {} };
	} });
	buttons(tree).find((item) => item.props["aria-label"] === "crypto.ui.edit").props.onClick();
	button.props.onClick();
	buttons(tree).find((item) => item.props["aria-label"] === "crypto.ui.lock").props.onClick();
	assert.equal(state.writes.length, 0);
	assert.equal(state.confirmations.length, 0);
	assert.equal(state.updates[0], undefined);
	closeEditor(); await finished;
});

test("editing opens a standalone draft with no inline fields or duplicate preview header", async () => {
	const session = { text: "plaintext", remark: "public", language: "dataview" };
	const { state, tree, finished } = harness({ session, states: [session] });
	const serialized = JSON.stringify(tree);
	assert.doesNotMatch(serialized, /preview-header|language-name|crypto-edit-area|textarea/);
	assert.match(serialized, /preview-content/);
	buttons(tree).find((item) => item.props["aria-label"] === "crypto.ui.edit").props.onClick();
	await finished;
	assert.deepEqual(state.editorCalls[0].initial, { text: "plaintext", remark: "public", language: "dataview" });
	assert.equal(state.writes.length, 0, "Opening or discarding an editor must not write anything");
	assert.equal(state.updates[0], undefined, "Preview session remains unlocked after cancel");
});

test("modal saves encrypt the changed draft and lock the preview", async () => {
	const session = { text: "plaintext", remark: "public", language: "text", password: "password", target: { snapshot: { block: { body: "cipher" } } } };
	const { state, tree, finished } = harness({ session, states: [session] });
	buttons(tree).find((item) => item.props["aria-label"] === "crypto.ui.edit").props.onClick();
	await state.editorCalls[0].save({ text: "updated", remark: "new remark", language: "js" });
	await finished;
	assert.equal(state.writes[0].text, "cipher");
	assert.equal(state.writes[0].target, session.target);
	assert.deepEqual(state.encryptCalls, [["updated", "password", "new remark", "js"]]);
	assert.equal(state.updates[0], null);
	assert.ok(state.notices.includes("crypto.ui.saved"));
});

test("auto-lock stays paused throughout modal editing and restarts its idle clock on exit", async () => {
	const previousWindow = globalThis.window;
	let check;
	globalThis.window = { setInterval(callback) { check = callback; return 1; }, clearInterval() {} };
	try {
		let closeEditor;
		const session = { text: "plaintext", remark: "public", language: "text" };
		const { state, tree, finished } = harness({ session, states: [session], editor() {
			return { finished: new Promise((resolve) => { closeEditor = resolve; }), dispose() {} };
		} });
		const stopTimer = state.effects[1]();
		buttons(tree).find((item) => item.props["aria-label"] === "crypto.ui.edit").props.onClick();
		const clock = state.refs[4];
		clock.current = Date.now() - 10 * 60_000;
		check();
		assert.equal(state.updates[0], undefined);
		closeEditor(); await finished;
		check();
		assert.equal(state.updates[0], undefined, "Closing the modal must restart idle time, not immediately lock");
		clock.current = Date.now() - 10 * 60_000;
		check();
		assert.equal(state.updates[0], null);
		stopTimer();
	} finally { globalThis.window = previousWindow; }
});

test("unmount closes the editor, clears the session and rejects an asynchronous late save", async () => {
	let closeEditor;
	let disposed = 0;
	const session = { text: "plaintext", remark: "public", language: "text", password: "password", target: {} };
	const { state, tree } = harness({ session, states: [session], editor(app, initial, save) {
		this.editorCalls.push({ initial, save });
		return { finished: new Promise((resolve) => { closeEditor = resolve; }), dispose() { disposed++; closeEditor(); } };
	} });
	const unmount = state.effects[0]();
	buttons(tree).find((item) => item.props["aria-label"] === "crypto.ui.edit").props.onClick();
	unmount();
	await assert.rejects(state.editorCalls[0].save({ ...session, text: "late" }));
	assert.equal(state.writes.length, 0);
	assert.equal(state.refs[0].current, null);
	assert.equal(disposed, 1);
	// No state update is attempted after unmount, so the usual completion hook is not used.
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(state.refs[2].current, false);
});

test("compiled crypto field styles provide one border without stacked focus rings and exclude preview controls", () => {
	const css = compile(new URL("../src/styles/crypto.scss", import.meta.url).pathname).css;
	const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
	const fieldFocus = rules.find(([, selector, declarations]) => selector.includes(".nya-crypto-form > .crypto-field > input:focus") && declarations.includes("border-color: var(--interactive-accent)"));
	assert.ok(fieldFocus);
	assert.match(fieldFocus[2], /outline: none/);
	assert.match(fieldFocus[2], /box-shadow: none/);
	const language = rules.find(([, selector]) => selector.includes(".nya-crypto-form > .crypto-field > input.crypto-language-input"));
	assert.match(language[2], /width: 180px/);
	assert.match(language[2], /max-width: 100%/);
	assert.doesNotMatch(css, /preview-header|language-name|crypto-edit-area/);
	assert.doesNotMatch(css, /\.crypto-code-block\s+(?:input|textarea|button)\b/);
	assert.doesNotMatch(css, /\.preview-content[^{}]*\b(?:input|textarea|button):focus/);
});
