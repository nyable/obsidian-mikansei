import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
	{
		ignores: ["dist/**", "node_modules/**", "*.mjs", "*.js"],
	},
	...tseslint.configs.recommended,
	{
		files: ["src/**/*.{ts,tsx}"],
		plugins: { "react-hooks": reactHooks },
		rules: {
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
