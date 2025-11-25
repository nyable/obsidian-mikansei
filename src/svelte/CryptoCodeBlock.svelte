<script lang="ts">
	import { Notice, TFile, MarkdownRenderer } from "obsidian";
	import {
		AlertCircle,
		Copy,
		Eye,
		EyeOff,
		KeyRound,
		Lock,
		LockKeyholeOpen,
		X,
	} from "lucide-svelte";
	import type { MarkdownPostProcessorContext } from "obsidian";
	import type Mikansei from "src/main";
	import {
		base64ToString,
		decryptAesGcm,
		isEncryptedContent,
		encryptAesGcm,
		stringToBase64,
		type AesGcmDecryptResult,
	} from "src/utils/crypto-util";

	interface CryptoCodeBlockProps {
		source: string;
		el: HTMLElement;
		ctx: MarkdownPostProcessorContext;
		plugin: Mikansei;
	}

	const props: CryptoCodeBlockProps = $props();

	// 状态管理
	let showPasswordDialog = $state(false);
	let showEncryptDialog = $state(false);
	let passwordInput = $state("");
	let encryptPasswordInput = $state("");
	let encryptPasswordConfirm = $state("");
	let encryptRemarkInput = $state("");
	let encryptLanguageInput = $state("text");
	let showPasswordText = $state(false);
	let showEncryptPasswordText = $state(false);
	let showEncryptConfirmText = $state(false);
	let isProcessing = $state(false);
	let decryptedContent = $state<string | null>(null);
	let decryptedLanguage = $state<string>("text");
	let dialogAction = $state<"copy" | "preview" | "decrypt">("copy");
	const iconSize = $state(14);
	// 检查内容是否已加密
	let isEncrypted = $derived(isEncryptedContent(props.source));

	// 解析备注信息
	let remarkInfo = $derived.by(() => {
		if (!isEncrypted) {
			// 未加密时显示完整内容
			return props.source;
		}

		try {
			const decodedStr = base64ToString(props.source);
			const data = JSON.parse(decodedStr) as AesGcmDecryptResult;
			// 备注支持换行，显示完整内容
			return data?.remark || "（无备注信息）";
		} catch {
			return "（解析失败）";
		}
	});

	// 表单验证
	let encryptFormValid = $derived(
		encryptPasswordInput.trim() !== "" &&
			encryptPasswordInput === encryptPasswordConfirm &&
			encryptRemarkInput.trim() !== "",
	);

	// 处理复制
	async function handleCopy() {
		if (!isEncrypted) {
			await navigator.clipboard.writeText(props.source);
			new Notice("✅ 内容已复制到剪贴板", 2000);
			return;
		}
		dialogAction = "copy";
		showPasswordDialog = true;
	}

	// 处理预览
	function handlePreview() {
		if (!isEncrypted) {
			decryptedContent = props.source;
			return;
		}
		dialogAction = "preview";
		showPasswordDialog = true;
	}

	// 处理加密
	function handleEncrypt() {
		showEncryptDialog = true;
	}

	// 处理解密
	function handleDecrypt() {
		dialogAction = "decrypt";
		showPasswordDialog = true;
	}

	// 关闭预览
	function closePreview() {
		decryptedContent = null;
		decryptedLanguage = "text";
	}

	// 解密到文件
	async function decryptToFile(decryptedText: string) {
		try {
			// 修改源文件
			const file = props.plugin.app.vault.getAbstractFileByPath(
				props.ctx.sourcePath,
			);
			if (!file || !(file instanceof TFile)) {
				throw new Error("无法找到文件");
			}

			const tfile = file;
			const content = await props.plugin.app.vault.read(tfile);
			const lines = content.split("\n");

			// 获取代码块的位置信息
			const sectionInfo = props.ctx.getSectionInfo(
				props.el.parentElement!,
			);
			if (!sectionInfo) {
				throw new Error("无法获取代码块位置信息");
			}

			const startLine = sectionInfo.lineStart;
			const endLine = sectionInfo.lineEnd;

			// 替换代码块内容为解密后的明文（保留首尾的```标记）
			const newLines = [
				...lines.slice(0, startLine + 1),
				decryptedText,
				...lines.slice(endLine),
			];

			await props.plugin.app.vault.modify(tfile, newLines.join("\n"));
			new Notice("✅ 解密成功,已替换为明文内容", 3000);
		} catch (error) {
			console.error("解密到文件失败:", error);
			new Notice(
				`❌ 解密失败：${error instanceof Error ? error.message : "未知错误"}`,
				5000,
			);
		}
	}

	// 确认解密密码
	async function confirmPassword() {
		if (!passwordInput.trim()) return;

		isProcessing = true;
		try {
			const result = await decryptAesGcm(props.source, passwordInput);

			if (dialogAction === "copy") {
				await navigator.clipboard.writeText(result.text);
				new Notice("✅ 解密内容已复制到剪贴板", 2000);
			} else if (dialogAction === "preview") {
				decryptedContent = result.text;
				decryptedLanguage = result.language || "text";
			} else if (dialogAction === "decrypt") {
				// 解密到源文件
				await decryptToFile(result.text);
			}

			showPasswordDialog = false;
			passwordInput = "";
			showPasswordText = false;
		} catch (error) {
			new Notice("❌ 解密失败：密码错误或数据已损坏", 5000);
		} finally {
			isProcessing = false;
		}
	}

	// 确认加密
	async function confirmEncrypt() {
		if (!encryptFormValid) return;

		isProcessing = true;
		try {
			// 获取要加密的内容
			const contentToEncrypt = decryptedContent || props.source;

			// 执行加密
			const encryptedObj = await encryptAesGcm(
				contentToEncrypt,
				encryptPasswordInput,
				encryptRemarkInput,
				encryptLanguageInput,
			);
			const encryptedContent = stringToBase64(
				JSON.stringify(encryptedObj),
			);

			// 修改源文件
			const file = props.plugin.app.vault.getAbstractFileByPath(
				props.ctx.sourcePath,
			);
			if (!file || !(file instanceof TFile)) {
				throw new Error("无法找到文件");
			}

			const tfile = file;
			const content = await props.plugin.app.vault.read(tfile);
			const lines = content.split("\n");

			// 获取代码块的位置信息
			const sectionInfo = props.ctx.getSectionInfo(
				props.el.parentElement!,
			);
			if (!sectionInfo) {
				throw new Error("无法获取代码块位置信息");
			}

			const startLine = sectionInfo.lineStart;
			const endLine = sectionInfo.lineEnd;

			// 替换代码块内容（保留首尾的```标记）
			const newLines = [
				...lines.slice(0, startLine + 1),
				encryptedContent,
				...lines.slice(endLine),
			];

			await props.plugin.app.vault.modify(tfile, newLines.join("\n"));

			// 重置状态
			showEncryptDialog = false;
			encryptPasswordInput = "";
			encryptPasswordConfirm = "";
			encryptRemarkInput = "";
			showEncryptPasswordText = false;
			showEncryptConfirmText = false;
			showEncryptConfirmText = false;
			decryptedContent = null;
			decryptedLanguage = "text";
		} catch (error) {
			console.error("加密失败:", error);
			new Notice(
				`❌ 加密失败：${error instanceof Error ? error.message : "未知错误"}`,
				5000,
			);
		} finally {
			isProcessing = false;
		}
	}

	// 取消对话框
	function cancelDialog() {
		showPasswordDialog = false;
		passwordInput = "";
		showPasswordText = false;
	}

	function cancelEncryptDialog() {
		showEncryptDialog = false;
		encryptPasswordInput = "";
		encryptPasswordConfirm = "";
		encryptRemarkInput = "";
		encryptLanguageInput = "text";
		showEncryptPasswordText = false;
		showEncryptConfirmText = false;
	}

	// 键盘事件
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === "Enter" && !isProcessing) {
			confirmPassword();
		} else if (e.key === "Escape") {
			cancelDialog();
		}
	}

	function handleEncryptKeyDown(e: KeyboardEvent) {
		if (e.key === "Enter" && encryptFormValid && !isProcessing) {
			confirmEncrypt();
		} else if (e.key === "Escape") {
			cancelEncryptDialog();
		}
	}

	function renderMarkdown(
		node: HTMLElement,
		{ content, language }: { content: string; language: string },
	) {
		node.empty();
		// 构造 markdown 代码块
		const markdown = "```" + language + "\n" + content + "\n```";
		MarkdownRenderer.render(
			props.plugin.app,
			markdown,
			node,
			props.ctx.sourcePath,
			props.plugin,
		);

		return {
			update({
				content,
				language,
			}: {
				content: string;
				language: string;
			}) {
				node.empty();
				const markdown = "```" + language + "\n" + content + "\n```";
				MarkdownRenderer.render(
					props.plugin.app,
					markdown,
					node,
					props.ctx.sourcePath,
					props.plugin,
				);
			},
		};
	}
