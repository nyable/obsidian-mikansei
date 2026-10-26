import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const urlFor = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
async function moduleUrl(path, dependencies = {}) {
	const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
	let code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
	for (const [specifier, dependency] of Object.entries(dependencies)) code = code.replaceAll(`from "${specifier}"`, `from "${dependency}"`);
	return urlFor(code.replace('import "./styles/index.scss";', ""));
}
const settingsUrl = await moduleUrl("src/settings/types.ts");
const { DEFAULT_SETTINGS } = await import(settingsUrl);
const obsidianUrl = urlFor(`
export class Plugin {
    callbacks = [];
    data = {};
    app = { workspace: {
        updateOptions: () => { globalThis.settingsHarness.refreshes++; },
        getLeavesOfType: () => globalThis.settingsHarness.leaves,
    } };
    register(callback) { this.callbacks.push(callback); }
    registerEditorExtension(extensions) { this.extensions = extensions; }
    addSettingTab() {}
    async loadData() { return this.data; }
    async saveData(data) { return globalThis.settingsHarness.save(data); }
}
export class MarkdownView {
    previewMode = { rerender: () => { globalThis.settingsHarness.renders++; } };
}
`);
const { MarkdownView } = await import(obsidianUrl);
const { default: Mikansei } = await import(await moduleUrl("src/main.ts", {
	"obsidian": obsidianUrl,
	"./features/bracket-matching/bracketMatching": urlFor('export const highlightBracket = () => ({}); export const applyBracketStyles = () => {}; export const clearBracketStyles = () => { globalThis.settingsHarness.cleared++; };'),
	"./features/bracket-matching/bracketCommands": urlFor('export const registerBracketCommands = () => { globalThis.settingsHarness.bracketCommands++; };'),
	"./features/link-paste/linkPasteEnhancer": urlFor('export const enhanceLinkPaste = () => { globalThis.settingsHarness.linkHandlers++; };'),
	"./features/crypto-block/codeBlockProcessor": urlFor('export const codeBlockCrypto = (plugin) => { const h = globalThis.settingsHarness; h.registrations.push(plugin.settings.cryptoBlockLanguage); h.active++; return () => { h.disposals++; h.active--; }; };'),
	"./features/crypto-block/cryptoCommands": urlFor('export const registerCryptoCommands = () => { globalThis.settingsHarness.cryptoCommands++; };'),
	"./settings/SettingsTab": urlFor('export class MikanseiSettingTab {}'),
	"./settings/types": settingsUrl,
	"./i18n": urlFor('export const initI18n = async () => {};'),
}));
function harness() {
	const state = { leaves: [{ view: new MarkdownView() }], refreshes: 0, renders: 0, registrations: [], active: 0, disposals: 0,
		cleared: 0, linkHandlers: 0, bracketCommands: 0, cryptoCommands: 0, async save() {} };
	globalThis.settingsHarness = state;
	return { state, plugin: new Mikansei() };
}

test("features disabled at startup can be enabled without reloading or duplicate handlers", async () => {
	const { state, plugin } = harness();
	plugin.data = { bracketMatchingEnabled: false, cryptoBlockEnabled: false, linkPasteEnhancer: false };
	await plugin.onload();
	assert.equal(plugin.extensions.length, 0);
	assert.equal(state.active, 0);
	assert.equal(state.linkHandlers, 1);
	assert.equal(state.bracketCommands, 1);
	assert.equal(state.cryptoCommands, 1);
	plugin.settings.bracketMatchingEnabled = plugin.settings.cryptoBlockEnabled = true;
	plugin.applySettings();
	assert.equal(plugin.extensions.length, 1);
	assert.equal(state.active, 1);
	plugin.applySettings();
	assert.equal(state.registrations.length, 1);
	plugin.settings.cryptoBlockLanguage = "private";
	plugin.applySettings();
	assert.deepEqual(state.registrations, ["nya", "private"]);
	assert.equal(state.disposals, 1);
	assert.equal(state.active, 1);
	plugin.settings.bracketMatchingEnabled = plugin.settings.cryptoBlockEnabled = false;
	plugin.applySettings();
	assert.equal(plugin.extensions.length, 0);
	assert.equal(state.active, 0);
	assert.equal(state.renders, 3);
	for (const callback of plugin.callbacks) callback();
	assert.equal(state.cleared, 1);
	assert.equal(state.active, 0);
});

