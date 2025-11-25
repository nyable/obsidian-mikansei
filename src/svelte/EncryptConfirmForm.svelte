<script lang="ts">
	import type { CryptoConfirmData } from "src/extension/CodeBlockCrypto";

	interface PasswordConfirmFormProps {
		submitHandler: (data: CryptoConfirmData) => void;
	}
	const props: PasswordConfirmFormProps = $props();
	let password = $state("");
	let confirmPassword = $state("");
	let remarks = $state("");
	let showPassword = $state(false);
	let showConfirmPassword = $state(false);
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
		validateConfirmPassword();
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

	let canSubmit = $derived(
		password.length >= minPasswordLength &&
			password === confirmPassword &&
			remarks.trim() !== "" &&
			!passwordErrorMessage &&
			!confirmPasswordErrorMessage &&
			!remarksErrorMessage,
	);

	function handleSubmit(e: Event) {
		e.preventDefault();

		validatePassword();
		validateConfirmPassword();
		validateRemarks();

		if (password.length === 0) {
			passwordErrorMessage = "密码不能为空";
		}
		if (confirmPassword.length === 0 && password.length > 0) {
			confirmPasswordErrorMessage = "请确认密码";
		}
		if (remarks.trim().length === 0) {
			remarksErrorMessage = "备注不能为空";
		}

		if (canSubmit) {
			const data = { password, remarks };
			props.submitHandler(data);
			console.log("表单提交的数据:", data);
			password = "";
			confirmPassword = "";
			remarks = "";
			passwordErrorMessage = "";
			confirmPasswordErrorMessage = "";
			remarksErrorMessage = "";
		} else {
			console.log("表单验证失败");
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) {
			handleSubmit(e);
		}
	}
</script>

<div
	class="nya-crypto-form"
	role="dialog"
	aria-labelledby="encrypt-title"
	tabindex="-1"
	onkeydown={handleKeyDown}
