import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { build } from "vite";

// Test the actual Vite configuration without depending on stale dist files or writing assets.
for (const mode of ["production", "development"]) {
	test(`${mode} bundle loads without Node globals or desktop-only modules`, async () => {
		const result = await build({
			configFile: fileURLToPath(new URL("../vite.config.mts", import.meta.url)),
			mode, logLevel: "silent", build: { write: false, emptyOutDir: false, sourcemap: false },
		});
		const output = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output);
		const entry = output.find((item) => item.type === "chunk" && item.fileName === "main.js");
		assert.ok(entry);
		const allowedImports = ["obsidian", "@codemirror/language", "@codemirror/state", "@codemirror/view"];
		// Inspect all declared imports too, not just require calls reached during evaluation.
		for (const item of output.filter((item) => item.type === "chunk")) {
			for (const id of [...item.imports, ...item.dynamicImports]) {
				assert.ok(allowedImports.includes(id), `Unsupported mobile import: ${id}`);
			}
		}
		assert.doesNotMatch(entry.code, /process\.env\.NODE_ENV/);
		assert.equal(output.filter((item) => item.type === "chunk").length, 1);
		assert.ok(output.some((item) => item.fileName === "manifest.json"));
		assert.ok(output.some((item) => item.fileName === "styles.css"));
		const stub = new Proxy(class {}, { get: () => class {} });
		const sandbox = {
			module: { exports: {} }, exports: {}, console, atob, btoa, setTimeout, clearTimeout,
			require(id) {
				assert.ok(allowedImports.includes(id), `Unsupported mobile import: ${id}`);
				return stub;
			},
		};
		vm.runInNewContext(entry.code, sandbox, { timeout: 5000 });
		assert.equal(typeof sandbox.module.exports, "function");
	});
}
