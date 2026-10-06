import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

// Run the real TypeScript modules without adding a test framework or changing the bundle.
globalThis.window = { crypto: globalThis.crypto, atob: globalThis.atob, btoa: globalThis.btoa };
const urls = new Map();
const urlFor = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
urls.set("src/i18n", urlFor("export const i18n = { t: (key) => key };"));
async function moduleUrl(path, dependencies = {}) {
	if (urls.has(path)) return urls.get(path);
	const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
	let code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
	for (const [specifier, dependency] of Object.entries(dependencies)) code = code.replaceAll(`from "${specifier}"`, `from "${dependency}"`);
	const url = urlFor(code);
	urls.set(path, url);
	return url;
}
const blockUrl = await moduleUrl("src/features/crypto-block/blockContent.ts");
const cryptoUrl = await moduleUrl("src/features/crypto-block/crypto.ts");
const serviceUrl = await moduleUrl("src/features/crypto-block/cryptoService.ts", {
	"src/i18n": urls.get("src/i18n"), "./blockContent": blockUrl, "./crypto": cryptoUrl,
});
const { captureBlock, locateBlock, replaceBlock, parseFencedBlocks, BlockConflictError } = await import(blockUrl);
const legacy = await import(cryptoUrl);
const { encryptContent, unlockContent, readBundle, safeLanguage, CryptoFormatError, CryptoAuthenticationError, cryptoErrorMessage } = await import(serviceUrl);
const doc = (body, marker = "```") => `before\n${marker}nya\n${body}\n${marker}\nafter`;

test("safe replacement preserves surrounding content and supports undo-sized whole blocks", () => {
	const original = doc("secret");
	assert.equal(replaceBlock(original, captureBlock(original, 1, "nya"), "cipher"), doc("cipher"));
});

test("a unique block can move when unrelated text changes", () => {
	const original = doc("secret");
	const current = `new header\n${original}\nnew footer`;
	assert.equal(replaceBlock(current, captureBlock(original, 1, "nya"), "cipher"), `new header\n${doc("cipher")}\nnew footer`);
});

test("changed and removed targets are never overwritten", () => {
	const original = doc("secret");
	const snapshot = captureBlock(original, 1, "nya");
	assert.throws(() => replaceBlock(doc("changed"), snapshot, "cipher"), BlockConflictError);
	assert.throws(() => replaceBlock("no block", snapshot, "cipher"), BlockConflictError);
});

test("duplicate blocks are supported only when the original document is unchanged", () => {
	const original = `${doc("secret")}\n${doc("secret")}`;
	const snapshot = captureBlock(original, 1, "nya");
	assert.equal(replaceBlock(original, snapshot, "cipher"), `${doc("cipher")}\n${doc("secret")}`);
	assert.throws(() => replaceBlock(`new\n${original}`, snapshot, "cipher"), BlockConflictError);
	assert.throws(() => replaceBlock(`${doc("secret")}\n${doc("secret")}`, captureBlock(doc("secret"), 1, "nya"), "cipher"), BlockConflictError);
});

test("replacement grows fences for embedded Markdown and preserves trailing newlines", () => {
	const original = doc("cipher");
	const plain = "```js\nconst x = 1;\n```\n";
	const result = replaceBlock(original, captureBlock(original, 1, "nya"), plain);
	const block = parseFencedBlocks(result)[0];
	assert.equal(block.marker, "````");
	assert.equal(block.body, plain);
});

test("CRLF notes retain their newline convention", () => {
	const original = doc("secret").replaceAll("\n", "\r\n");
	assert.equal(replaceBlock(original, captureBlock(original, 1, "nya"), "a\nb\n"), doc("a\nb\n").replaceAll("\n", "\r\n"));
});

test("tilde fences, long fences and empty content are handled", () => {
	for (const marker of ["~~~", "`````"]) {
		const original = doc("", marker);
		assert.equal(replaceBlock(original, captureBlock(original, 1, "nya"), "hello"), doc("hello", marker));
	}
	const adjacent = "```nya\n```";
	assert.equal(replaceBlock(adjacent, captureBlock(adjacent, 0, "nya"), "hello"), "```nya\nhello\n```");
});

test("fences inside other code or frontmatter are not treated as targets", () => {
	assert.equal(parseFencedBlocks("````md\n```nya\nsecret\n```\n````").length, 1);
	assert.equal(parseFencedBlocks("---\nvalue: |\n```nya\nsecret\n```\n---\n" + doc("actual")).length, 1);
	assert.equal(parseFencedBlocks("---\n```nya\nsecret\n```").length, 0);
	assert.throws(() => captureBlock("  ```nya\n  secret\n  ```", 0, "nya"), BlockConflictError);
});

