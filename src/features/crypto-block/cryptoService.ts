import { i18n } from "src/i18n";
import { BlockConflictError } from "./blockContent";
import { base64ToString, decryptAesGcm, encryptAesGcm, stringToBase64, type AesGcmEncryptResult } from "./crypto";

export class CryptoFormatError extends Error {}
export class CryptoAuthenticationError extends Error {}

export function readBundle(source: string): AesGcmEncryptResult | null {
	try {
		const data = JSON.parse(base64ToString(source.replace(/\s/g, "")));
		if (!data || typeof data !== "object" ||
			typeof data.salt !== "string" || typeof data.iv !== "string" || typeof data.text !== "string" ||
			!Number.isSafeInteger(data.iterations) || data.iterations < 1000 || data.iterations > 10_000_000 ||
			typeof data.timestamp !== "number" || !Number.isFinite(data.timestamp) || data.timestamp <= 0 ||
			(data.remark !== undefined && typeof data.remark !== "string") ||
			(data.language !== undefined && typeof data.language !== "string")) return null;
		const salt = window.atob(data.salt);
		const iv = window.atob(data.iv);
		const text = window.atob(data.text);
		if (salt.length !== 16 || iv.length !== 12 || text.length < 16) return null;
		return { ...data, remark: data.remark ?? "", language: safeLanguage(data.language ?? "text") };
	} catch {
		return null;
	}
}

export function safeLanguage(language: string): string {
	return /^[\w#+.-]{1,40}$/.test(language) ? language : "text";
}

export async function unlockContent(source: string, password: string) {
	const bundle = readBundle(source);
	if (!bundle) throw new CryptoFormatError();
	try {
		const result = await decryptAesGcm(source.replace(/\s/g, ""), password);
		return { ...result, remark: bundle.remark, language: bundle.language ?? "text" };
	} catch {
		throw new CryptoAuthenticationError();
	}
}

export async function encryptContent(text: string, password: string, remark: string, language: string): Promise<string> {
	return stringToBase64(JSON.stringify(await encryptAesGcm(text, password, remark, safeLanguage(language))));
}

export function cryptoErrorMessage(error: unknown): string {
	if (error instanceof BlockConflictError) return i18n.t("crypto.ui.conflict");
	if (error instanceof CryptoFormatError) return i18n.t("crypto.notice.decryptFailedBadFormat");
	if (error instanceof CryptoAuthenticationError) return i18n.t("crypto.notice.decryptFailedWrongPassword");
	return i18n.t("crypto.ui.operationFailed");
}
