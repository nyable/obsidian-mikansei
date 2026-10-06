import { createElement } from "react";
import type Mikansei from "src/main";
import { ReactRenderChild } from "src/shared/react/ReactRenderChild";
import { CryptoCodeBlockView } from "./components/CryptoCodeBlockView";

export const codeBlockCrypto = (plugin: Mikansei) => {
	// 获取自定义的语言名称
	const langName = plugin.settings.cryptoBlockLanguage || "nya";

	// 注册代码块
	plugin.registerMarkdownCodeBlockProcessor(langName, (source, el, ctx) => {
		el.empty();
		ctx.addChild(
			new ReactRenderChild(
				el,
				createElement(CryptoCodeBlockView, {
					key: source,
					source,
					el,
					ctx,
					plugin,
				})
			)
		);
	});
};