test("new service ciphertext can be read by the unchanged legacy crypto implementation", async () => {
	const text = "中文 🔒\n```\n\n";
	const encrypted = await encryptContent(text, " password with spaces ", "public", "typescript");
	assert.equal(legacy.isEncryptedContent(encrypted), true);
	const result = await legacy.decryptAesGcm(encrypted, " password with spaces ");
	assert.equal(result.text, text);
	assert.equal(result.language, "typescript");
	assert.equal(result.remark, "public");
	assert.deepEqual(Object.keys(JSON.parse(legacy.base64ToString(encrypted))).sort(), ["salt", "iv", "text", "iterations", "timestamp", "remark", "language"].sort());
});

test("legacy bundles without language or remark remain readable, including wrapped base64", async () => {
	const bundle = await legacy.encryptAesGcm("old note", " ");
	delete bundle.language;
	delete bundle.remark;
	const encrypted = legacy.stringToBase64(JSON.stringify(bundle));
	const wrapped = encrypted.match(/.{1,50}/g).join("\n ");
	assert.equal(readBundle(wrapped).language, "text");
	const result = await unlockContent(wrapped, " ");
	assert.equal(result.text, "old note");
	assert.equal(result.language, "text");
	assert.equal(result.remark, "");
});

test("authentication failures and format failures have distinct error messages", async () => {
	const encrypted = await encryptContent("secret", "correct", "", "text");
	await assert.rejects(unlockContent(encrypted, "wrong"), CryptoAuthenticationError);
	await assert.rejects(unlockContent("not a bundle", "wrong"), CryptoFormatError);
	assert.equal(cryptoErrorMessage(new BlockConflictError()), "crypto.ui.conflict");
	assert.equal(cryptoErrorMessage(new CryptoAuthenticationError()), "crypto.notice.decryptFailedWrongPassword");
});

test("malformed crypto fields and excessive KDF work are rejected before decrypting", async () => {
	const bundle = await legacy.encryptAesGcm("secret", "correct");
	for (const overrides of [{ iterations: 1e20 }, { iterations: 10_000_001 }, { iterations: 999 }, { iterations: 1000.1 }, { salt: "YQ==" }, { iv: "YQ==" }, { text: "YQ==" }, { remark: {} }, { language: [] }]) {
		assert.equal(readBundle(legacy.stringToBase64(JSON.stringify({ ...bundle, ...overrides }))), null);
	}
});

test("changing passwords decrypts once then replaces, rather than nesting ciphertext", async () => {
	const original = await encryptContent("secret", "old", "remark", "js");
	const plain = await unlockContent(original, "old");
	const updated = await encryptContent(plain.text, "new", plain.remark, plain.language);
	assert.equal((await unlockContent(updated, "new")).text, "secret");
	await assert.rejects(unlockContent(updated, "old"), CryptoAuthenticationError);
	assert.equal((await unlockContent(original, "old")).text, "secret");
});

test("render language cannot inject newlines or Markdown fences", () => {
	assert.equal(safeLanguage("js\n```nya"), "text");
	assert.equal(safeLanguage("c++"), "c++");
	assert.equal(safeLanguage("c#"), "c#");
});

test("Chinese and English translation keys match", async () => {
	const zh = (await import(await moduleUrl("src/i18n/locales/zh-CN.ts"))).default;
	const en = (await import(await moduleUrl("src/i18n/locales/en.ts"))).default;
	function keys(object, prefix = "") {
		return Object.entries(object).flatMap(([key, value]) => typeof value === "object" ? keys(value, prefix + key + ".") : [prefix + key]).sort();
	}
	assert.deepEqual(keys(en), keys(zh));
});

test("auto-lock respects idle time, disabled timer, active operations and dirty drafts", async () => {
	const { autoLockDecision } = await import(await moduleUrl("src/features/crypto-block/autoLock.ts"));
	assert.equal(autoLockDecision(5, 1000, 300999, false, false), "wait");
	assert.equal(autoLockDecision(5, 1000, 301000, false, false), "lock");
	assert.equal(autoLockDecision(0, 0, 9000000, false, false), "wait");
	assert.equal(autoLockDecision(5, 0, 9000000, true, false), "wait");
	assert.equal(autoLockDecision(5, 0, 9000000, false, true), "pause");
	assert.equal(autoLockDecision(5, 8999999, 9000000, false, false), "wait");
});

