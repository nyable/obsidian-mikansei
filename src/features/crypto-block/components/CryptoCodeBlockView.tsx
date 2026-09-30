import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MarkdownRenderer, Notice, TFile } from "obsidian";
import type { MarkdownPostProcessorContext } from "obsidian";
import { Copy, Eye, KeyRound, LockKeyholeOpen, X } from "lucide-react";
import type Mikansei from "src/main";
import { openCryptoDialog } from "../CryptoConfirmModal";
import {
	base64ToString,
	decryptAesGcm,
	encryptAesGcm,
	isEncryptedContent,
	stringToBase64,
	type AesGcmDecryptResult,
} from "../crypto";

interface CryptoCodeBlockViewProps {
	source: string;
	el: HTMLElement;
	ctx: MarkdownPostProcessorContext;
	plugin: Mikansei;
}

type DialogAction = "copy" | "preview" | "decrypt";

const ICON_SIZE = 14;

export function CryptoCodeBlockView(props: CryptoCodeBlockViewProps) {
	const { t } = useTranslation();
	const [decryptedContent, setDecryptedContent] = useState<string | null>(
		null
	);
	const [decryptedLanguage, setDecryptedLanguage] = useState("text");
	// 用 ref 保存当前动作，避免对话框回调闭包读到过期的状态值
	const actionRef = useRef<DialogAction>("copy");

	const isEncrypted = isEncryptedContent(props.source);

	const remarkInfo = useMemo(() => {
		if (!isEncrypted) {
			// 未加密时显示完整内容
			return props.source;
		}
		try {
			const decodedStr = base64ToString(props.source);
			const data = JSON.parse(decodedStr) as AesGcmDecryptResult;
			// 备注支持换行，显示完整内容
			return data?.remark || t("crypto.remark.empty");
		} catch {
			return t("crypto.remark.parseFailed");
		}
	}, [props.source, isEncrypted, t]);

	const previewRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const node = previewRef.current;
		if (!node || decryptedContent === null) return;
		node.empty();
		const markdown =
			"```" + decryptedLanguage + "\n" + decryptedContent + "\n```";
		MarkdownRenderer.render(
			props.plugin.app,
			markdown,
			node,
			props.ctx.sourcePath,
			props.plugin
		);
	}, [decryptedContent, decryptedLanguage, props.ctx.sourcePath, props.plugin]);

	// 解密到文件
	async function decryptToFile(decryptedText: string) {
		try {
			const file = props.plugin.app.vault.getAbstractFileByPath(
				props.ctx.sourcePath
			);
			if (!file || !(file instanceof TFile)) {
				throw new Error(t("crypto.error.noFile"));
			}

			const content = await props.plugin.app.vault.read(file);
			const lines = content.split("\n");

			// 获取代码块的位置信息
			const sectionInfo = props.ctx.getSectionInfo(
				props.el.parentElement!
			);
			if (!sectionInfo) {
				throw new Error(t("crypto.error.noSectionInfo"));
			}

			const startLine = sectionInfo.lineStart;
			const endLine = sectionInfo.lineEnd;

			// 替换代码块内容为解密后的明文（保留首尾的```标记）
			const newLines = [
				...lines.slice(0, startLine + 1),
				decryptedText,
				...lines.slice(endLine),
			];

			await props.plugin.app.vault.modify(file, newLines.join("\n"));
			new Notice(t("crypto.notice.decryptToFileSuccess"), 3000);
		} catch (error) {
			console.error("解密到文件失败:", error);
			new Notice(
				t("crypto.notice.decryptFailedGeneric", {
					message:
						error instanceof Error
							? error.message
							: t("crypto.error.unknown"),
				}),
				5000
			);
		}
	}

	// 确认解密密码
	async function confirmPassword(passwordInput: string) {
		if (!passwordInput.trim()) return;

		try {
			const result = await decryptAesGcm(props.source, passwordInput);

			if (actionRef.current === "copy") {
				await navigator.clipboard.writeText(result.text);
				new Notice(t("crypto.notice.copyDecryptedSuccess"), 2000);
			} else if (actionRef.current === "preview") {
				setDecryptedContent(result.text);
				setDecryptedLanguage(result.language || "text");
			} else if (actionRef.current === "decrypt") {
				// 解密到源文件
				await decryptToFile(result.text);
			}
		} catch {
			new Notice(t("crypto.notice.decryptFailedWrongPassword"), 5000);
		}
	}

	// 确认加密
	async function confirmEncrypt(
		encryptPasswordInput: string,
		encryptRemarkInput: string,
		encryptLanguageInput?: string
	) {
		try {
			// 获取要加密的内容
			const contentToEncrypt = decryptedContent || props.source;

			// 执行加密
			const encryptedObj = await encryptAesGcm(
				contentToEncrypt,
				encryptPasswordInput,
				encryptRemarkInput,
				encryptLanguageInput || "text"
			);
			const encryptedContent = stringToBase64(JSON.stringify(encryptedObj));

			// 修改源文件
			const file = props.plugin.app.vault.getAbstractFileByPath(
				props.ctx.sourcePath
			);
			if (!file || !(file instanceof TFile)) {
				throw new Error(t("crypto.error.noFile"));
			}

			const content = await props.plugin.app.vault.read(file);
			const lines = content.split("\n");

			// 获取代码块的位置信息
			const sectionInfo = props.ctx.getSectionInfo(
				props.el.parentElement!
			);
			if (!sectionInfo) {
				throw new Error(t("crypto.error.noSectionInfo"));
			}

			const startLine = sectionInfo.lineStart;
			const endLine = sectionInfo.lineEnd;

			// 替换代码块内容（保留首尾的```标记）
			const newLines = [
				...lines.slice(0, startLine + 1),
				encryptedContent,
				...lines.slice(endLine),
			];

			await props.plugin.app.vault.modify(file, newLines.join("\n"));

			// 重置状态
			setDecryptedContent(null);
			setDecryptedLanguage("text");
		} catch (error) {
			console.error("加密失败:", error);
			new Notice(
				t("crypto.notice.encryptFailedGeneric", {
					message:
						error instanceof Error
							? error.message
							: t("crypto.error.unknown"),
				}),
				5000
			);
		}
	}

	// 处理复制
	async function handleCopy() {
		if (!isEncrypted) {
			await navigator.clipboard.writeText(props.source);
			new Notice(t("crypto.notice.copyPlainSuccess"), 2000);
			return;
		}
		actionRef.current = "copy";
		const data = await openCryptoDialog(props.plugin.app, "decrypt");
		if (!data) return;
		await confirmPassword(data.password);
	}

	// 处理预览
	async function handlePreview() {
		if (!isEncrypted) {
			setDecryptedContent(props.source);
			return;
		}
		actionRef.current = "preview";
		const data = await openCryptoDialog(props.plugin.app, "decrypt");
		if (!data) return;
		await confirmPassword(data.password);
	}

	// 处理加密
	async function handleEncrypt() {
		const data = await openCryptoDialog(props.plugin.app, "encrypt");
		if (!data) return;
		await confirmEncrypt(data.password, data.remarks, data.language);
	}

	// 处理解密
	async function handleDecrypt() {
		actionRef.current = "decrypt";
		const data = await openCryptoDialog(props.plugin.app, "decrypt");
		if (!data) return;
		await confirmPassword(data.password);
	}

	// 关闭预览
	function closePreview() {
		setDecryptedContent(null);
		setDecryptedLanguage("text");
	}

	const previewMaxHeight = props.plugin.settings.cryptoBlockHeight + "px";

	return (
		<div className="crypto-code-block">
			{/* 状态指示器 */}
			<div
				className={
					isEncrypted
						? "status-indicator encrypted"
						: "status-indicator"
				}
				title={
					isEncrypted
						? t("crypto.status.encrypted")
						: t("crypto.status.unencrypted")
				}
			></div>

			{/* 内容区域 */}
			<div className="content-area">
				{decryptedContent !== null ? (
					<div className="decrypted-preview">
						<div className="preview-header">
							<div className="language-name">
								{decryptedLanguage}
							</div>
							<div className="action-buttons">
								<div
									aria-label={t("crypto.action.closePreview")}
									role="button"
									className="btn"
									onClick={closePreview}
									tabIndex={0}
								>
									<X size={ICON_SIZE} />
								</div>
							</div>
						</div>
						<div
							ref={previewRef}
							className="preview-content markdown-preview-view"
							style={{ maxHeight: previewMaxHeight }}
						></div>
					</div>
				) : (
					<div className="remark-text" style={{ maxHeight: previewMaxHeight }}>
						{remarkInfo}
					</div>
				)}
			</div>

			<div className="crypto-code-block-footer">
				<div className="action-buttons">
					{isEncrypted && (
						<div
							aria-label={t("crypto.action.decrypt")}
							role="button"
							className="btn"
							onClick={handleDecrypt}
							tabIndex={0}
						>
							<LockKeyholeOpen size={ICON_SIZE} />
						</div>
					)}

					<div
						aria-label={t("crypto.action.encrypt")}
						role="button"
						className="btn"
						onClick={handleEncrypt}
						tabIndex={0}
					>
						<KeyRound size={ICON_SIZE} />
					</div>
					<div
						aria-label={t("crypto.action.preview")}
						role="button"
						className="btn"
						onClick={handlePreview}
						tabIndex={0}
					>
						<Eye size={ICON_SIZE} />
					</div>
					<div
						aria-label={t("crypto.action.copy")}
						role="button"
						className="btn"
						onClick={handleCopy}
						tabIndex={0}
					>
						<Copy size={ICON_SIZE} />
					</div>
				</div>
			</div>
		</div>
	);
}