</script>

<div class="crypto-code-block">
	<!-- 状态指示器 -->
	<div
		class="status-indicator"
		class:encrypted={isEncrypted}
		title={isEncrypted ? "已加密" : "未加密"}
	></div>

	<!-- 内容区域 -->
	<div class="content-area">
		{#if decryptedContent !== null}
			<!-- 预览解密内容 -->
			<div class="decrypted-preview">
				<div class="preview-header">
					<div class="language-name">{decryptedLanguage}</div>
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div class="action-buttons">
						<div
							aria-label="关闭预览"
							role="button"
							class="btn"
							onclick={closePreview}
							tabindex="0"
						>
							<X size={iconSize} />
						</div>
					</div>
				</div>
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="preview-content markdown-preview-view"
					use:renderMarkdown={{
						content: decryptedContent,
						language: decryptedLanguage,
					}}
					style:max-height="{props.plugin.settings
						.cryptoBlockHeight}px"
				></div>
			</div>
		{:else}
			<!-- 显示备注信息 -->
			<div
				class="remark-text"
				style:max-height="{props.plugin.settings.cryptoBlockHeight}px"
			>
				{remarkInfo}
			</div>
		{/if}
	</div>

	<div class="crypto-code-block-footer">
		<!-- 操作按钮 -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="action-buttons">
			{#if isEncrypted}
				<div
					aria-label="解密"
					role="button"
					class="btn"
					onclick={handleDecrypt}
					tabindex="0"
				>
					<LockKeyholeOpen size={iconSize} />
				</div>
			{/if}

			<div
				aria-label="加密"
				role="button"
				class="btn"
				onclick={handleEncrypt}
				tabindex="0"
			>
				<KeyRound size={iconSize} />
			</div>
			<div
				aria-label="预览内容"
				role="button"
				class="btn"
				onclick={handlePreview}
				tabindex="0"
			>
				<Eye size={iconSize} />
			</div>
			<div
				aria-label="复制内容"
				role="button"
				class="btn"
				onclick={handleCopy}
				tabindex="0"
			>
				<Copy size={iconSize} />
			</div>
		</div>
	</div>

	<!-- 解密密码输入对话框 -->
	{#if showPasswordDialog}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="modal-container" onclick={cancelDialog}>
			<div class="modal-bg"></div>
			<div
				class="modal"
				onclick={(e) => e.stopPropagation()}
				onkeydown={handleKeyDown}
				role="dialog"
				aria-labelledby="dialog-title"
				tabindex="-1"
			>
				<button
					class="modal-close-button"
					onclick={cancelDialog}
					aria-label="Close"
				>
					<X size={20} />
				</button>
				<div class="modal-title" id="dialog-title">
					<Lock size={18} class="modal-icon" />
					请输入解密密码
				</div>

				<div class="modal-content">
					<div class="dialog-item">
						<div class="dialog-item-info">
							<div class="dialog-item-name">密码</div>
							<div class="dialog-item-description">
								请输入用于解密的密码
							</div>
						</div>
						<div class="dialog-item-control">
							<div class="input-wrapper">
								<input
									type={showPasswordText
										? "text"
										: "password"}
									bind:value={passwordInput}
									placeholder="请输入密码"
									disabled={isProcessing}
								/>
								<button
									class="toggle-visible"
									onclick={() =>
										(showPasswordText = !showPasswordText)}
									aria-label={showPasswordText
										? "隐藏密码"
										: "显示密码"}
								>
									{#if showPasswordText}
										<EyeOff size={14} />
									{:else}
										<Eye size={14} />
									{/if}
								</button>
							</div>
						</div>
					</div>
				</div>

				<div class="modal-button-container">
					<button
						class="mod-cta"
						onclick={confirmPassword}
						disabled={isProcessing || !passwordInput.trim()}
					>
						{#if isProcessing}
							<span class="loading-spinner"></span>
							解密中...
						{:else}
							确定
						{/if}
					</button>
					<button onclick={cancelDialog} disabled={isProcessing}
						>取消</button
					>
				</div>
			</div>
		</div>
	{/if}

	<!-- 加密对话框 -->
	{#if showEncryptDialog}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="modal-container" onclick={cancelEncryptDialog}>
			<div class="modal-bg"></div>
			<div
				class="modal encrypt-dialog"
				onclick={(e) => e.stopPropagation()}
				onkeydown={handleEncryptKeyDown}
				role="dialog"
				aria-labelledby="encrypt-dialog-title"
				tabindex="-1"
			>
				<button
					class="modal-close-button"
					onclick={cancelEncryptDialog}
					aria-label="Close"
				>
					<X size={20} />
				</button>
				<div class="modal-title" id="encrypt-dialog-title">
					<KeyRound size={18} class="modal-icon" />
					加密代码块
				</div>

				<div class="modal-content">
					<div class="dialog-item">
						<div class="dialog-item-info">
							<div class="dialog-item-name">密码</div>
							<div class="dialog-item-description">
								设置加密密码
							</div>
						</div>
						<div class="dialog-item-control">
							<div class="input-wrapper">
								<input
									type={showEncryptPasswordText
										? "text"
										: "password"}
									bind:value={encryptPasswordInput}
									placeholder="请输入密码"
									disabled={isProcessing}
								/>
								<button
									class="toggle-visible"
									onclick={() =>
										(showEncryptPasswordText =
											!showEncryptPasswordText)}
									aria-label={showEncryptPasswordText
										? "隐藏密码"
										: "显示密码"}
								>
									{#if showEncryptPasswordText}
										<EyeOff size={14} />
									{:else}
										<Eye size={14} />
									{/if}
								</button>
							</div>
						</div>
					</div>

					<div class="dialog-item">
						<div class="dialog-item-info">
							<div class="dialog-item-name">确认密码</div>
							<div class="dialog-item-description">
								再次输入以确认
								{#if encryptPasswordInput && encryptPasswordConfirm && encryptPasswordInput !== encryptPasswordConfirm}
									<div class="error-text">
										<AlertCircle size={12} /> 两次输入的密码不一致
									</div>
								{/if}
							</div>
						</div>
						<div class="dialog-item-control">
							<div class="input-wrapper">
								<input
									type={showEncryptConfirmText
										? "text"
										: "password"}
									bind:value={encryptPasswordConfirm}
									placeholder="请再次输入密码"
									disabled={isProcessing}
									class:error={encryptPasswordInput &&
										encryptPasswordConfirm &&
										encryptPasswordInput !==
											encryptPasswordConfirm}
								/>
								<button
									class="toggle-visible"
									onclick={() =>
										(showEncryptConfirmText =
											!showEncryptConfirmText)}
									aria-label={showEncryptConfirmText
										? "隐藏密码"
										: "显示密码"}
								>
									{#if showEncryptConfirmText}
										<EyeOff size={14} />
									{:else}
										<Eye size={14} />
									{/if}
								</button>
							</div>
						</div>
					</div>

					<div class="dialog-item">
						<div class="dialog-item-info">
							<div class="dialog-item-name">显示文本</div>
							<div class="dialog-item-description">
								未解密时显示的备注信息
							</div>
						</div>
						<div class="dialog-item-control">
							<textarea
								bind:value={encryptRemarkInput}
								placeholder="请输入显示文本"
								rows="2"
								disabled={isProcessing}
							></textarea>
						</div>
					</div>

					<div class="dialog-item">
						<div class="dialog-item-info">
							<div class="dialog-item-name">渲染语言</div>
							<div class="dialog-item-description">
								解密后代码块的语言
							</div>
						</div>
						<div class="dialog-item-control">
							<input
								type="text"
								bind:value={encryptLanguageInput}
								placeholder="text"
								disabled={isProcessing}
							/>
						</div>
					</div>
				</div>

				<div class="modal-button-container">
					<button
						class="mod-cta"
						onclick={confirmEncrypt}
						disabled={isProcessing || !encryptFormValid}
					>
						{#if isProcessing}
							<span class="loading-spinner"></span>
							加密中...
						{:else}
							确定
						{/if}
					</button>
					<button
						onclick={cancelEncryptDialog}
						disabled={isProcessing}>取消</button
					>
				</div>
			</div>
		</div>
	{/if}
</div>

<style lang="scss">
	.crypto-code-block {
		.crypto-code-block-footer {
			display: flex;
			height: 30px;
		}
		position: relative;
		display: flex;
		flex-direction: column;
		padding: 0;
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		background: var(--background-primary);
		overflow: hidden;
		transition: all 0.2s ease-in-out;

		&:hover {
			border-color: var(--interactive-accent);
			box-shadow: 0 0 0 1px var(--interactive-accent);
		}

		.status-indicator {
			$color-encrypted: #44cf6e;
			$color-original: #ff9800;
			position: absolute;
			top: 8px;
			left: 8px;
			width: 8px;
			height: 8px;
			border-radius: 50%;
			background: $color-original;
			box-shadow:
				0 0 0 2px var(--background-primary),
				0 0 0 3px rgba(from $color-original r g b / 0.3);
			z-index: 2;
			transition: all 0.3s ease;

			&.encrypted {
				background: $color-encrypted;
				box-shadow:
					0 0 0 2px var(--background-primary),
					0 0 0 3px rgba(from $color-encrypted r g b / 0.3);
			}
		}

		.content-area {
			padding: 20px 20px 4px 20px;
			min-height: 40px;
			background: var(--background-primary);

			.remark-text {
				padding: 12px 8px;
				color: var(--text-muted);
				font-size: 14px;
				line-height: 1.6;
				word-break: break-word;
				white-space: pre-wrap;

				overflow-y: auto;
				border: 1px solid var(--background-modifier-border);
			}

			.decrypted-preview {
				border: 1px solid var(--background-modifier-border);
				border-radius: var(--radius-s);
				overflow: hidden;
				margin-top: 8px;
				position: relative;

				.preview-header {
					height: 30px;
					display: flex;
					justify-content: flex-end;
					align-items: center;
					background: var(--background-secondary);
					box-shadow: 0 2px 0 0 var(--background-modifier-border);
					.language-name {
						margin: 8px;
						user-select: none;
						font-size: 13px;
					}
				}

				.preview-content {
					margin: 4px 0 0 0;
					padding: 0 4px;
					background: var(--background-primary);
					color: var(--text-normal);
					font-size: 14px;
					line-height: 1.5;
					white-space: pre-wrap;
					word-break: break-word;

					overflow-y: auto;
				}
			}
		}

		.action-buttons {
			display: flex;
			gap: 4px;
			justify-content: flex-end;
			padding: 4px;
			background: var(--background-secondary);
			flex: 1;
			.btn {
				display: flex;
				align-items: center;
				justify-content: center;
				padding: 4px;
				border-radius: var(--radius-s);
				color: var(--text-muted);
				background: transparent;
				border: none;
				cursor: pointer;
				transition: all 0.2s ease;

				&:hover {
					background: var(--background-modifier-hover);
					color: var(--text-normal);
				}
			}
		}
	}

	/* Modal Styling mimicking Obsidian's native modals */
	.modal-container {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: var(--layer-modal);
	}

	.modal-bg {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: var(--background-modifier-cover);
		backdrop-filter: blur(2px);
	}

	.modal {
		position: relative;
		width: 90%;
		max-width: 450px;
		background-color: var(--modal-background);
		border: 1px solid var(--modal-border);
		border-radius: var(--modal-radius);
		box-shadow: var(--shadow-l);
		display: flex;
		flex-direction: column;
		max-height: 90vh;
		animation: modal-in 0.2s ease-out;

		&.encrypt-dialog {
			max-width: 500px;
		}

		@keyframes modal-in {
			from {
				opacity: 0;
				transform: scale(0.95) translateY(10px);
			}
			to {
				opacity: 1;
				transform: scale(1) translateY(0);
			}
		}
	}

	.modal-close-button {
		position: absolute;
		top: 12px;
		right: 12px;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-s);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
		background: transparent;
		border: none;
		padding: 0;
		transition: all 0.2s;

		&:hover {
			background-color: var(--background-modifier-hover);
			color: var(--text-normal);
		}
	}

	.modal-title {
		padding: 16px 24px;
		font-size: 18px;
		font-weight: 600;
		line-height: 1.3;
		color: var(--text-normal);
		border-bottom: 1px solid var(--background-modifier-border);
		display: flex;
		align-items: center;
		gap: 10px;

		:global(.modal-icon) {
			color: var(--interactive-accent);
		}
	}

	.modal-content {
		padding: 24px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.dialog-item {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: flex-start;
		gap: 8px;
		padding: 12px 0;
		border-bottom: 1px solid var(--background-modifier-border);

		&:last-child {
			border-bottom: none;
		}

		.dialog-item-info {
			width: 100%;
			display: flex;
			flex-direction: column;
			align-items: flex-start;
			gap: 4px;
		}

		.dialog-item-name {
			font-size: 14px;
			font-weight: 600;
			color: var(--text-normal);
		}

		.dialog-item-description {
			font-size: 12px;
			color: var(--text-muted);
			line-height: 1.4;

			.error-text {
				color: var(--color-red);
				display: flex;
				align-items: center;
				gap: 4px;
				margin-top: 4px;
			}
		}

		.dialog-item-control {
			width: 100%;
			@mixin ob-style-input {
				width: 100%;
				background: var(--background-modifier-form-field);
				border: 1px solid var(--background-modifier-border);
				color: var(--text-normal);
				padding: 6px 12px;
				border-radius: var(--input-radius);
				font-size: 14px;
				transition: all 0.2s;

				&:focus {
					border-color: var(--interactive-accent);
					box-shadow: 0 0 0 2px
						rgba(var(--interactive-accent-rgb), 0.2);
				}
			}
			input {
				@include ob-style-input;
				&.error {
					border-color: var(--color-red);
					&:focus {
						box-shadow: 0 0 0 2px rgba(var(--color-red-rgb), 0.2);
					}
				}
			}

			textarea {
				resize: none;
				height: 60px;
				@include ob-style-input;
			}

			.input-wrapper {
				position: relative;
				display: flex;
				align-items: center;
				width: 100%;

				input {
					padding-right: 36px;
				}

				.toggle-visible {
					position: absolute;
					right: 4px;
					padding: 4px;
					border: none;
					cursor: pointer;
					display: flex;
					align-items: center;
					justify-content: center;
					background-color: transparent;
					border-radius: var(--clickable-icon-radius);
					transition: opacity var(--anim-duration-fast) ease-in-out;
					height: auto;
					&:hover {
						background: var(--background-modifier-hover);
						color: var(--text-normal);
					}
				}
			}
		}
	}

	.modal-button-container {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
		padding: 16px 24px;
		border-top: 1px solid var(--background-modifier-border);

		button {
			padding: 6px 16px;
			border-radius: var(--button-radius);
			font-weight: 500;
			cursor: pointer;
			transition: all 0.2s;

			&.mod-cta {
				background-color: var(--interactive-accent);
				color: var(--text-on-accent);
				border: none;

				&:hover:not(:disabled) {
					background-color: var(--interactive-accent-hover);
				}
			}

			&:not(.mod-cta) {
				background-color: transparent;
				border: 1px solid var(--background-modifier-border);
				color: var(--text-normal);

				&:hover:not(:disabled) {
					background-color: var(--background-modifier-hover);
				}
			}

			&:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}

			.loading-spinner {
				display: inline-block;
				width: 12px;
				height: 12px;
				margin-right: 6px;
				border: 2px solid rgba(255, 255, 255, 0.3);
				border-top-color: white;
				border-radius: 50%;
				animation: spin 1s linear infinite;
			}
		}
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
