import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PasswordFieldProps {
	label: string;
	value: string;
	onChange: (value: string) => void;
	autoFocus?: boolean;
	newPassword?: boolean;
	disabled?: boolean;
}

export function PasswordField({ label, value, onChange, autoFocus, newPassword, disabled }: PasswordFieldProps) {
	const { t } = useTranslation();
	const id = useId();
	const [visible, setVisible] = useState(false);
	return (
		<div className="crypto-field">
			<label htmlFor={id}>{label}</label>
			<div className="crypto-password-input">
				<input id={id} type={visible ? "text" : "password"} value={value}
					onChange={(event) => onChange(event.target.value)} autoFocus={autoFocus}
					autoComplete={newPassword ? "new-password" : "current-password"}
					spellCheck={false} autoCapitalize="none" disabled={disabled} />
				<button type="button" className="crypto-icon-button" disabled={disabled}
					onClick={() => setVisible(!visible)} aria-pressed={visible}
					aria-label={t(visible ? "crypto.dialog.hidePassword" : "crypto.dialog.showPassword")}>
					{visible ? <EyeOff size={16} /> : <Eye size={16} />}
				</button>
			</div>
		</div>
	);
}
