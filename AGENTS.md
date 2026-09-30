# AGENTS.md

本项目的开发规范见 [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md)。几条硬性要求：

1. **高频交互不要直接持久化**：输入 / 拖拽等 `onChange` 可能每秒触发几十次，禁止在回调里直接写回 `plugin.settings` 并 `saveSettings()`。应使用「本地草稿状态 + 防抖提交 + 交互结束/关闭/卸载时 flush」。参考 `src/settings/components/ColorInput.tsx`。
2. **i18n**：面向用户的文案必须走 `src/i18n`，中英文键集保持一致。
3. **提交前**：`pnpm build`（含 `tsc --noEmit`）与 `pnpm lint` 必须通过。
4. **加密数据格式**：`src/features/crypto-block/crypto.ts` 的算法与打包格式保持向后兼容，不得随意改动。
