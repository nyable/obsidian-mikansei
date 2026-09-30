import { Modal, Setting } from "obsidian";
import type { App } from "obsidian";

export interface ConfirmOptions {
	title: string;
	message: string;
	confirmText: string;
	cancelText: string;
}

/**
 * 一个简单的确认弹窗，返回用户是否确认。
 */
export function confirmModal(
	app: App,
	options: ConfirmOptions
): Promise<boolean> {
	return new Promise((resolve) => {
		const modal = new Modal(app);
		let settled = false;
		const settle = (value: boolean) => {
			if (settled) return;
			settled = true;
			resolve(value);
		};

		modal.titleEl.setText(options.title);
		modal.contentEl.createEl("p", { text: options.message });
		new Setting(modal.contentEl)
			.addButton((btn) =>
				btn.setButtonText(options.cancelText).onClick(() => {
					settle(false);
					modal.close();
				})
			)
			.addButton((btn) =>
				btn
					.setButtonText(options.confirmText)
					.setWarning()
					.onClick(() => {
						settle(true);
						modal.close();
					})
			);

		modal.onClose = () => settle(false);
		modal.open();
	});
}
