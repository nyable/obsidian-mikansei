import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const urlFor = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
async function moduleUrl(path, dependencies = {}) {
	const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
	let code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
	for (const [specifier, dependency] of Object.entries(dependencies)) code = code.replaceAll(`from "${specifier}"`, `from "${dependency}"`);
	return urlFor(code);
}
const i18nUrl = urlFor('export const i18n = { t: (key) => key };');
const { enhanceLinkPaste } = await import(await moduleUrl("src/features/link-paste/linkPasteEnhancer.ts", {
	"obsidian": urlFor('export class Notice { constructor(message) { globalThis.linkHarness.notices.push(message); } }'),
	"src/shared/http": urlFor('export const getUrlTitle = (...args) => globalThis.linkHarness.fetch(...args);'),
	"src/i18n": i18nUrl,
	"./LinkActionModal": urlFor('export class LinkActionModal { constructor() { globalThis.linkHarness.modal = this; } open() {} }'),
}));

function editorFor(initial = "before SELECT after") {
	let text = initial;
	let from = 7, to = 13;
	const offsetToPos = (offset) => {
		const lines = text.slice(0, offset).split("\n");
		return { line: lines.length - 1, ch: lines.at(-1).length };
	};
	const posToOffset = (pos) => text.split("\n").slice(0, pos.line).reduce((sum, line) => sum + line.length + 1, 0) + pos.ch;
	return {
		getValue: () => text,
		getCursor: (side) => offsetToPos(side === "to" ? to : from),
		posToOffset, offsetToPos,
		setSelection(a, b) { from = posToOffset(a); to = posToOffset(b); },
		setCursor(pos) { from = to = posToOffset(pos); },
		somethingSelected: () => from !== to,
		replaceRange(value, a, b = a) { const start = posToOffset(a), end = posToOffset(b); text = text.slice(0, start) + value + text.slice(end); from = to = start + value.length; },
	};
}
function linkHarness(options = {}) {
	let handler, unload;
	const state = { notices: [], requests: [], info: { file: { path: "original.md" } }, async fetch(...args) { this.requests.push(args); return "Fetched title"; }, ...options };
	globalThis.linkHarness = state;
	const plugin = {
		settings: { linkPasteEnhancer: true, fetchTitle: true, fetchTitleTimeout: 1000 },
		register(callback) { unload = callback; }, registerEvent() {},
		app: { workspace: { on(name, callback) { handler = callback; } } },
	};
	enhanceLinkPaste(plugin);
	return {
		state, plugin, unload: () => unload(),
		paste(text, editor = editorFor(), prevented = false) {
			const evt = { defaultPrevented: prevented, clipboardData: { getData: () => text }, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {} };
			handler(evt, editor, state.info);
			return { evt, editor };
		},
		choose(index) { const item = state.modal.getSuggestions("")[index]; return item.callback(item.value); },
	};
}

test("invalid URLs and already-handled paste events preserve native paste", () => {
	for (const value of ["https://example.com hello", "https://", "plain text", "https://example.com\nsecond line"]) {
		const h = linkHarness();
		assert.equal(h.paste(value).evt.defaultPrevented, false);
		assert.equal(h.state.modal, undefined);
	}
	const h = linkHarness();
	h.paste("https://example.com", editorFor(), true);
	assert.equal(h.state.modal, undefined);
	h.plugin.settings.linkPasteEnhancer = false;
	assert.equal(h.paste("https://example.com").evt.defaultPrevented, false);
});

test("malformed URI escapes do not swallow paste, and settings are read at action time", async () => {
	const h = linkHarness();
	const { editor, evt } = h.paste("https://example.com/%E4");
	assert.equal(evt.defaultPrevented, true);
	h.plugin.settings.fetchTitle = false;
	await h.choose(0);
	assert.equal(editor.getValue(), "before [%E4](https://example.com/%E4) after");
	assert.equal(h.state.requests.length, 0);
});

test("image title replacement and Markdown escaping work without negative cursor offsets", async () => {
	const h = linkHarness({ async fetch(...args) { this.requests.push(args); return "Title [x]\nnext"; } });
	const { editor } = h.paste("https://example.com/a(b)");
	h.plugin.settings.fetchTitleTimeout = 2500;
	await h.choose(2);
	assert.equal(editor.getValue(), "before ![Title \\[x\\] next](https://example.com/a%28b%29) after");
	assert.equal(h.state.requests[0][1], 2500);
	assert.equal(editor.getCursor("from").ch, 9);
});

test("modal insertion uses captured coordinates and rejects edits made before choosing", async () => {
	const h = linkHarness();
	const { editor } = h.paste("https://example.com/path");
	editor.setCursor({ line: 0, ch: 0 });
	await h.choose(1);
	assert.equal(editor.getValue(), "before https://example.com/path after");
	const second = linkHarness();
	const current = second.paste("https://example.com/path").editor;
	current.replaceRange("changed", { line: 0, ch: 0 });
	const expected = current.getValue();
	await second.choose(0);
	assert.equal(current.getValue(), expected);
	assert.deepEqual(second.state.notices, ["linkPaste.documentChanged"]);
});

