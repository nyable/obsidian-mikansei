import { test } from "node:test";
import assert from "node:assert/strict";
import { validateReleaseMetadata } from "../scripts/check-release.mjs";

const manifest = { id: "mikansei", version: "2.0.0", minAppVersion: "1.1.0" };
const metadata = { tag: "2.0.0", packageVersion: "2.0.0", manifest, versions: { "2.0.0": "1.1.0" }, builtManifest: { ...manifest } };

test("release accepts matching tags with and without the v prefix", () => {
	validateReleaseMetadata(metadata);
	validateReleaseMetadata({ ...metadata, tag: "v2.0.0" });
});

test("release refuses missing or mismatched tags", () => {
	for (const tag of [undefined, "", "2.0.1", "vv2.0.0", "latest"]) {
		assert.throws(() => validateReleaseMetadata({ ...metadata, tag }));
	}
});

test("release refuses inconsistent manifests, version mappings and stale assets", () => {
	for (const override of [
		{ manifest: { ...manifest, version: "1.0.0" } },
		{ versions: {} },
		{ versions: { "2.0.0": "0.15.0" } },
		{ builtManifest: { ...manifest, minAppVersion: "0.15.0" } },
	]) assert.throws(() => validateReleaseMetadata({ ...metadata, ...override }));
});