test("unrelated setting changes preserve active crypto sessions, and unload disposes the processor", async () => {
	const { state, plugin } = harness();
	await plugin.onload();
	plugin.settings.fetchTitleTimeout = 1234;
	plugin.applySettings();
	assert.equal(state.disposals, 0);
	assert.equal(state.registrations.length, 1);
	assert.equal(state.renders, 0);
	for (const callback of plugin.callbacks) callback();
	assert.equal(state.active, 0);
	assert.equal(state.disposals, 1);
});

test("settings saves use immutable snapshots, serialize writes and recover after failures", async () => {
	const { state, plugin } = harness();
	await plugin.onload();
	const writes = [];
	let release;
	state.save = (value) => { writes.push(value); return writes.length === 1 ? new Promise((resolve) => { release = resolve; }) : Promise.resolve(); };
	plugin.settings.fetchTitleTimeout = 200;
	const first = plugin.saveSettings();
	plugin.settings.fetchTitleTimeout = 300;
	const second = plugin.saveSettings();
	await Promise.resolve();
	assert.equal(writes.length, 1);
	assert.equal(writes[0].fetchTitleTimeout, 200);
	release();
	await Promise.all([first, second]);
	assert.equal(writes[1].fetchTitleTimeout, 300);
	state.save = async () => { throw new Error("disk full"); };
	await assert.rejects(plugin.saveSettings(), /disk full/);
	state.save = async (value) => { writes.push(value); };
	await plugin.saveSettings();
	assert.equal(writes.length, 3);
});

test("invalid persisted identifiers and timeouts fall back safely, while zero is preserved", async () => {
	const { plugin } = harness();
	plugin.data = { cryptoBlockLanguage: {}, fetchTitleTimeout: -10, cryptoAutoLockMinutes: 999 };
	await plugin.loadSettings();
	assert.equal(plugin.settings.cryptoBlockLanguage, DEFAULT_SETTINGS.cryptoBlockLanguage);
	assert.equal(plugin.settings.fetchTitleTimeout, DEFAULT_SETTINGS.fetchTitleTimeout);
	assert.equal(plugin.settings.cryptoAutoLockMinutes, DEFAULT_SETTINGS.cryptoAutoLockMinutes);
	plugin.data = { fetchTitleTimeout: 0 };
	await plugin.loadSettings();
	assert.equal(plugin.settings.fetchTitleTimeout, 0);
});

const processorUrl = urlFor(`
export const MarkdownPreviewRenderer = {
    createCodeBlockPostProcessor(language, handler) { globalThis.processorHarness.handler = handler; return () => {}; },
    registerPostProcessor(processor) { globalThis.processorHarness.registered.push(processor); },
    unregisterPostProcessor(processor) { globalThis.processorHarness.removed.push(processor); },
};
`);
const { codeBlockCrypto } = await import(await moduleUrl("src/features/crypto-block/codeBlockProcessor.ts", {
	"obsidian": processorUrl,
	"react": import.meta.resolve("react"),
	"src/shared/react/ReactRenderChild": urlFor(`export class ReactRenderChild {
    callbacks = [];
    register(callback) { this.callbacks.push(callback); }
    unload() { globalThis.processorHarness.unloads++; this.callbacks.forEach((callback) => callback()); }
}`),
	"./components/CryptoCodeBlockView": urlFor('export const CryptoCodeBlockView = () => null;'),
}));
test("crypto processor disposal unmounts live children once and rejects late callbacks", () => {
	const state = { registered: [], removed: [], unloads: 0 };
	globalThis.processorHarness = state;
	const dispose = codeBlockCrypto({ settings: { cryptoBlockLanguage: "nya" } });
	const children = [];
	const ctx = { addChild: (child) => children.push(child) };
	const el = { empty() {} };
	state.handler("first", el, ctx);
	state.handler("second", el, ctx);
	children[0].unload();
	dispose();
	dispose();
	state.handler("late", el, ctx);
	assert.equal(state.unloads, 2);
	assert.equal(children.length, 2);
	assert.deepEqual(state.removed, state.registered);
});