const obsidianUrl = urlFor(`
export class TFile { constructor(path) { this.path = path; } }
export class MarkdownView { constructor(file, editor, mode = "source") { this.file = file; this.editor = editor; this.mode = mode; } getMode() { return this.mode; } }
`);
const { TFile, MarkdownView } = await import(obsidianUrl);
const { captureTarget, writeTarget } = await import(await moduleUrl("src/features/crypto-block/blockStorage.ts", {
	"obsidian": obsidianUrl, "./blockContent": blockUrl, "src/i18n": urls.get("src/i18n"),
}));
function storageApp(document, withEditor = true) {
	const file = new TFile("note.md");
	let disk = document;
	let live = document;
	let writes = 0;
	let ranges = 0;
	const editor = {
		getValue: () => live,
		getLine: (line) => live.split("\n")[line],
		replaceRange: (replacement, from, to) => {
			const lines = live.split("\n");
			lines.splice(from.line, to.line - from.line + 1, replacement);
			live = lines.join("\n");
			ranges++;
		},
	};
	const leaves = withEditor ? [{ view: new MarkdownView(file, editor) }] : [];
	return {
		workspace: { getLeavesOfType: () => leaves },
		vault: {
			getAbstractFileByPath: () => file,
			read: async () => disk,
			process: async (target, callback) => { const result = callback(disk); disk = result; writes++; },
		},
		state: () => ({ disk, live, writes, ranges }),
		setLive: (value) => { live = value; },
		setDisk: (value) => { disk = value; },
		leaves, file, editor,
	};
}

test("storage writes through the live editor, preserving unsaved edits and a single undo transaction", async () => {
	const app = storageApp(doc("secret"));
	const target = await captureTarget(app, "note.md", 1, "nya");
	app.setLive("unsaved header\n" + doc("secret"));
	await writeTarget(app, target, "cipher");
	assert.deepEqual(app.state(), { disk: doc("secret"), live: "unsaved header\n" + doc("cipher"), writes: 0, ranges: 1 });
});

test("read-mode editor buffers are ignored in favor of atomic vault processing", async () => {
	const app = storageApp(doc("secret"));
	app.leaves[0].view.mode = "preview";
	app.setLive("stale editor buffer");
	const target = await captureTarget(app, "note.md", 1, "nya");
	app.setDisk("external change\n" + doc("secret"));
	await writeTarget(app, target, "cipher");
	assert.equal(app.state().disk, "external change\n" + doc("cipher"));
	assert.equal(app.state().ranges, 0);
});

test("atomic vault conflicts leave the file unchanged", async () => {
	const app = storageApp(doc("secret"), false);
	const target = await captureTarget(app, "note.md", 1, "nya");
	app.setDisk(doc("different"));
	await assert.rejects(writeTarget(app, target, "cipher"), BlockConflictError);
	assert.equal(app.state().disk, doc("different"));
	assert.equal(app.state().writes, 0);
});

test("divergent editor buffers are refused instead of choosing an arbitrary pane", async () => {
	const app = storageApp(doc("secret"));
	app.leaves.push({ view: new MarkdownView(app.file, { getValue: () => doc("different") }) });
	await assert.rejects(captureTarget(app, "note.md", 1, "nya"), BlockConflictError);
});

