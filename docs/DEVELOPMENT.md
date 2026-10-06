# 开发文档

## 环境与命令

使用 Node.js 24 LTS（`.node-version`）与 pnpm 12.3.4（`package.json` 的 `packageManager`）。CI 与本地统一使用 pnpm，不混用 `npm install`，依赖更新须提交 `pnpm-lock.yaml`。

```bash
pnpm install --frozen-lockfile # 按锁文件安装依赖（本地和 CI）
pnpm dev         # watch 构建（vite build --watch --mode development）
pnpm build       # 生产构建，内含 tsc --noEmit 类型检查
pnpm lint        # ESLint
pnpm test        # 回归测试
```

构建产物在 `dist/`：

```
dist/
  main.js         # 插件入口（CJS）
  styles.css      # 样式
  manifest.json   # 构建时自动从仓库根目录复制
```

`dist/` 即可作为插件目录放到 vault 的 `.obsidian/plugins/mikansei/`（开发时一般用软链接）。

## 技术栈

- React 19 + TypeScript
- Vite 8（Rolldown + Oxc），lib 模式输出 CJS 单文件
- SCSS + Obsidian CSS 变量（保持主题一致）
- i18next + react-i18next
- react-colorful（带透明度的取色器）

## 目录结构

```
src/
  main.ts                       # 插件入口：加载设置、初始化 i18n、注册功能
  settings/
    types.ts                    # PluginSettings 与默认值
    SettingsTab.tsx             # Obsidian 设置 tab（React root）
    SettingsView.tsx            # 标签栏外壳 + tab 键映射 + 恢复默认
    tabProps.ts                 # 各 tab 共享的 props 类型
    components/
      SettingControls.tsx       # SettingItem / SettingHeading / Toggle / ResetDefaultsItem
      ColorInput.tsx            # 带透明度的取色器（本地草稿 + 防抖提交）
    tabs/
      GeneralTab.tsx  LinkPasteTab.tsx  BracketTab.tsx  CryptoTab.tsx  MiscTab.tsx
  features/
    bracket-matching/
      bracketMatching.ts        # CodeMirror 扩展 + applyBracketStyles
      bracketCommands.ts        # 跳转/选择命令
    link-paste/
      linkPasteEnhancer.ts      # 粘贴链接增强
      LinkActionModal.ts
    crypto-block/
      crypto.ts                 # 加解密（格式冻结，勿改）
      codeBlockProcessor.ts     # 代码块渲染
      cryptoCommands.ts         # 加/解密命令
      CryptoConfirmModal.tsx
      components/               # CryptoCodeBlockView / EncryptDialog / DecryptDialog
  i18n/
    index.ts                    # initI18n / resolveLocale
    i18next.d.ts                # 翻译键类型增强
    locales/zh-CN.ts  locales/en.ts
  shared/
    http.ts                     # 抓取网页标题
    confirmModal.ts             # 确认弹窗
    react/ReactRenderChild.ts   # 把 React 树挂进 Obsidian 渲染容器
  styles/index.scss
```

## 开发规范

### 高频交互不要直接持久化

输入、拖拽取色等 `onChange` 回调可能每秒触发几十次。**严禁**在回调里直接写回 `plugin.settings` 并调用 `saveSettings()`——那会反复落盘 `data.json` 并整页重渲染，导致明显卡顿。

正确做法：

- 组件内部维护**本地草稿状态**（如 `useState`），高频事件只更新草稿，保证即时反馈；
- 持久化改为**防抖提交**（约 200–300ms），并在**交互结束 / 关闭面板 / 组件卸载**时立即 flush；
- 只有提交时才调用 `update()`（写回设置 + `saveSettings()` + 必要的全局副作用）。

参考实现：`src/settings/components/ColorInput.tsx`。

### 其他约定

- **设置面板**：每个功能一个 tab；「恢复默认」必须经过确认弹窗。
- **i18n**：所有面向用户的文案都要走 `src/i18n`，中英文键集必须保持一致（由类型增强与校验脚本保证）。
- **提交前**：必须通过 `pnpm build`（内含 `tsc --noEmit`）与 `pnpm lint`。
- **加密数据格式**：`src/features/crypto-block/crypto.ts` 的打包格式与算法参数不得随意改动，需保持向后兼容。

## 发布流程

- 版本号在 `manifest.json` 与 `versions.json` 中维护；`pnpm version` 会调用 `version-bump.mjs` 并 `git add` 这两个文件。
- 发布产物为 `dist/` 中的 `main.js`、`styles.css`、`manifest.json`。
- 推送分支或提交 PR 会自动执行冻结安装、lint、测试和构建；推送 tag 时，还会校验发布版本并创建 Draft Release。
- 发布前运行 `pnpm check:release -- <tag>`，确认 tag（允许 `v` 前缀）、`package.json`、`manifest.json` 与 `versions.json` 一致，且构建产物完整。直接使用 `node scripts/check-release.mjs <tag>` 也可。
- 构建 job 仅有 `contents: read` 权限；独立发布 job 仅下载同次运行的产物并创建草稿，不执行依赖安装或项目代码。
- Actions 使用完整 commit SHA 固定版本，由 Dependabot 每周检查更新。缓存仅保存 pnpm store，不缓存 `node_modules`。
- 工作流修复后，应从包含修复提交的新版本 tag 发布；重新运行旧 tag 的任务通常仍使用旧工作流。不要随意移动已发布 tag。