const hooksUrl = urlFor(`
export const useState = (initial) => {
    const h = globalThis.draftHarness, index = h.index++;
    h.slots[index] ??= { value: initial };
    return [h.slots[index].value, (value) => { h.slots[index].value = value; }];
};
export const useRef = (initial) => {
    const h = globalThis.draftHarness, index = h.index++;
    return h.slots[index] ??= { current: initial };
};
export const useEffect = (callback, deps) => {
    const h = globalThis.draftHarness, index = h.index++, old = h.slots[index];
    if (!old || deps.some((dep, i) => dep !== old.deps[i])) {
        old?.cleanup?.(); h.slots[index] = { deps, cleanup: callback() };
    }
};
`);
const { useDebouncedDraft } = await import(await moduleUrl("src/settings/components/useDebouncedDraft.ts", { "react": hooksUrl }));
test("input drafts debounce, preserve zero, flush on blur/unmount, and reject invalid values", (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const state = { slots: [], index: 0 };
	globalThis.draftHarness = state;
	const commits = [];
	const validate = (value) => value.trim() && Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 10000 ? String(Number(value)) : null;
	const render = (value) => { state.index = 0; return useDebouncedDraft(value, validate, (value) => commits.push(value)); };
	let draft = render("1000");
	draft.change("2"); draft.change("20"); draft.change("200");
	assert.deepEqual(commits, []);
	t.mock.timers.tick(249);
	assert.deepEqual(commits, []);
	t.mock.timers.tick(1);
	assert.deepEqual(commits, ["200"]);
	draft = render("200");
	draft.change("0"); draft.flush();
	assert.deepEqual(commits, ["200", "0"]);
	draft.change("-1"); draft.flush();
	draft.change(""); draft.flush();
	assert.deepEqual(commits, ["200", "0"]);
	draft.change("500");
	draft = render("750"); // External reset cancels a pending draft.
	t.mock.timers.tick(250);
	assert.deepEqual(commits, ["200", "0"]);
	draft.change("600");
	for (const slot of state.slots) slot.cleanup?.();
	assert.deepEqual(commits, ["200", "0", "600"]);
});

const draftUrl = await moduleUrl("src/settings/components/useDebouncedDraft.ts", { "react": hooksUrl });
const { LinkPasteTab } = await import(await moduleUrl("src/settings/tabs/LinkPasteTab.tsx", {
	"react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
	"react-i18next": urlFor('export const useTranslation = () => ({ t: (key) => key });'),
	"../components/SettingControls": urlFor('export const ResetDefaultsItem = () => null, SettingHeading = () => null, SettingItem = () => null, Toggle = () => null;'),
	"../components/useDebouncedDraft": draftUrl,
}));
function findInput(tree) {
	if (!tree || typeof tree !== "object") return undefined;
	if (Array.isArray(tree)) return tree.map(findInput).find(Boolean);
	return tree.type === "input" ? tree : findInput(tree.props?.children);
}
test("link timeout control uses a debounced local draft rather than per-keystroke persistence", (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	globalThis.draftHarness = { slots: [], index: 0 };
	const updates = [];
	const tree = LinkPasteTab({ settings: { ...DEFAULT_SETTINGS }, update: (patch) => updates.push(patch), reset() {} });
	const input = findInput(tree);
	input.props.onChange({ target: { value: "2" } });
	input.props.onChange({ target: { value: "200" } });
	assert.deepEqual(updates, []);
	t.mock.timers.tick(250);
	assert.deepEqual(updates, [{ fetchTitleTimeout: 200 }]);
	input.props.onChange({ target: { value: "0" } });
	input.props.onBlur();
	assert.deepEqual(updates, [{ fetchTitleTimeout: 200 }, { fetchTitleTimeout: 0 }]);
});
