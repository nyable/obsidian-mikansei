export interface CryptoContentDraft {
	text: string;
	remark: string;
	language: string;
}

export interface CryptoConfirmData {
	password: string;
	remarks: string;
	language?: string;
	oldPassword?: string;
}

export interface CryptoDialogOptions {
	mode: "encrypt" | "decrypt" | "change";
	title: string;
	submitLabel: string;
	description?: string;
	remarks?: string;
	language?: string;
	onSubmit: (data: CryptoConfirmData) => Promise<void>;
}
