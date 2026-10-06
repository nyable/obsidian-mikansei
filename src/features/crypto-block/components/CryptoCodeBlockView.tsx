import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Menu, Notice, type MarkdownPostProcessorContext } from "obsidian";
import { Copy, Ellipsis, Eye, KeyRound, LockKeyhole, LockKeyholeOpen, Pencil, X } from "lucide-react";
import type Mikansei from "src/main";
import { confirmModal } from "src/shared/confirmModal";
import { openCryptoDialog } from "../CryptoConfirmModal";
import { openCryptoEditor, type CryptoEditorHandle } from "../CryptoEditModal";
import type { CryptoContentDraft } from "../types";
import { isEncryptedContent } from "../crypto";
import { captureTarget, writeTarget, type BlockTarget } from "../blockStorage";
import { BlockConflictError } from "../blockContent";
import { cryptoErrorMessage, encryptContent, readBundle, unlockContent } from "../cryptoService";
import { autoLockDecision } from "../autoLock";
import { renderCryptoPreview } from "../previewRendering";

interface CryptoCodeBlockViewProps {
	source: string;
	el: HTMLElement;
	ctx: MarkdownPostProcessorContext;
	plugin: Mikansei;
}

interface Session extends CryptoContentDraft { password: string; target: BlockTarget }

