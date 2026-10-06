import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function validateReleaseMetadata({ tag, packageVersion, manifest, versions, builtManifest }) {
	assert.ok(tag, "Supply a release tag as an argument or GITHUB_REF_NAME.");
	assert.equal(tag.replace(/^v/, ""), packageVersion, "Release tag must match package.json version (optional v prefix).");
	assert.equal(manifest.version, packageVersion, "manifest.json and package.json versions must match.");
	assert.equal(versions[packageVersion], manifest.minAppVersion, "versions.json must record this version's minAppVersion.");
	assert.deepEqual(builtManifest, manifest, "dist/manifest.json must match the source manifest; rebuild before releasing.");
}

function main() {
	const root = fileURLToPath(new URL("../", import.meta.url));
	const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
	validateReleaseMetadata({
		tag: process.argv.slice(2).find((argument) => argument !== "--") ?? process.env.GITHUB_REF_NAME,
		packageVersion: readJson("package.json").version,
		manifest: readJson("manifest.json"),
		versions: readJson("versions.json"),
		builtManifest: readJson("dist/manifest.json"),
	});
	for (const name of ["main.js", "manifest.json", "styles.css"]) {
		const stat = statSync(resolve(root, "dist", name));
		assert.ok(stat.isFile() && stat.size > 0, `Release asset dist/${name} must be a nonempty file.`);
	}
	console.log("Release version and all three assets validated.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try { main(); } catch (error) {
		console.error(`Release validation failed: ${error.message}`);
		process.exitCode = 1;
	}
}
