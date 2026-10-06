import { useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { LockKeyhole } from "lucide-react";
import type { CryptoDialogOptions } from "../types";
import { cryptoErrorMessage, safeLanguage } from "../cryptoService";
import { PasswordField } from "./PasswordField";

export function CryptoDialog({ options, onSuccess, onCancel }: {
	options: CryptoDialogOptions;
	onSuccess: () => void;
	onCancel: () => void;
}) {
	const { t } = useTranslation();
	const id = useId();
	const [password, setPassword] = useState("");
	const [confirmation, setConfirmation] = useState("");
	const [oldPassword, setOldPassword] = useState("");
	const [remarks, setRemarks] = useState(options.remarks ?? "");
	const [language, setLanguage] = useState(options.language ?? "text");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const inFlight = useRef(false);
	const creating = options.mode !== "decrypt";
	const changing = options.mode === "change";
	const errorId = `${id}-error`;

	async function submit(event: FormEvent) {
		event.preventDefault();
		if (inFlight.current) return;
		if (!password.length || (changing && !oldPassword.length)) {
			setError(t("crypto.dialog.error.passwordEmpty"));
			return;
		}
		if (creating && password !== confirmation) {
			setError(t("crypto.dialog.error.passwordMismatch"));
			return;
		}
		if (creating && language !== safeLanguage(language)) {
			setError(t("crypto.ui.languageInvalid"));
			return;
		}
		inFlight.current = true;
		setBusy(true);
		setError("");
		try {
			await options.onSubmit({ password, oldPassword, remarks, language });
			setPassword("");
			setConfirmation("");
			setOldPassword("");
			onSuccess();
		} catch (failure) {
			setError(cryptoErrorMessage(failure));
		} finally {
			inFlight.current = false;
			setBusy(false);
		}
	}

	return (
		<form className="nya-crypto-form" onSubmit={submit} noValidate aria-busy={busy} aria-describedby={error ? errorId : undefined}
			onKeyDown={(event) => {
				if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) {
					event.preventDefault();
					void submit(event);
				}
			}}>
			<div className="crypto-dialog-intro"><LockKeyhole size={20} /><p>{options.description ?? t("crypto.ui.unlockHint")}</p></div>
			{changing && <PasswordField label={t("crypto.ui.oldPassword")} value={oldPassword}
				onChange={setOldPassword} autoFocus disabled={busy} />}
			<PasswordField label={t(changing ? "crypto.ui.newPassword" : "crypto.dialog.password")}
				value={password} onChange={setPassword} autoFocus={!changing} newPassword={creating} disabled={busy} />
			{creating && <>
				<PasswordField label={t("crypto.dialog.confirmPassword")} value={confirmation}
					onChange={setConfirmation} newPassword disabled={busy} />
				{password.length > 0 && password.length < 12 && <p className="crypto-help crypto-warning">{t("crypto.ui.weakPassword")}</p>}
				{!changing && <>
					<div className="crypto-field"><label htmlFor={`${id}-remark`}>{t("crypto.ui.remarkLabel")}</label>
						<textarea id={`${id}-remark`} rows={2} value={remarks} disabled={busy}
							onChange={(event) => setRemarks(event.target.value)} aria-describedby={`${id}-remark-help`} />
						<p id={`${id}-remark-help`} className="crypto-help">{t("crypto.ui.remarkPublic")}</p>
					</div>
					<div className="crypto-field"><label htmlFor={`${id}-language`}>{t("crypto.dialog.language")}</label>
						<input type="text" className="crypto-language-input" id={`${id}-language`} value={language} disabled={busy} autoCapitalize="none" spellCheck={false}
							onChange={(event) => setLanguage(event.target.value)} />
					</div>
				</>}
			</>}
			<div id={errorId} className="crypto-error" role="alert">{error}</div>
			<div className="crypto-dialog-actions">
				<button type="button" disabled={busy} onClick={onCancel}>{t("crypto.ui.cancel")}</button>
				<button type="submit" className="mod-cta" disabled={busy}>
					{busy ? t("crypto.ui.processing") : options.submitLabel}
				</button>
			</div>
			<p className="crypto-help">{t("crypto.dialog.hint")}</p>
		</form>
	);
}
