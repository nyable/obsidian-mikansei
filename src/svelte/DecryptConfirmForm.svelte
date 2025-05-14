<script lang="ts">
	import type { CryptoConfirmData } from "src/extension/CodeBlockCrypto";

	interface PasswordDecryptFormProps {
		submitHandler: (data: CryptoConfirmData) => void;
	}
	const props: PasswordDecryptFormProps = $props();
	let password = $state("");
	const minPasswordLength = 1;

	let passwordErrorMessage = $state("");

	function validatePassword() {
		if (password.length < minPasswordLength) {
			passwordErrorMessage = `密码长度不能少于 ${minPasswordLength} 个字符`;
		} else {
			passwordErrorMessage = "";
		}
	}

	let canSubmit = $derived(
		password.length >= minPasswordLength && !passwordErrorMessage,
	);

	function handleSubmit(e: Event) {
		e.preventDefault();

		validatePassword();

		if (password.length === 0) {
			passwordErrorMessage = "密码不能为空";
		}
		if (password.length >= minPasswordLength && !passwordErrorMessage) {
			const data: CryptoConfirmData = { password: password, remarks: "" };
			props.submitHandler(data);
			console.log("表单提交的数据 (解密):", data);
			password = "";
			passwordErrorMessage = "";
		} else {
			console.log("表单验证失败 (解密)");
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
				{passwordErrorMessage || "&nbsp;"}
			</p>
		</div>

		<button type="submit" disabled={!canSubmit}> 解密 </button>
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
				input {
					outline: none;
					box-shadow: unset;
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
