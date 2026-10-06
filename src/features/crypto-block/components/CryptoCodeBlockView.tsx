import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { loadPrism, Menu, Notice, type MarkdownPostProcessorContext } from "obsidian";
import { Copy, Ellipsis, LockKeyhole, LockKeyholeOpen, Pencil } from "lucide-react";
import type Mikansei from "src/main";
import { confirmModal } from "src/shared/confirmModal";
import { askDirtyAction, openCryptoDialog } from "../CryptoConfirmModal";
import { isEncryptedContent } from "../crypto";
import { captureTarget, writeTarget, type BlockTarget } from "../blockStorage";
import { BlockConflictError } from "../blockContent";
import { cryptoErrorMessage, encryptContent, readBundle, safeLanguage, unlockContent } from "../cryptoService";
import { autoLockDecision } from "../autoLock";

interface CryptoCodeBlockViewProps {
	source: string;
	el: HTMLElement;
	ctx: MarkdownPostProcessorContext;
	plugin: Mikansei;
}

interface ContentDraft { text: string; remark: string; language: string }
interface Session extends ContentDraft { password: string; target: BlockTarget }

export function CryptoCodeBlockView({ source, el, ctx, plugin }: CryptoCodeBlockViewProps) {
	const { t } = useTranslation();
	const id = useId();
	const encrypted = useMemo(() => isEncryptedContent(source), [source]);
	const bundle = useMemo(() => readBundle(source), [source]);
	const [sessionContent, setSessionContent] = useState<ContentDraft | null>(null);
	const [draft, setDraft] = useState<ContentDraft | null>(null);
	const [editing, setEditing] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [paused, setPaused] = useState(false);
	const sessionRef = useRef<Session | null>(null);
	const active = useRef(false);
	const mounted = useRef(true);
	const dirtyRef = useRef(false);
	const activity = useRef(Date.now());
	const codeRef = useRef<HTMLElement>(null);
	const translate = useRef(t);
	translate.current = t;
	const dirty = !!draft && !!sessionContent && (
		draft.text !== sessionContent.text || draft.remark !== sessionContent.remark || draft.language !== sessionContent.language
	);
	dirtyRef.current = dirty;

	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
			if (dirtyRef.current) new Notice(translate.current("crypto.ui.draftLost"), 8000);
			sessionRef.current = null;
		};
	}, []);

	const clearSession = useCallback(() => {
		sessionRef.current = null;
		dirtyRef.current = false;
		setSessionContent(null);
		setDraft(null);
		setEditing(false);
		setPaused(false);
		setError("");
	}, []);

	useEffect(() => {
		if (!sessionContent) return;
		const doc = el.ownerDocument;
		const check = () => {
			const decision = autoLockDecision(plugin.settings.cryptoAutoLockMinutes, activity.current, Date.now(), active.current, dirtyRef.current);
			if (decision === "pause") setPaused(true);
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
		const node = codeRef.current;
		if (!node || editing) return;
		let cancelled = false;
		void loadPrism().then((prism) => {
			if (!cancelled && mounted.current && node.isConnected) prism.highlightElement(node);
		}).catch(() => { /* Plain text remains readable if highlighting is unavailable. */ });
		return () => { cancelled = true; };
	}, [sessionContent, editing, source]);

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
					setDraft(content);
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

	async function save() {
		const session = sessionRef.current;
		if (!session || !draft) throw new BlockConflictError();
		if (safeLanguage(draft.language) !== draft.language) throw new Error();
		const body = await encryptContent(draft.text, session.password, draft.remark, draft.language);
		// Successful source replacement can unmount this view synchronously.
		dirtyRef.current = false;
		try { await writeTarget(plugin.app, session.target, body); } catch (failure) {
			dirtyRef.current = dirty;
			throw failure;
		}
		if (mounted.current) clearSession();
		new Notice(t("crypto.ui.saved"));
	}

	async function leave(lock: boolean) {
		await perform(async () => {
			if (dirty) {
				const choice = await askDirtyAction(plugin.app);
				if (choice === "continue") return;
				if (choice === "save") { await save(); return; }
			}
			if (!mounted.current) return;
			if (lock) clearSession();
			else { setDraft(sessionContent); setEditing(false); setPaused(false); }
		});
	}

	async function changePassword() {
		await perform(async () => {
			const session = sessionRef.current;
			if (!session || dirty) return;
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
			if (!session || dirty) return;
			if (!await confirmModal(plugin.app, {
				title: t("crypto.ui.decryptPermanent"), message: t("crypto.ui.permanentWarning"),
				confirmText: t("crypto.ui.decryptPermanent"), cancelText: t("crypto.ui.cancel"),
			})) return;
			await writeTarget(plugin.app, session.target, session.text);
			if (mounted.current) clearSession();
			new Notice(t("crypto.notice.decryptToFileSuccess"));
		});
	}

	function showMenu(event: React.MouseEvent) {
		const menu = new Menu();
		menu.addItem((item) => item.setTitle(t("crypto.ui.changePassword")).setIcon("key-round")
			.setDisabled(dirty || busy).onClick(() => void changePassword()));
		menu.addItem((item) => item.setTitle(t("crypto.ui.decryptPermanent")).setIcon("lock-keyhole-open")
			.setDisabled(dirty || busy).onClick(() => void permanentlyDecrypt()));
		menu.showAtMouseEvent(event.nativeEvent);
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(editing ? draft?.text ?? "" : sessionContent?.text ?? source);
			new Notice(t("crypto.notice.copyPlainSuccess"));
		} catch { setError(t("crypto.ui.copyFailed")); }
	}

	const language = sessionContent?.language ?? "text";
	return (
		<div className="crypto-code-block" aria-busy={busy}
			onPointerDown={() => { activity.current = Date.now(); }}
			onKeyDown={() => { activity.current = Date.now(); }}
			onScrollCapture={() => { activity.current = Date.now(); }}>
			<header className="crypto-block-header">
				<div className="crypto-block-status">
					{sessionContent || !encrypted ? <LockKeyholeOpen size={16} /> : <LockKeyhole size={16} />}
					<span>{t(sessionContent ? "crypto.ui.unlocked" : encrypted ? "crypto.status.encrypted" : "crypto.status.unencrypted")}</span>
				</div>
				{sessionContent && <div className="crypto-toolbar">
					<button disabled={busy} onClick={() => void leave(true)}><LockKeyhole size={14} />{t("crypto.ui.lock")}</button>
					<button className="crypto-icon-button" disabled={busy} onClick={showMenu} aria-label={t("crypto.ui.more")} title={t("crypto.ui.more")}><Ellipsis size={18} /></button>
				</div>}
			</header>
			{sessionContent && <p className="crypto-session-hint">{t("crypto.ui.sessionOnly")}</p>}
			{editing && draft ? <div className="crypto-edit-area">
				<label htmlFor={`${id}-text`}>{t("crypto.ui.content")}</label>
				<textarea id={`${id}-text`} className="crypto-editor" value={draft.text} autoFocus spellCheck={false}
					disabled={busy} onChange={(event) => setDraft({ ...draft, text: event.target.value })}
					onKeyDown={(event) => {
						if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) {
							event.preventDefault();
							void perform(save);
						}
					}} />
				<label htmlFor={`${id}-remark`}>{t("crypto.ui.remarkLabel")}</label>
				<textarea id={`${id}-remark`} rows={2} disabled={busy} value={draft.remark}
					onChange={(event) => setDraft({ ...draft, remark: event.target.value })} />
				<p className="crypto-help">{t("crypto.ui.remarkPublic")}</p>
				<label htmlFor={`${id}-lang`}>{t("crypto.dialog.language")}</label>
				<input id={`${id}-lang`} disabled={busy} value={draft.language} spellCheck={false} autoCapitalize="none"
					onChange={(event) => setDraft({ ...draft, language: event.target.value })} />
				{draft.language !== safeLanguage(draft.language) && <p className="crypto-error">{t("crypto.ui.languageInvalid")}</p>}
				<p className="crypto-help">{t("crypto.ui.editMemoryHint")}</p>
			</div> : encrypted && !sessionContent ? <div className="crypto-locked-content">
				<p className="crypto-remark">{bundle?.remark || t("crypto.ui.lockedHint")}</p>
				{bundle?.remark && <p className="crypto-help">{t("crypto.ui.publicRemark")}</p>}
				{!bundle && <p className="crypto-error">{t("crypto.notice.decryptFailedBadFormat")}</p>}
			</div> : <pre className="crypto-code-preview" style={{ maxHeight: plugin.settings.cryptoBlockHeight }}>
				<code key={`${language}-${!!sessionContent}`} ref={codeRef} className={`language-${language}`}>{sessionContent?.text ?? source}</code>
			</pre>}
			{error && <p className="crypto-error crypto-inline-message" role="alert">{error}</p>}
			{paused && dirty && <p className="crypto-warning crypto-inline-message" role="status">{t("crypto.ui.lockPaused")}</p>}
			<footer className="crypto-block-footer">
				<span className="crypto-footer-label">{editing ? t(dirty ? "crypto.ui.unsaved" : "crypto.ui.editing") : sessionContent ? language : ""}</span>
				<div className="crypto-toolbar">
					{(!encrypted || sessionContent) && <button disabled={busy} onClick={() => void copy()}><Copy size={14} />{t("crypto.action.copy")}</button>}
					{editing ? <>
						<button disabled={busy} onClick={() => void leave(false)}>{t("crypto.ui.cancel")}</button>
						<button className="mod-cta" disabled={busy || !dirty || draft?.language !== safeLanguage(draft?.language ?? "")}
							onClick={() => void perform(save)}>{t(busy ? "crypto.ui.processing" : "crypto.ui.saveEncrypted")}</button>
					</> : sessionContent ? <button disabled={busy} onClick={() => { setDraft(sessionContent); setEditing(true); }}><Pencil size={14} />{t("crypto.ui.edit")}</button>
						: <button className="mod-cta" disabled={busy || (encrypted && !bundle)} onClick={() => void (encrypted ? unlock() : encrypt())}>
							<LockKeyhole size={14} />{t(busy ? "crypto.ui.processing" : encrypted ? "crypto.ui.unlock" : "crypto.action.encrypt")}
						</button>}
				</div>
			</footer>
		</div>
	);
}