>
	<div class="form-header">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			class="form-icon"
		>
			<rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
			<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
		</svg>
		<h3 id="encrypt-title" class="form-title">加密代码块</h3>
	</div>

	<form onsubmit={handleSubmit} novalidate class="form-content">
		<div class="form-group">
			<label for="password">密码</label>
			<div class="input-wrapper">
				<input
					type={showPassword ? "text" : "password"}
					id="password"
					bind:value={password}
					oninput={validatePassword}
					onblur={validatePassword}
					class:invalid={passwordErrorMessage}
					placeholder="请输入密码"
					aria-describedby={passwordErrorMessage
						? "password-error"
						: undefined}
					aria-invalid={!!passwordErrorMessage}
				/>
				<button
					type="button"
					class="toggle-visibility"
					onclick={() => (showPassword = !showPassword)}
					aria-label={showPassword ? "隐藏密码" : "显示密码"}
				>
					{#if showPassword}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
							></path>
							<line x1="1" y1="1" x2="23" y2="23"></line>
						</svg>
					{:else}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
							></path>
							<circle cx="12" cy="12" r="3"></circle>
						</svg>
					{/if}
				</button>
			</div>
			<p
				id="password-error"
				class="error-message"
				style:visibility={passwordErrorMessage ? "visible" : "hidden"}
				aria-live="polite"
			>
				{passwordErrorMessage || "\u00a0"}
			</p>
		</div>

		<div class="form-group">
			<label for="confirmPassword">确认密码</label>
			<div class="input-wrapper">
				<input
					type={showConfirmPassword ? "text" : "password"}
					id="confirmPassword"
					bind:value={confirmPassword}
					oninput={validateConfirmPassword}
					onblur={validateConfirmPassword}
					class:invalid={confirmPasswordErrorMessage}
					placeholder="请再次输入密码"
					aria-describedby={confirmPasswordErrorMessage
						? "confirm-password-error"
						: undefined}
					aria-invalid={!!confirmPasswordErrorMessage}
				/>
				<button
					type="button"
					class="toggle-visibility"
					onclick={() => (showConfirmPassword = !showConfirmPassword)}
					aria-label={showConfirmPassword ? "隐藏密码" : "显示密码"}
				>
					{#if showConfirmPassword}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
							></path>
							<line x1="1" y1="1" x2="23" y2="23"></line>
						</svg>
					{:else}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
							></path>
							<circle cx="12" cy="12" r="3"></circle>
						</svg>
					{/if}
				</button>
			</div>
			<p
				id="confirm-password-error"
				class="error-message"
				style:visibility={confirmPasswordErrorMessage
					? "visible"
					: "hidden"}
				aria-live="polite"
			>
				{confirmPasswordErrorMessage || "\u00a0"}
			</p>
		</div>

		<div class="form-group">
			<label for="remarks">显示文本(备注)</label>
			<textarea
				id="remarks"
				bind:value={remarks}
				oninput={validateRemarks}
				onblur={validateRemarks}
				rows="3"
				placeholder="请输入备注信息"
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
				{remarksErrorMessage || "\u00a0"}
			</p>
		</div>

		<button type="submit" class="submit-btn" disabled={!canSubmit}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
				<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
			</svg>
			加密
		</button>
		<p class="hint-text">提示: 使用 Ctrl/Cmd + Enter 快速提交</p>
	</form>
</div>

<style lang="scss">
	$error-color: #dc3545;
	$primary-color: var(--interactive-accent);
	$border-radius: 8px;

	.nya-crypto-form {
		display: flex;
		flex-direction: column;
		width: 100%;
		padding: 8px;

		.form-header {
			display: flex;
			align-items: center;
			gap: 12px;
			margin-bottom: 20px;
			padding-bottom: 12px;
			border-bottom: 1px solid var(--background-modifier-border);

			.form-icon {
				color: $primary-color;
				flex-shrink: 0;
			}

			.form-title {
				margin: 0;
				font-size: 18px;
				font-weight: 600;
				color: var(--text-normal);
			}
		}

		.form-content {
			display: flex;
			flex-direction: column;
			gap: 16px;

			.form-group {
				display: flex;
				flex-direction: column;
				gap: 8px;

				label {
					display: block;
					color: var(--text-normal);
					font-size: var(--font-ui-small);
					font-weight: 500;
					line-height: var(--line-height-tight);
				}

				.input-wrapper {
					position: relative;
					display: flex;
					align-items: center;

					input {
						flex: 1;
						padding-right: 40px;
					}

					.toggle-visibility {
						position: absolute;
						right: 8px;
						padding: 4px;
						background: transparent;
						border: none;
						cursor: pointer;
						color: var(--text-muted);
						transition: color 0.2s ease;
						display: flex;
						align-items: center;
						justify-content: center;

						&:hover {
							color: var(--text-normal);
						}

						&:focus-visible {
							outline: 2px solid $primary-color;
							outline-offset: 2px;
							border-radius: 4px;
						}
					}
				}

				input,
				textarea {
					outline: none;
					box-shadow: none;
					border-radius: $border-radius;
					transition:
						border-color 0.2s ease,
						box-shadow 0.2s ease;
					font-size: var(--font-ui-medium);

					&:focus {
						border-color: $primary-color;
						box-shadow: 0 0 0 2px
							rgba(from $primary-color r g b / 0.1);
					}

					&::placeholder {
						color: var(--text-faint);
					}
				}

				textarea {
					resize: vertical;
					min-height: 60px;
					font-family: inherit;
					line-height: 1.5;
				}

				.invalid {
					border-color: $error-color;

					&:focus {
						box-shadow: 0 0 0 2px rgba($error-color, 0.1);
					}
				}

				.error-message {
					color: $error-color;
					min-height: 18px;
					font-size: 12px;
					line-height: 18px;
					margin: 0;
				}
			}

			.submit-btn {
				display: flex;
				align-items: center;
				justify-content: center;
				gap: 8px;
				width: 100%;
				margin-top: 8px;
				padding: 10px 20px;
				background-color: $primary-color;
				color: var(--text-on-accent);
				border: none;
				border-radius: $border-radius;
				font-size: var(--font-ui-medium);
				font-weight: 500;
				cursor: pointer;
				transition:
					background-color 0.2s ease,
					transform 0.1s ease,
					box-shadow 0.2s ease;

				&:hover:not(:disabled) {
					background-color: var(--interactive-accent-hover);
					box-shadow: 0 2px 8px rgba(from $primary-color r g b / 0.2);
				}

				&:active:not(:disabled) {
					transform: translateY(1px);
				}

				&:disabled {
					opacity: 0.5;
					cursor: not-allowed;
				}

				svg {
					flex-shrink: 0;
				}
			}

			.hint-text {
				margin: 0;
				text-align: center;
				font-size: 11px;
				color: var(--text-faint);
			}
		}
	}
</style>