export function CryptoCodeBlockView({ source, el, ctx, plugin }: CryptoCodeBlockViewProps) {
	const { t } = useTranslation();
	const encrypted = useMemo(() => isEncryptedContent(source), [source]);
	const bundle = useMemo(() => readBundle(source), [source]);
	const [sessionContent, setSessionContent] = useState<CryptoContentDraft | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [plainPreview, setPlainPreview] = useState(false);
	const [editing, setEditing] = useState(false);
	const sessionRef = useRef<Session | null>(null);
	const editorRef = useRef<CryptoEditorHandle | null>(null);
	const active = useRef(false);
	const mounted = useRef(true);
	const activity = useRef(Date.now());
	const previewRef = useRef<HTMLDivElement>(null);
	const translate = useRef(t);
	translate.current = t;

	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
			editorRef.current?.dispose();
			editorRef.current = null;
			sessionRef.current = null;
		};
	}, []);

	const clearSession = useCallback(() => {
		sessionRef.current = null;
		setSessionContent(null);
		setError("");
	}, []);

	useEffect(() => {
		if (!sessionContent) return;
		const doc = el.ownerDocument;
		const check = () => {
			const decision = autoLockDecision(plugin.settings.cryptoAutoLockMinutes, activity.current, Date.now(), active.current, false);
			if (decision === "lock") clearSession();
		};
		const timer = window.setInterval(check, 1000);
		doc.addEventListener("visibilitychange", check);
		return () => {
			window.clearInterval(timer);
			doc.removeEventListener("visibilitychange", check);
		};
	}, [sessionContent, clearSession, el, plugin]);

	useEffect(() => {
		const node = previewRef.current;
		if (!node || (!sessionContent && !plainPreview)) return;
		let cancelled = false;
		const preview = renderCryptoPreview(plugin.app, plugin, node, ctx.sourcePath,
			sessionContent?.text ?? source, sessionContent?.language ?? "text");
		void preview.finished.catch(() => {
			if (!cancelled) {
				preview.dispose();
				setError(translate.current("crypto.ui.previewFailed"));
			}
		});
		return () => { cancelled = true; preview.dispose(); };
	}, [sessionContent, plainPreview, source, ctx.sourcePath, plugin]);

	async function perform(action: () => Promise<void>) {
		if (active.current) return;
		active.current = true;
		setBusy(true);
		setError("");
		try { await action(); } catch (failure) {
			if (mounted.current) setError(cryptoErrorMessage(failure));
		} finally {
			active.current = false;
			activity.current = Date.now();
			if (mounted.current) setBusy(false);
		}
	}

	async function target() {
		const info = ctx.getSectionInfo(el);
		if (!info) throw new BlockConflictError();
		const result = await captureTarget(plugin.app, ctx.sourcePath, info.lineStart, plugin.settings.cryptoBlockLanguage);
		// Renderer sources can include a final newline; no other differences are accepted.
		const body = result.snapshot.block.body.replace(/\r\n/g, "\n");
		if (source !== body && source !== body + "\n") throw new BlockConflictError();
		return result;
	}

	async function unlock() {
		await perform(async () => {
			const captured = await target();
			await openCryptoDialog(plugin.app, {
				mode: "decrypt", title: t("crypto.ui.unlock"), submitLabel: t("crypto.ui.unlock"),
				onSubmit: async ({ password }) => {
					const result = await unlockContent(captured.snapshot.block.body, password);
					if (!mounted.current) throw new BlockConflictError();
					const content = { text: result.text, remark: result.remark, language: result.language };
					sessionRef.current = { ...content, password, target: captured };
					setSessionContent(content);
					activity.current = Date.now();
				},
			});
		});
	}

	async function encrypt() {
		await perform(async () => {
			const captured = await target();
			if (isEncryptedContent(captured.snapshot.block.body)) throw new BlockConflictError();
			await openCryptoDialog(plugin.app, {
				mode: "encrypt", title: t("crypto.dialog.encryptTitle"), submitLabel: t("crypto.dialog.submitEncrypt"),
				description: t("crypto.ui.encryptHint"),
				onSubmit: async ({ password, remarks, language }) => {
					const body = await encryptContent(captured.snapshot.block.body, password, remarks, language ?? "text");
					await writeTarget(plugin.app, captured, body);
					new Notice(t("crypto.notice.encryptSuccess"));
				},
			});
		});
	}

	async function edit() {
		await perform(async () => {
			const session = sessionRef.current;
			if (!session || !mounted.current) return;
			const editor = openCryptoEditor(plugin.app, {
				text: session.text, remark: session.remark, language: session.language,
			}, async (draft) => {
				if (!mounted.current || sessionRef.current !== session) throw new BlockConflictError();
				const body = await encryptContent(draft.text, session.password, draft.remark, draft.language);
				if (!mounted.current || sessionRef.current !== session) throw new BlockConflictError();
				await writeTarget(plugin.app, session.target, body);
				if (mounted.current) clearSession();
				new Notice(t("crypto.ui.saved"));
			});
			editorRef.current = editor;
			setEditing(true);
			try { await editor.finished; } finally {
				editorRef.current = null;
				if (mounted.current) setEditing(false);
			}
		});
	}

	async function changePassword() {
		await perform(async () => {
			const session = sessionRef.current;
			if (!session) return;
			await openCryptoDialog(plugin.app, {
				mode: "change", title: t("crypto.ui.changePassword"), submitLabel: t("crypto.ui.changePassword"),
				description: t("crypto.ui.passwordHistoryWarning"),
				onSubmit: async ({ password, oldPassword }) => {
					const result = await unlockContent(session.target.snapshot.block.body, oldPassword ?? "");
					const body = await encryptContent(result.text, password, result.remark, result.language);
					await writeTarget(plugin.app, session.target, body);
					if (mounted.current) clearSession();
					new Notice(t("crypto.ui.passwordChanged"));
				},
			});
		});
	}

	async function permanentlyDecrypt() {
		await perform(async () => {
			const session = sessionRef.current;
			const finish = async (captured: BlockTarget, text: string) => {
				if (!mounted.current) throw new BlockConflictError();
				await writeTarget(plugin.app, captured, text);
				if (mounted.current) clearSession();
				new Notice(t("crypto.notice.decryptToFileSuccess"));
			};
			if (session) {
				if (!await confirmModal(plugin.app, {
					title: t("crypto.ui.decryptPermanent"), message: t("crypto.ui.permanentWarning"),
					confirmText: t("crypto.ui.decryptPermanent"), cancelText: t("crypto.ui.cancel"),
				})) return;
				await finish(session.target, session.text);
			} else {
				const captured = await target();
				await openCryptoDialog(plugin.app, {
					mode: "decrypt", title: t("crypto.ui.decryptPermanent"), submitLabel: t("crypto.ui.decryptPermanent"),
					description: t("crypto.ui.permanentWarning"),
					onSubmit: async ({ password }) => {
						const result = await unlockContent(captured.snapshot.block.body, password);
						await finish(captured, result.text);
					},
				});
			}
		});
	}

	function showMenu(event: React.MouseEvent) {
		const menu = new Menu();
		menu.addItem((item) => item.setTitle(t("crypto.ui.changePassword")).setIcon("key-round")
			.setDisabled(busy).onClick(() => void changePassword()));
		menu.showAtMouseEvent(event.nativeEvent);
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(sessionContent?.text ?? source);
			new Notice(t("crypto.notice.copyPlainSuccess"));
		} catch { setError(t("crypto.ui.copyFailed")); }
	}

	const showingPreview = !!sessionContent || plainPreview;
	const statusLabel = t(sessionContent ? "crypto.ui.unlocked" : encrypted ? "crypto.status.encrypted" : "crypto.status.unencrypted");
	return (
		<div className="crypto-code-block" aria-busy={busy}
			onPointerDown={() => { activity.current = Date.now(); }}
			onKeyDown={() => { activity.current = Date.now(); }}
			onScrollCapture={() => { activity.current = Date.now(); }}>
			<div className={`status-indicator${encrypted && !sessionContent ? " encrypted" : ""}`}
				role="img" aria-label={statusLabel} title={sessionContent ? `${statusLabel}: ${t("crypto.ui.sessionOnly")}` : statusLabel} />
			<div className="content-area">
			{showingPreview ? <div className="decrypted-preview">
				<div ref={previewRef} className="preview-content markdown-preview-view" style={{ maxHeight: plugin.settings.cryptoBlockHeight }} />
			</div> : <div className="remark-text" style={{ maxHeight: plugin.settings.cryptoBlockHeight }}>
				{encrypted ? bundle?.remark || t("crypto.remark.empty") : source}
			</div>}
			{encrypted && !bundle && <p className="crypto-error crypto-inline-message">{t("crypto.notice.decryptFailedBadFormat")}</p>}
			</div>
			{error && <p className="crypto-error crypto-inline-message" role="alert">{error}</p>}
			<footer className="crypto-code-block-footer">
				{busy && <span className="crypto-footer-label" role="status">{t(editing ? "crypto.ui.editing" : "crypto.ui.processing")}</span>}
				<div className="action-buttons">
					{encrypted && <button className="btn" disabled={busy || !bundle} onClick={() => void permanentlyDecrypt()}
						aria-label={t("crypto.ui.decryptPermanent")} title={t("crypto.ui.decryptPermanent")}><LockKeyholeOpen size={14} /></button>}
					{sessionContent ? <>
						<button className="btn" disabled={busy} onClick={() => void edit()}
							aria-label={t("crypto.ui.edit")} title={t("crypto.ui.edit")}><Pencil size={14} /></button>
						<button className="btn" disabled={busy} onClick={() => { if (!active.current) clearSession(); }}
							aria-label={t("crypto.ui.lock")} title={t("crypto.ui.lock")}><LockKeyhole size={14} /></button>
					</> : <>
						{!encrypted && <button className="btn" disabled={busy} onClick={() => void encrypt()}
							aria-label={t("crypto.action.encrypt")} title={t("crypto.action.encrypt")}><KeyRound size={14} /></button>}
						{!plainPreview && <button className="btn" disabled={busy || (encrypted && !bundle)}
							onClick={() => encrypted ? void unlock() : setPlainPreview(true)}
							aria-label={t(encrypted ? "crypto.ui.unlock" : "crypto.action.preview")}
							title={t(encrypted ? "crypto.ui.unlock" : "crypto.action.preview")}><Eye size={14} /></button>}
					</>}
					{plainPreview && !sessionContent && <button className="btn" disabled={busy} onClick={() => setPlainPreview(false)}
						aria-label={t("crypto.action.closePreview")} title={t("crypto.action.closePreview")}><X size={14} /></button>}
					{sessionContent && <button className="btn" disabled={busy} onClick={showMenu}
						aria-label={t("crypto.ui.more")} title={t("crypto.ui.more")}><Ellipsis size={14} /></button>}
					{(!encrypted || sessionContent) && <button className="btn" disabled={busy} onClick={() => void copy()}
						aria-label={t("crypto.action.copy")} title={t("crypto.action.copy")}><Copy size={14} /></button>}
				</div>
			</footer>
		</div>
	);
}
