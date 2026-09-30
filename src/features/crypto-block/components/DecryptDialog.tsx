import { useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import type { CryptoConfirmData } from "../types";

interface DecryptDialogProps {
	submitHandler: (data: CryptoConfirmData) => void;
}

const MIN_PASSWORD_LENGTH = 1;

export function DecryptDialog({ submitHandler }: DecryptDialogProps) {
	const { t } = useTranslation();
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [passwordError, setPasswordError] = useState("");

	const passwordErrorOf = (value: string) =>
		value.length < MIN_PASSWORD_LENGTH
			? t("crypto.dialog.error.passwordTooShort", {
					min: MIN_PASSWORD_LENGTH,
				})
			: "";

	const canSubmit = password.length >= MIN_PASSWORD_LENGTH && !passwordError;

	const handlePasswordChange = (value: string) => {
		setPassword(value);
		setPasswordError(passwordErrorOf(value));
	};

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();

		if (password.length === 0) {
			setPasswordError(t("crypto.dialog.error.passwordEmpty"));
		} else {
			setPasswordError(passwordErrorOf(password));
		}
		if (password.length >= MIN_PASSWORD_LENGTH && !passwordErrorOf(password)) {
			submitHandler({ password, remarks: "" });
			setPassword("");
			setPasswordError("");
		}
	};

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) {
			handleSubmit(e);
		}
	};

	return (
		<div
			className="nya-crypto-form"
			role="dialog"
			aria-labelledby="decrypt-title"
			tabIndex={-1}
			onKeyDown={handleKeyDown}
		>
			<div className="form-header">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="form-icon"
				>
					<rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
					<path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
				</svg>
				<h3 id="decrypt-title" className="form-title">
					{t("crypto.dialog.decryptTitle")}
				</h3>
			</div>

			<form onSubmit={handleSubmit} noValidate className="form-content">
				<div className="form-group">
					<label htmlFor="password">
						{t("crypto.dialog.password")}
					</label>
					<div className="input-wrapper">
						<input
							type={showPassword ? "text" : "password"}
							id="password"
							value={password}
							onChange={(e) => handlePasswordChange(e.target.value)}
							onBlur={() => setPasswordError(passwordErrorOf(password))}
							className={passwordError ? "invalid" : ""}
							placeholder={t(
								"crypto.dialog.passwordPlaceholder"
							)}
							aria-describedby={
								passwordError ? "password-error" : undefined
							}
							aria-invalid={!!passwordError}
						/>
						<button
							type="button"
							className="toggle-visibility"
							onClick={() => setShowPassword((v) => !v)}
							aria-label={
								showPassword
									? t("crypto.dialog.hidePassword")
									: t("crypto.dialog.showPassword")
							}
						>
							{showPassword ? (
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
								>
									<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
									<line x1="1" y1="1" x2="23" y2="23"></line>
								</svg>
							) : (
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
								>
									<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
									<circle cx="12" cy="12" r="3"></circle>
								</svg>
							)}
						</button>
					</div>
					<p
						id="password-error"
						className="error-message"
						style={{ visibility: passwordError ? "visible" : "hidden" }}
						aria-live="polite"
					>
						{passwordError || "\u00a0"}
					</p>
				</div>

				<button type="submit" className="submit-btn" disabled={!canSubmit}>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
						<path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
					</svg>
					{t("crypto.dialog.submitDecrypt")}
				</button>
				<p className="hint-text">{t("crypto.dialog.hint")}</p>
			</form>
		</div>
	);
}
