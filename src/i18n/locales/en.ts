const en = {
	command: {
		bracketJump: "Jump to bracket",
		bracketSelect: "Select to bracket",
		cryptoEncrypt: "Encrypt code block",
		cryptoDecrypt: "Decrypt code block",
	},
	tabs: {
		general: "General",
		linkPaste: "Link Paste",
		bracket: "Bracket Matching",
		crypto: "Crypto Code Block",
		misc: "Misc",
	},
	linkPaste: {
		asLink: "As link",
		asText: "As text",
		asImage: "As image",
	},
	crypto: {
		status: {
			encrypted: "Encrypted",
			unencrypted: "Not encrypted",
		},
		remark: {
			empty: "(No remark)",
			parseFailed: "(Failed to parse)",
		},
		action: {
			decrypt: "Decrypt",
			encrypt: "Encrypt",
			preview: "Preview content",
			copy: "Copy content",
			closePreview: "Close preview",
		},
		dialog: {
			encryptTitle: "Encrypt code block",
			decryptTitle: "Decrypt code block",
			password: "Password",
			confirmPassword: "Confirm password",
			remarks: "Display text (remark)",
			language: "Render language",
			passwordPlaceholder: "Enter password",
			confirmPasswordPlaceholder: "Re-enter password",
			remarksPlaceholder: "Enter a remark",
			languagePlaceholder: "text",
			showPassword: "Show password",
			hidePassword: "Hide password",
			submitEncrypt: "Encrypt",
			submitDecrypt: "Decrypt",
			hint: "Tip: press Ctrl/Cmd + Enter to submit",
			error: {
				passwordEmpty: "Password cannot be empty",
				passwordTooShort: "Password must be at least {{min}} characters",
				confirmRequired: "Please confirm the password",
				passwordMismatch: "Passwords do not match",
				remarksEmpty: "Remark cannot be empty",
			},
		},
		notice: {
			emptyBlock: "The encrypted block is empty or invalid.",
			notEncrypted:
				"⚠️ This block is not encrypted, nothing to decrypt\nNote: only encrypted content can be decrypted",
			alreadyEncrypted: "⚠️ This block is already encrypted",
			cancelled: "Operation cancelled",
			passwordEmpty: "❌ Password cannot be empty",
			encrypting: "🔐 Encrypting...",
			encryptSuccess: "✅ Encryption succeeded",
			decryptEmpty: "⚠️ The encrypted block is empty, nothing to decrypt",
			decrypting: "🔓 Decrypting...",
			decryptSuccess: "✅ Decryption succeeded",
			decryptToFileSuccess: "✅ Decrypted and replaced with plain text",
			copyPlainSuccess: "✅ Content copied to clipboard",
			copyDecryptedSuccess: "✅ Decrypted content copied to clipboard",
			decryptFailedWrongPassword:
				"❌ Decryption failed: wrong password or corrupted data",
			decryptFailedBadFormat:
				"❌ Decryption failed: invalid data format, possibly corrupted",
			decryptFailedEncoding: "❌ Decryption failed: data encoding error",
			decryptFailedStructure:
				"❌ Decryption failed: corrupted data structure",
			decryptFailedGeneric: "❌ Decryption failed: {{message}}",
			encryptFailedPassword:
				"❌ Encryption failed: password processing error",
			encryptFailedTooLarge: "❌ Encryption failed: content too large",
			encryptFailedGeneric: "❌ Encryption failed: {{message}}",
		},
		error: {
			noFile: "File not found",
			noSectionInfo: "Could not locate the code block",
			unexpectedDecryptResult:
				"Decryption returned an unexpected result",
			unknown: "Unknown error",
		},
	},
	settings: {
		general: {
			heading: "General",
			language: {
				name: "Language",
				desc: "Interface language. Command names take effect after reloading Obsidian.",
				auto: "Auto (follow Obsidian)",
				zhCN: "简体中文",
				en: "English",
			},
		},
		linkPaste: {
			heading: "Link Paste Enhancer",
			desc: "Show options when pasting a link",
		},
		fetchTitle: {
			name: "Fetch page title",
			desc: "Use the URL's <title> as the link title",
		},
		fetchTimeout: {
			name: "Fetch title timeout (ms)",
			desc: "Use the default title after this timeout",
		},
		bracket: {
			heading: "Bracket Matching",
			desc: "Highlight matching brackets and provide jump/select commands",
		},
		bracketStyle: {
			name: "Highlight style",
			desc: "How matched brackets are highlighted",
			border: "Outline",
			underline: "Underline",
			background: "Background",
			text: "Text color",
		},
		bracketMatchColor: {
			name: "Matched color",
			desc: "Color of matched brackets (supports transparency)",
		},
		bracketMissColor: {
			name: "Unmatched color",
			desc: "Color of unmatched brackets (supports transparency)",
		},
		bracketHighlightUnmatched: {
			name: "Highlight unmatched brackets",
			desc: "When off, unmatched brackets are not marked",
		},
		crypto: {
			heading: "Crypto Code Block",
			desc: "Render encrypted code blocks",
		},
		cryptoLanguage: {
			name: "Crypto block language",
			desc: "Custom language identifier for encrypted blocks (e.g. ```nya). Requires reloading the plugin.",
		},
		cryptoHeight: {
			name: "Preview max height (px)",
			desc: "Max height of the decrypted preview area, default 300px",
		},
		reload: {
			name: "Reload Obsidian",
			desc: "Reload Obsidian to apply some settings",
			button: "Reload",
		},
		reset: {
			tabName: "Restore defaults",
			tabDesc: "Reset this tab's settings to their defaults",
			allName: "Restore all default settings",
			allDesc: "Reset all plugin settings to their defaults",
			button: "Restore",
			confirmTitle: "Restore defaults",
			confirmMessage: "Restore these settings to their defaults?",
			confirm: "Restore",
			cancel: "Cancel",
			done: "Defaults restored",
		},
		color: {
			open: "Pick a color",
		},
		languageChanged:
			"Language changed. Command names will update after reloading Obsidian.",
	},
};

export default en;
