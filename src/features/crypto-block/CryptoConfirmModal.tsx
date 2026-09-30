import { Modal } from "obsidian";
import type { App } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { DecryptDialog } from "./components/DecryptDialog";
import { EncryptDialog } from "./components/EncryptDialog";
import type { CryptoConfirmData } from "./types";

/**
 * 打开加解密确认对话框，返回用户提交的数据；关闭/取消时返回 null。
 */
export function openCryptoDialog(
	app: App,
	type: "encrypt" | "decrypt"
): Promise<CryptoConfirmData | null> {
	return new Promise((resolve) => {
		new CryptoConfirmModal(app, type, resolve).open();
	});
}

class CryptoConfirmModal extends Modal {
	private root: Root | null = null;
	private settled = false;

	constructor(
		app: App,
		private readonly type: "encrypt" | "decrypt",
		private readonly resolve: (data: CryptoConfirmData | null) => void
	) {
		super(app);
	}

	onOpen(): void {
		this.root = createRoot(this.contentEl);
		const submit = (data: CryptoConfirmData) => {
			this.settle(data);
			this.close();
		};
		this.root.render(
			this.type === "encrypt" ? (
				<EncryptDialog submitHandler={submit} />
			) : (
				<DecryptDialog submitHandler={submit} />
			)
		);
	}

	onClose(): void {
		this.settle(null);
		this.root?.unmount();
		this.root = null;
		this.contentEl.empty();
	}

	private settle(data: CryptoConfirmData | null): void {
		if (this.settled) return;
		this.settled = true;
		this.resolve(data);
	}
}
