import { useId, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { CryptoContentDraft } from "../types";
import { safeLanguage } from "../cryptoService";

interface CryptoEditDialogProps {
	draft: CryptoContentDraft;
	dirty: boolean;
	busy: boolean;
	error: string;
	onChange: (draft: CryptoContentDraft) => void;
	onSave: () => void;
	onCancel: () => void;
}

export function CryptoEditDialog({ draft, dirty, busy, error, onChange, onSave, onCancel }: CryptoEditDialogProps) {
	const { t } = useTranslation();
	const id = useId();
	const invalidLanguage = draft.language !== safeLanguage(draft.language);
	const submit = (event: FormEvent) => {
		event.preventDefault();
		if (!busy && dirty && !invalidLanguage) onSave();
	};
	return (
		<form className="nya-crypto-form nya-crypto-edit-form" onSubmit={submit} noValidate aria-busy={busy}
			onKeyDown={(event) => {
				if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) submit(event);
			}}>
			<div className="crypto-field">
				<label htmlFor={`${id}-text`}>{t("crypto.ui.content")}</label>
				<textarea id={`${id}-text`} className="crypto-editor" autoFocus spellCheck={false} value={draft.text} disabled={busy}
					onChange={(event) => onChange({ ...draft, text: event.target.value })} />
			</div>
			<div className="crypto-field">
				<label htmlFor={`${id}-remark`}>{t("crypto.ui.remarkLabel")}</label>
				<textarea id={`${id}-remark`} rows={2} value={draft.remark} disabled={busy}
					onChange={(event) => onChange({ ...draft, remark: event.target.value })} aria-describedby={`${id}-remark-help`} />
				<p id={`${id}-remark-help`} className="crypto-help">{t("crypto.ui.remarkPublic")}</p>
			</div>
			<div className="crypto-field">
				<label htmlFor={`${id}-language`}>{t("crypto.dialog.language")}</label>
				<input type="text" className="crypto-language-input" id={`${id}-language`} value={draft.language} disabled={busy}
					spellCheck={false} autoCapitalize="none" aria-invalid={invalidLanguage}
					aria-describedby={invalidLanguage ? `${id}-language-error` : undefined}
					onChange={(event) => onChange({ ...draft, language: event.target.value })} />
				{invalidLanguage && <p id={`${id}-language-error`} className="crypto-error">{t("crypto.ui.languageInvalid")}</p>}
			</div>
			<p className="crypto-help">{t("crypto.ui.editMemoryHint")}</p>
			{error && <p className="crypto-error" role="alert">{error}</p>}
			<div className="crypto-dialog-actions">
				{dirty && <span className="crypto-help" role="status">{t("crypto.ui.unsaved")}</span>}
				<button type="button" disabled={busy} onClick={onCancel}>{t("crypto.ui.cancel")}</button>
				<button type="submit" className="mod-cta" disabled={busy || !dirty || invalidLanguage}>
					{t(busy ? "crypto.ui.processing" : "crypto.ui.saveEncrypted")}
				</button>
			</div>
		</form>
	);
}