test("late fetched titles never overwrite typing, cursor movement, disable or unload", async () => {
	for (const change of [
		(h, editor) => editor.replaceRange("typing", { line: 0, ch: 0 }),
		(h, editor) => editor.setCursor({ line: 0, ch: 0 }),
		(h) => { h.state.info.file = { path: "another.md" }; },
		(h) => { h.plugin.settings.linkPasteEnhancer = false; },
		(h) => h.unload(),
	]) {
		let resolve;
		const h = linkHarness({ fetch: () => new Promise((done) => { resolve = done; }) });
		const { editor } = h.paste("https://example.com/path");
		const pending = h.choose(0);
		assert.equal(editor.getValue(), "before [path](https://example.com/path) after");
		change(h, editor);
		const expected = editor.getValue();
		resolve("Late title");
		await pending;
		assert.equal(editor.getValue(), expected);
	}
});

const { EditorState, StateField } = await import("@codemirror/state");
const field = StateField.define({ create: () => undefined, update: (value) => value });
globalThis.bracketField = field;
const bracketObsUrl = urlFor('export const editorInfoField = globalThis.bracketField; export class MarkdownView {}');
const { MarkdownView } = await import(bracketObsUrl);
const { highlightBracket, currentBracketMatch } = await import(await moduleUrl("src/features/bracket-matching/bracketMatching.ts", {
	"obsidian": bracketObsUrl,
	"@codemirror/language": urlFor(`export const bracketMatching = (config) => config; export { matchBrackets } from ${JSON.stringify(import.meta.resolve("@codemirror/language"))};`),
	"@codemirror/view": urlFor('export const Decoration = { mark: () => ({ range: (from, to) => ({ from, to }) }) };'),
}));
const { registerBracketCommands } = await import(await moduleUrl("src/features/bracket-matching/bracketCommands.ts", {
	"obsidian": bracketObsUrl, "src/i18n": i18nUrl,
	"./bracketMatching": urlFor('export const currentBracketMatch = (...args) => globalThis.getBracketMatch(...args);'),
}));
globalThis.getBracketMatch = currentBracketMatch;

function bracketEditor(text) {
	const editor = editorFor(text);
	editor.setCursor({ line: 0, ch: 0 });
	const state = EditorState.create({ doc: text, extensions: [field.init(() => ({ editor }))] });
	const config = highlightBracket({ settings: { highlightUnmatchedBrackets: true } });
	config.renderMatch({ matched: true, start: { from: 0, to: 1 }, end: { from: text.length - 1, to: text.length } }, state);
	return { editor, state };
}

test("bracket commands resolve each editor independently and reject stale document offsets", () => {
	const first = bracketEditor("(one)");
	const second = bracketEditor("(two longer)");
	assert.equal(currentBracketMatch(first.editor).end.to, 5);
	assert.equal(currentBracketMatch(second.editor).end.to, 12);
	first.editor.setCursor({ line: 0, ch: 3 });
	assert.equal(currentBracketMatch(first.editor), null);
	first.editor.replaceRange("edit", { line: 0, ch: 0 });
	assert.equal(currentBracketMatch(first.editor), null);
	assert.equal(currentBracketMatch(editorFor()), null);
});

test("bracket jump is bidirectional, and disabled commands cannot run", () => {
	const { editor } = bracketEditor("(one)");
	const commands = [];
	const plugin = { settings: { bracketMatchingEnabled: true }, addCommand: (command) => commands.push(command) };
	registerBracketCommands(plugin);
	const view = new MarkdownView();
	assert.equal(commands[0].editorCheckCallback(false, editor, view), true);
	assert.equal(editor.getCursor().ch, 5);
	commands[0].editorCheckCallback(false, editor, view);
	assert.equal(editor.getCursor().ch, 1);
	plugin.settings.bracketMatchingEnabled = false;
	for (const command of commands) assert.equal(command.editorCheckCallback(false, editor, view), false);
});

const { getUrlTitle } = await import(await moduleUrl("src/shared/http.ts", {
	"obsidian": urlFor('export const requestUrl = (...args) => globalThis.httpHarness.request(...args);'),
	"cheerio": import.meta.resolve("cheerio"),
}));
test("title fetching skips zero, extracts entities and clears timeout timers", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const requests = [];
	globalThis.httpHarness = { async request(options) { requests.push(options); return { text: "<title> A &amp; B </title>" }; } };
	assert.equal(await getUrlTitle("https://example.com", 0), "");
	assert.equal(requests.length, 0);
	assert.equal(await getUrlTitle("https://example.com"), "A & B");
	assert.equal(requests.length, 1);
	let resolve;
	globalThis.httpHarness.request = () => new Promise((done) => { resolve = done; });
	const pending = getUrlTitle("https://example.com", 100);
	t.mock.timers.tick(100);
	assert.equal(await pending, "");
	resolve({ text: "<title>Late</title>" });
	globalThis.httpHarness.request = async () => { throw null; };
	t.mock.method(console, "warn", () => {});
	assert.equal(await getUrlTitle("https://example.com"), "");
});
