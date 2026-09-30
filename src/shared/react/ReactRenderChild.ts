import { MarkdownRenderChild } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import type { ReactNode } from "react";

/**
 * 将一棵 React 树挂载到 Obsidian 的 Markdown 渲染容器中，
 * 并随渲染子组件一起卸载（ctx.addChild）。
 */
export class ReactRenderChild extends MarkdownRenderChild {
	private readonly root: Root;

	constructor(containerEl: HTMLElement, node: ReactNode) {
		super(containerEl);
		this.root = createRoot(containerEl);
		this.root.render(node);
	}

	onunload(): void {
		this.root.unmount();
	}
}