const reactDependencies = {
	"react": import.meta.resolve("react"),
	"react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
	"lucide-react": import.meta.resolve("lucide-react"),
	"react-i18next": urlFor('export const useTranslation = () => ({ t: (key) => key });'),
};
const previewObsidianUrl = urlFor(`
export class Component {
    constructor() { this.children = []; this.callbacks = []; this.loaded = false; this.unloads = 0; }
    load() { this.loaded = true; }
    unload() { this.unloads++; this.loaded = false; this.onunload?.(); for (const child of this.children) child.unload(); this.children = []; for (const callback of this.callbacks) callback(); this.callbacks = []; }
    addChild(child) { this.children.push(child); if (this.loaded) child.load(); return child; }
    removeChild(child) { this.children = this.children.filter((item) => item !== child); child.unload(); return child; }
    register(callback) { this.callbacks.push(callback); }
}
export const renderCalls = [];
export const MarkdownRenderer = { render: async (...args) => { renderCalls.push(args); await globalThis.previewRenderHook?.(...args); } };
`);
const previewUrl = await moduleUrl("src/features/crypto-block/previewRendering.ts", {
	"obsidian": previewObsidianUrl, "./cryptoService": serviceUrl,
});
const { createElement } = await import("react");
const { CryptoCodeBlockView } = await import(await moduleUrl("src/features/crypto-block/components/CryptoCodeBlockView.tsx", {
	...reactDependencies,
	"obsidian": urlFor('export class Notice {} export class Menu {}'),
	"src/shared/confirmModal": urlFor('export const confirmModal = async () => false;'),
	"../CryptoConfirmModal": urlFor('export const askDirtyAction = async () => "continue"; export const openCryptoDialog = async () => false;'),
	"../CryptoEditModal": urlFor('export const openCryptoEditor = () => ({ finished: Promise.resolve(), dispose() {} });'),
	"../crypto": cryptoUrl,
	"../blockStorage": urls.get("src/features/crypto-block/blockStorage.ts"),
	"../blockContent": blockUrl,
	"../cryptoService": serviceUrl,
	"../autoLock": await moduleUrl("src/features/crypto-block/autoLock.ts"),
	"../previewRendering": previewUrl,
}));
const view = (source) => renderToStaticMarkup(createElement(CryptoCodeBlockView, {
	source, el: {}, ctx: { sourcePath: "note.md" }, plugin: { settings: { cryptoBlockHeight: 300, cryptoAutoLockMinutes: 5 } },
}));

test("locked UI never exposes plaintext, copy or repeat-encryption actions", async () => {
	const html = view(await encryptContent("very private secret", "password", "public remark", "js"));
	assert.match(html, /public remark/);
	assert.match(html, /crypto.ui.unlock/);
	assert.match(html, /aria-label="crypto.ui.decryptPermanent"/);
	assert.doesNotMatch(html, /very private secret|crypto.action.encrypt|crypto.action.copy/);
	assert.match(html, /<button/);
	assert.doesNotMatch(html, /role="button"/);
});

test("plaintext UI escapes markup and supports encryption and copy", () => {
	const html = view('<script>alert("secret")</script>\n```');
	assert.match(html, /&lt;script&gt;/);
	assert.doesNotMatch(html, /<script>/);
	assert.match(html, /crypto.action.encrypt/);
	assert.match(html, /crypto.action.copy/);
	assert.match(html, /crypto.action.preview/);
	assert.match(html, /remark-text/);
	assert.doesNotMatch(html, /<pre|<code|crypto-block-header/);
	assert.doesNotMatch(html, /crypto.ui.unlock</);
});

const { previewMarkdown, renderCryptoPreview } = await import(previewUrl);
const { Component, renderCalls } = await import(previewObsidianUrl);

function previewContainer() {
	const host = { removed: false, content: "", remove() { this.removed = true; }, replaceChildren() { this.content = ""; } };
	const container = { ownerDocument: { createElement: () => host }, replaceChildren(node) { this.host = node; } };
	return { host, container };
}

test("preview Markdown forwards plugin language and keeps embedded fences inside a single block", () => {
	const text = "```js\nhello\n```\n`````\n";
	const markdown = previewMarkdown(text, "dataview");
	const [block] = parseFencedBlocks(markdown);
	assert.equal(block.language, "dataview");
	assert.equal(block.body, text);
	assert.equal(block.marker, "``````");
	assert.equal(parseFencedBlocks(markdown).length, 1);
	assert.equal(previewMarkdown("", "mermaid"), "```mermaid\n\n```");
});

test("preview delegates to Obsidian with the source path and an independently owned component", async () => {
	const parent = new Component(); parent.load();
	const app = {};
	const { host, container } = previewContainer();
	const preview = renderCryptoPreview(app, parent, container, "folder/note.md", "graph TD; A-->B", "mermaid");
	await preview.finished;
	const [renderApp, markdown, renderHost, path, owner] = renderCalls.at(-1);
	assert.equal(renderApp, app);
	assert.equal(renderHost, host);
	assert.equal(path, "folder/note.md");
	assert.equal(markdown, "```mermaid\ngraph TD; A-->B\n```");
	assert.notEqual(owner, parent);
	assert.equal(owner.loaded, true);
	const pluginChild = owner.addChild(new Component());
	preview.dispose(); preview.dispose();
	assert.equal(pluginChild.unloads, 1);
	assert.equal(owner.unloads, 1);
	assert.equal(parent.children.length, 0);
	assert.equal(host.removed, true);
});

