<script lang="ts">
	import type { CryptoConfirmData } from "src/extension/CodeBlockCrypto";

	interface PasswordConfirmFormProps {
		submitHandler: (data: CryptoConfirmData) => void;
	}
	const props: PasswordConfirmFormProps = $props();
	let password = $state("");
	let confirmPassword = $state("");
	let remarks = $state("");
	const minPasswordLength = 1;

	let passwordErrorMessage = $state("");
	let confirmPasswordErrorMessage = $state("");
	let remarksErrorMessage = $state("");

	function validatePassword() {
		if (password.length > 0 && password.length < minPasswordLength) {
			passwordErrorMessage = `密码长度不能少于 ${minPasswordLength} 个字符`;
		} else {
			passwordErrorMessage = "";
		}
		validateConfirmPassword(); // Also validate confirm password when password changes
	}

	function validateConfirmPassword() {
		if (confirmPassword.length > 0 && password !== confirmPassword) {
			confirmPasswordErrorMessage = "两次输入的密码不一致";
		} else {
			confirmPasswordErrorMessage = "";
		}
	}

	function validateRemarks() {
		if (remarks.trim() === "") {
			remarksErrorMessage = "备注不能为空";
		} else {
			remarksErrorMessage = "";
		}
	}

	// 是否可以提交的状态
	let canSubmit = $derived(
		password.length >= minPasswordLength &&
			password === confirmPassword &&
			remarks.trim() !== "" &&
			!passwordErrorMessage && // Error messages should be empty strings when valid
			!confirmPasswordErrorMessage &&
			!remarksErrorMessage,
	);

	function handleSubmit(e: Event) {
		e.preventDefault();

		// 再次校验以防万一 (trigger validation to set messages if empty)
		validatePassword();
		validateConfirmPassword();
		validateRemarks();

		// Handle cases where fields are empty on initial submit attempt
		if (password.length === 0) {
			passwordErrorMessage = "密码不能为空";
		}
		if (confirmPassword.length === 0 && password.length > 0) {
			// Only if password is not empty
			confirmPasswordErrorMessage = "请确认密码";
		}
		if (remarks.trim().length === 0) {
			remarksErrorMessage = "备注不能为空";
		}

		if (canSubmit) {
			// Re-check canSubmit after explicitly setting messages
			const data = { password, remarks };
			props.submitHandler(data);
			console.log("表单提交的数据:", data);
			password = ""; // 清空表单
			confirmPassword = "";
			remarks = "";
			// Clear error messages as well
			passwordErrorMessage = "";
			confirmPasswordErrorMessage = "";
			remarksErrorMessage = "";
		} else {
			console.log("表单验证失败");
			// Error messages are already set by validation functions or the checks above
		}
	}
</script>

<div class="nya-encrypt-form">
	<form onsubmit={handleSubmit} novalidate class="form-warper">
		<div class="form-group">
			<label for="password">密码</label>
			<input
				type="password"
				id="password"
				bind:value={password}
				oninput={validatePassword}
				onblur={validatePassword}
				class:invalid={passwordErrorMessage}
				aria-describedby={passwordErrorMessage
					? "password-error"
					: undefined}
				aria-invalid={!!passwordErrorMessage}
			/>
			<p
				id="password-error"
				class="error-message"
				style:visibility={passwordErrorMessage ? "visible" : "hidden"}
				aria-live="polite"
			>
				{passwordErrorMessage}
			</p>
		</div>

		<div class="form-group">
			<label for="confirmPassword">确认密码</label>
			<input
				type="password"
				id="confirmPassword"
				bind:value={confirmPassword}
				oninput={validateConfirmPassword}
				onblur={validateConfirmPassword}
				class:invalid={confirmPasswordErrorMessage}
				aria-describedby={confirmPasswordErrorMessage
					? "confirm-password-error"
					: undefined}
				aria-invalid={!!confirmPasswordErrorMessage}
			/>
			<p
				id="confirm-password-error"
				class="error-message"
				style:visibility={confirmPasswordErrorMessage
					? "visible"
					: "hidden"}
				aria-live="polite"
			>
				{confirmPasswordErrorMessage}
			</p>
		</div>

		<div class="form-group">
			<label for="remarks">显示文本(备注)</label>
			<textarea
				id="remarks"
				bind:value={remarks}
				oninput={validateRemarks}
				onblur={validateRemarks}
				rows="4"
				class:invalid={remarksErrorMessage}
				aria-describedby={remarksErrorMessage
					? "remarks-error"
					: undefined}
				aria-invalid={!!remarksErrorMessage}
			></textarea>
			<p
				id="remarks-error"
				class="error-message"
				style:visibility={remarksErrorMessage ? "visible" : "hidden"}
				aria-live="polite"
			>
				{remarksErrorMessage}
			</p>
		</div>

		<button type="submit" disabled={!canSubmit}> 加密 </button>
	</form>
</div>

<style lang="scss">
	$error-color: #dc3545;
	.nya-encrypt-form {
		display: flex;
		justify-content: center;
		align-items: center;
		width: 100%;
		.form-warper {
			display: flex;
			flex-direction: column;
			flex: 1;
			.form-group {
				display: flex;
				flex-direction: column;
				flex: 1;
				label {
					display: block;
					margin-bottom: 8px;
					color: var(--text-normal);
					font-size: var(--font-ui-medium);
					line-height: var(--line-height-tight);
				}
				input,
				textarea {
					outline: none;
					box-shadow: unset;
				}
				textarea {
					resize: none;
				}

				.invalid {
					border-color: $error-color;
				}

				.error-message {
					color: $error-color;
					height: 12px;
					font-size: 12px;
					line-height: 12px;
					margin-top: 4px;
					margin-bottom: 4px;
				}
			}

			button[type="submit"] {
				width: 100%;
				background-color: var(--interactive-accent);
				color: var(--text-on-accent);
				cursor: pointer;
				transition:
					background-color 0.2s ease-in-out,
					transform 0.1s ease;
			}
		}
	}
</style>
