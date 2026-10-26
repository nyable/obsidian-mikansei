import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import builtins from "builtin-modules";

export default tseslint.config(
	{
		ignores: ["dist/**", "node_modules/**", "*.mjs", "*.js"],
	},
	...tseslint.configs.recommended,
	{
		files: ["src/**/*.{ts,tsx}"],
		plugins: { "react-hooks": reactHooks },
		rules: {
			"no-restricted-imports": ["error", {
				paths: [...builtins, "electron"].map((name) => ({ name, message: "Plugin runtime must work on mobile; use browser or Obsidian APIs." })),
				patterns: [{ group: ["node:*", "electron/*", ...builtins.map((name) => `${name}/*`)], message: "Node.js and Electron imports are not available on mobile." }],
			}],
			"no-restricted-globals": ["error", ...["process", "Buffer", "global", "require", "module", "exports", "__dirname", "__filename", "setImmediate", "clearImmediate"].map((name) => ({ name, message: "Do not depend on Node globals in the mobile plugin runtime." }))],
			"react-hooks/rules-of-hooks": "error",
			"react-hooks/exhaustive-deps": "warn",
			"@typescript-eslint/no-unused-vars": ["error", { args: "none" }],
			"@typescript-eslint/ban-ts-comment": "off",
			"@typescript-eslint/no-empty-function": "off",
			"@typescript-eslint/no-inferrable-types": "off",
			"@typescript-eslint/no-explicit-any": "off",
		},
	}
);