test("late async processors cannot resurrect a closed preview or retain registered resources", async () => {
	let complete;
	globalThis.previewRenderHook = () => new Promise((resolve) => { complete = resolve; });
	try {
		const parent = new Component(); parent.load();
		const { host, container } = previewContainer();
		const preview = renderCryptoPreview({}, parent, container, "note.md", "secret", "dataview");
		const owner = renderCalls.at(-1)[4];
		preview.dispose();
		const lateChild = owner.addChild(new Component());
		assert.equal(lateChild.unloads, 1);
		let released = false;
		owner.register(() => { released = true; });
		assert.equal(released, true);
		host.content = "late plaintext";
		complete();
		await preview.finished;
		assert.equal(host.content, "");
		assert.equal(host.removed, true);
	} finally { delete globalThis.previewRenderHook; }
});

test("parent unload cleans up code block processor children", async () => {
	const parent = new Component(); parent.load();
	const { host, container } = previewContainer();
	const preview = renderCryptoPreview({}, parent, container, "note.md", "secret", "text");
	await preview.finished;
	const owner = renderCalls.at(-1)[4];
	const child = owner.addChild(new Component());
	parent.unload();
	assert.equal(child.unloads, 1);
	assert.equal(owner.loaded, false);
	assert.equal(host.removed, true);
	assert.equal(host.content, "");
});

test("parent unload during rendering also clears output from late async processors", async () => {
	let complete;
	globalThis.previewRenderHook = () => new Promise((resolve) => { complete = resolve; });
	try {
		const parent = new Component(); parent.load();
		const { host, container } = previewContainer();
		const preview = renderCryptoPreview({}, parent, container, "note.md", "secret", "dataview");
		parent.unload();
		host.content = "late secret";
		complete();
		await preview.finished;
		assert.equal(host.content, "");
		assert.equal(host.removed, true);
	} finally { delete globalThis.previewRenderHook; }
});

test("third-party code block rendering output is left intact until preview cleanup", async () => {
	const parent = new Component(); parent.load();
	const { host, container } = previewContainer();
	let child;
	globalThis.previewRenderHook = async (app, markdown, node, path, owner) => {
		const [block] = parseFencedBlocks(markdown);
		assert.equal(block.language, "dataview");
		assert.equal(block.body, "LIST FROM #notes");
		child = owner.addChild(new Component());
		node.content = "third-party query results with custom controls";
	};
	try {
		const preview = renderCryptoPreview({}, parent, container, "note.md", "LIST FROM #notes", "dataview");
		await preview.finished;
		assert.equal(host.content, "third-party query results with custom controls");
		assert.equal(child.loaded, true);
		preview.dispose();
		assert.equal(host.content, "");
		assert.equal(child.unloads, 1);
	} finally { delete globalThis.previewRenderHook; }
});

test("failed rendering can dispose all partially registered processor resources", async () => {
	const parent = new Component(); parent.load();
	const { host, container } = previewContainer();
	let child;
	globalThis.previewRenderHook = async (app, markdown, node, path, owner) => {
		child = owner.addChild(new Component());
		node.content = "partially rendered secret";
		throw new Error("processor failure");
	};
	try {
		const preview = renderCryptoPreview({}, parent, container, "note.md", "secret", "dataview");
		await assert.rejects(preview.finished, /processor failure/);
		preview.dispose();
		assert.equal(host.content, "");
		assert.equal(child.unloads, 1);
		assert.equal(parent.children.length, 0);
	} finally { delete globalThis.previewRenderHook; }
});

test("malformed encrypted bundles disable unlocking rather than offering repeat encryption", () => {
	const html = view(legacy.stringToBase64(JSON.stringify({ salt: "YQ==", iv: "YQ==", text: "YQ==", iterations: 250000, timestamp: 1 })));
	assert.match(html, /crypto.notice.decryptFailedBadFormat/);
	assert.match(html, /disabled=""/);
	assert.doesNotMatch(html, /crypto.action.encrypt/);
});

const { PasswordField } = await import(await moduleUrl("src/features/crypto-block/components/PasswordField.tsx", reactDependencies));
test("password inputs are masked by default and use accessible native buttons", () => {
	const html = renderToStaticMarkup(createElement(PasswordField, { label: "Password", value: "", onChange: () => {}, newPassword: true }));
	assert.match(html, /type="password"/);
	assert.match(html, /autoComplete="new-password"/);
	assert.match(html, /aria-label="crypto.dialog.showPassword"/);
});
