import { createElement } from "react";
import { MarkdownPreviewRenderer } from "obsidian";
import type Mikansei from "src/main";
import { ReactRenderChild } from "src/shared/react/ReactRenderChild";
import { CryptoCodeBlockView } from "./components/CryptoCodeBlockView";

export const codeBlockCrypto = (plugin: Mikansei) => {
	// 获取自定义的语言名称
	const langName = plugin.settings.cryptoBlockLanguage || "nya";

	let disposed = false;
	const children = new Set<ReactRenderChild>();
	const processor = MarkdownPreviewRenderer.createCodeBlockPostProcessor(langName, (source, el, ctx) => {
		if (disposed) return;
		el.empty();
		const child = new ReactRenderChild(
			el,
			createElement(CryptoCodeBlockView, {
				key: source,
				source,
				el,
				ctx,
				plugin,
			})
		);
		children.add(child);
		child.register(() => children.delete(child));
		ctx.addChild(child);
	});
	MarkdownPreviewRenderer.registerPostProcessor(processor);
	return () => {
		if (disposed) return;
		disposed = true;
		MarkdownPreviewRenderer.unregisterPostProcessor(processor);
		for (const child of children) child.unload();
		children.clear();
	};
};
