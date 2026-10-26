import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";

const eslint = new ESLint({ cwd: fileURLToPath(new URL("../", import.meta.url)) });
async function rulesFor(code, filePath = "src/mobile-constraint-check.ts") {
	const [result] = await eslint.lintText(code, { filePath });
	return result.messages.map((message) => message.ruleId);
}

test("runtime lint rejects Node and Electron imports including prefixed and subpath forms", async () => {
	for (const source of ["fs", "fs/promises", "node:fs", "node:fs/promises", "path", "crypto", "electron", "electron/main"]) {
		const rules = await rulesFor(`import * as api from ${JSON.stringify(source)}; console.log(api);`);
		assert.ok(rules.includes("no-restricted-imports"), `Runtime import escaped mobile constraint: ${source}`);
	}
});

test("runtime lint rejects Node globals without confusing normal object properties", async () => {
	for (const name of ["process", "Buffer", "global", "require", "module", "exports", "__dirname", "__filename", "setImmediate", "clearImmediate"]) {
		assert.ok((await rulesFor(`console.log(${name});`)).includes("no-restricted-globals"), `${name} must be restricted`);
	}
	assert.deepEqual(await rulesFor('const vault = { process: () => {} }; vault.process(); console.log(window.crypto);'), []);
});

test("mobile constraints allow browser and host APIs and do not ban Node in build configuration", async () => {
	assert.deepEqual(await rulesFor('import { Notice } from "obsidian"; new Notice(String(window.crypto));'), []);
	assert.deepEqual(await rulesFor('import { readFileSync } from "node:fs"; console.log(readFileSync, process.env.NODE_ENV);', "vite.config.mts"), []);
});
