import { useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import type { CryptoConfirmData } from "../types";

interface EncryptDialogProps {
	submitHandler: (data: CryptoConfirmData) => void;
}

const MIN_PASSWORD_LENGTH = 1;

export function EncryptDialog({ submitHandler }: EncryptDialogProps) {
	const { t } = useTranslation();
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [remarks, setRemarks] = useState("");
	const [language, setLanguage] = useState("text");
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);

	const [passwordError, setPasswordError] = useState("");
	const [confirmPasswordError, setConfirmPasswordError] = useState("");
	const [remarksError, setRemarksError] = useState("");

	const passwordErrorOf = (value: string) =>
		value.length > 0 && value.length < MIN_PASSWORD_LENGTH
			? t("crypto.dialog.error.passwordTooShort", {
					min: MIN_PASSWORD_LENGTH,
				})
			: "";

	const confirmErrorOf = (pw: string, cpw: string) =>
		cpw.length > 0 && pw !== cpw
			? t("crypto.dialog.error.passwordMismatch")
			: "";

	const remarksErrorOf = (value: string) =>
		value.trim() === "" ? t("crypto.dialog.error.remarksEmpty") : "";

	const handlePasswordChange = (value: string) => {
		setPassword(value);
		setPasswordError(passwordErrorOf(value));
		setConfirmPasswordError(confirmErrorOf(value, confirmPassword));
	};

	const handleConfirmPasswordChange = (value: string) => {
		setConfirmPassword(value);
		setConfirmPasswordError(confirmErrorOf(password, value));
	};

	const handleRemarksChange = (value: string) => {
		setRemarks(value);
		setRemarksError(remarksErrorOf(value));
	};

	const canSubmit =
		password.length >= MIN_PASSWORD_LENGTH &&
		password === confirmPassword &&
		remarks.trim() !== "" &&
		!passwordError &&
		!confirmPasswordError &&
		!remarksError;

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();

		setPasswordError(
			password.length === 0
				? t("crypto.dialog.error.passwordEmpty")
				: passwordErrorOf(password)
		);
		setConfirmPasswordError(
			confirmPassword.length === 0 && password.length > 0
				? t("crypto.dialog.error.confirmRequired")
				: confirmErrorOf(password, confirmPassword)
		);
		setRemarksError(remarksErrorOf(remarks));

		const isValid =
			password.length >= MIN_PASSWORD_LENGTH &&
			password === confirmPassword &&
			remarks.trim() !== "";

		if (isValid) {
			submitHandler({ password, remarks, language });
			setPassword("");
			setConfirmPassword("");
			setRemarks("");
			setLanguage("text");
			setPasswordError("");
			setConfirmPasswordError("");
			setRemarksError("");
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
			aria-labelledby="encrypt-title"
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
					<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
				</svg>
				<h3 id="encrypt-title" className="form-title">
					{t("crypto.dialog.encryptTitle")}
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
							onBlur={() => {
								setPasswordError(passwordErrorOf(password));
								setConfirmPasswordError(
									confirmErrorOf(password, confirmPassword)
								);
							}}
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

				<div className="form-group">
					<label htmlFor="confirmPassword">
						{t("crypto.dialog.confirmPassword")}
					</label>
					<div className="input-wrapper">
						<input
							type={showConfirmPassword ? "text" : "password"}
							id="confirmPassword"
							value={confirmPassword}
							onChange={(e) =>
								handleConfirmPasswordChange(e.target.value)
							}
							onBlur={() =>
								setConfirmPasswordError(
									confirmErrorOf(password, confirmPassword)
								)
							}
							className={confirmPasswordError ? "invalid" : ""}
							placeholder={t(
								"crypto.dialog.confirmPasswordPlaceholder"
							)}
							aria-describedby={
								confirmPasswordError
									? "confirm-password-error"
									: undefined
							}
							aria-invalid={!!confirmPasswordError}
						/>
						<button
							type="button"
							className="toggle-visibility"
							onClick={() => setShowConfirmPassword((v) => !v)}
							aria-label={
								showConfirmPassword
									? t("crypto.dialog.hidePassword")
									: t("crypto.dialog.showPassword")
							}
						>
							{showConfirmPassword ? (
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
						id="confirm-password-error"
						className="error-message"
						style={{
							visibility: confirmPasswordError
								? "visible"
								: "hidden",
						}}
						aria-live="polite"
					>
						{confirmPasswordError || "\u00a0"}
					</p>
				</div>

				<div className="form-group">
					<label htmlFor="remarks">
						{t("crypto.dialog.remarks")}
					</label>
					<textarea
						id="remarks"
						value={remarks}
						onChange={(e) => handleRemarksChange(e.target.value)}
						onBlur={() => setRemarksError(remarksErrorOf(remarks))}
						rows={3}
						placeholder={t("crypto.dialog.remarksPlaceholder")}
						className={remarksError ? "invalid" : ""}
						aria-describedby={
							remarksError ? "remarks-error" : undefined
						}
						aria-invalid={!!remarksError}
					></textarea>
					<p
						id="remarks-error"
						className="error-message"
						style={{ visibility: remarksError ? "visible" : "hidden" }}
						aria-live="polite"
					>
						{remarksError || "\u00a0"}
					</p>
				</div>

				<div className="form-group">
					<label htmlFor="language">
						{t("crypto.dialog.language")}
					</label>
					<div className="input-wrapper">
						<input
							type="text"
							id="language"
							value={language}
							onChange={(e) => setLanguage(e.target.value)}
							placeholder={t(
								"crypto.dialog.languagePlaceholder"
							)}
						/>
					</div>
					<p
						className="error-message"
						style={{ visibility: "hidden" }}
						aria-live="polite"
					>
						&nbsp;
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
						<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
					</svg>
					{t("crypto.dialog.submitEncrypt")}
				</button>
				<p className="hint-text">{t("crypto.dialog.hint")}</p>
			</form>
		</div>
	);
}
