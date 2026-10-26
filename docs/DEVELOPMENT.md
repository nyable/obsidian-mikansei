# 开发文档

## 环境与命令

使用 Node.js 24 LTS（`.node-version`）与 pnpm 12.3.4（`package.json` 的 `packageManager`）。CI 与本地统一使用 pnpm，不混用 `npm install`，依赖更新须提交 `pnpm-lock.yaml`。

```bash
pnpm install --frozen-lockfile # 按锁文件安装依赖（本地和 CI）
pnpm dev         # watch 构建（vite build --watch --mode development）
pnpm build       # 生产构建，内含 tsc --noEmit 类型检查
pnpm lint        # ESLint
pnpm test        # 回归测试
pnpm check       # 统一验证：lint → test → build，任一步失败即停止
```

构建产物在 `dist/`：

```
dist/
  main.js         # 插件入口（CJS）
  styles.css      # 样式
  manifest.json   # 构建时自动从仓库根目录复制
```

`dist/` 内的三个文件放到 vault 的 `.obsidian/plugins/mikansei/` 即可使用（自定义配置目录时替换 `.obsidian`）。开发时可以将插件目录软链接到 `dist/`，但每次构建会清空 `dist/`，不要把真实设置或笔记保存在其中；使用独立测试仓库并备份设置。正式安装与更新见 [README](../README.md#安装与更新)，更新仅覆盖三个产物，保留已安装目录中的 `data.json`。

## 技术栈

- React 19 + TypeScript
- Vite 8（Rolldown + Oxc），lib 模式输出 CJS 单文件
- SCSS + Obsidian CSS 变量（保持主题一致）
- i18next + react-i18next
- react-colorful（带透明度的取色器）

## 目录结构

```
src/
  main.ts                       # 加载设置 / i18n、applySettings 重配置、顺序保存
  settings/
    types.ts                    # PluginSettings 与默认值
    SettingsTab.tsx             # Obsidian 设置 tab（React root）
    SettingsView.tsx            # 标签栏外壳 + tab 键映射 + 恢复默认
    tabProps.ts                 # 各 tab 共享的 props 类型
    components/
      SettingControls.tsx       # SettingItem / SettingHeading / Toggle / ResetDefaultsItem
      ColorInput.tsx            # 带透明度的取色器（本地草稿 + 防抖提交）
      useDebouncedDraft.ts      # 文本 / 数字草稿：校验、防抖、失焦 / 卸载 flush
    tabs/
      GeneralTab.tsx  LinkPasteTab.tsx  BracketTab.tsx  CryptoTab.tsx  MiscTab.tsx
  features/
    bracket-matching/
      bracketMatching.ts        # CodeMirror 高亮、按编辑器匹配、全局样式与清理
      bracketCommands.ts        # 跳转/选择命令
    link-paste/
      linkPasteEnhancer.ts      # 粘贴链接增强
      LinkActionModal.ts
    crypto-block/
      crypto.ts                 # 加解密（格式冻结，勿改）
      cryptoService.ts          # 密文校验、格式适配与错误分类
      blockContent.ts           # 围栏解析、快照与安全替换
      blockStorage.ts           # 编辑器写回 / Vault.process 原子写回
      codeBlockProcessor.ts     # 代码块渲染注册与 dispose
      cryptoCommands.ts         # 加/解密命令
      CryptoConfirmModal.tsx    # 密码弹窗、未保存修改确认
      CryptoEditModal.tsx       # 独立编辑草稿与保存 / 关闭控制
      previewRendering.ts       # 第三方代码块预览与生命周期
      autoLock.ts               # 自动锁定决策
      types.ts
      components/               # CryptoCodeBlockView / CryptoDialog / CryptoEditDialog / PasswordField
  i18n/
    index.ts                    # initI18n / resolveLocale
    i18next.d.ts                # 翻译键类型增强
    locales/zh-CN.ts  locales/en.ts
  shared/
    http.ts                     # 抓取网页标题
    confirmModal.ts             # 确认弹窗
    react/ReactRenderChild.ts   # 把 React 树挂进 Obsidian 渲染容器
  styles/index.scss
tests/                          # Node 内置测试；按功能拆分的 *.test.mjs
scripts/check-release.mjs        # 发布元数据与三个产物校验
vite.config.mts                 # CJS 单文件、移动端环境替换、manifest 复制
eslint.config.mjs               # TypeScript / Hooks / 移动端运行时限制
```

## 开发规范

### 高频交互不要直接持久化

输入、拖拽取色等 `onChange` 回调可能每秒触发几十次。**严禁**在回调里直接写回 `plugin.settings` 并调用 `saveSettings()`——那会反复落盘 `data.json` 并整页重渲染，导致明显卡顿。

正确做法：

- 组件内部维护**本地草稿状态**（如 `useState`），高频事件只更新草稿，保证即时反馈；
- 持久化改为**防抖提交**（约 200–300ms），并在**交互结束 / 关闭面板 / 组件卸载**时立即 flush；
- 只有提交时才调用 `update()`（写回设置 + `saveSettings()` + 必要的全局副作用）。

参考实现：`src/settings/components/ColorInput.tsx` 与 `src/settings/components/useDebouncedDraft.ts`。无效草稿不得落盘；外部恢复默认值应取消未提交草稿。数字校验不得用 `value || default` 吞掉合法的 `0`，零值语义必须在文案中说明。

### 移动端运行时与构建边界

- `src/` 运行在 Obsidian WebView 中，不得直接依赖 Node.js / Electron 模块及 `process`、`Buffer`、`require` 等 Node 全局变量。网络、文件等操作优先使用浏览器或 Obsidian API。
- ESLint 的 `no-restricted-imports` / `no-restricted-globals` 会阻止常见直接引用；构建配置、脚本及测试运行在 Node.js 中，不受这些 `src/` 专属规则限制。规则不是安全沙箱，不能替代对间接依赖、动态导入和全局属性访问的审查。
- Vite **lib 模式不会自动替换 `process.env.NODE_ENV`**。必须保留 `vite.config.mts` 的显式 `define`，开发 / 生产分别替换为 `development` / `production` 字面量；不能通过给手机注入假的全局 `process` 来绕过。
- 产物必须保持 CJS 单入口 `main.js`，并包含 `styles.css`、`manifest.json`。Obsidian 提供的 CodeMirror / Lezer 模块应保持外部依赖，避免打入另一个运行时实例；增加外部导入前必须确认目标 Obsidian 版本在移动端也提供该模块。
- `tests/mobile-bundle.test.mjs` 会使用真实 Vite 配置在内存中构建两种模式，检查模块导入允许列表，并在无 Node 全局变量的环境中加载。新增依赖需同时审查浏览器入口、间接依赖与产物，不得仅为消除失败扩大允许列表。
- 新增宿主 API 要核对最低支持版本，必要时同时更新 `manifest.json`、`versions.json` 和用户说明；本地安装的最新类型定义不代表旧版宿主可用。

### 异步操作与写入安全

- 在弹窗或请求开始前捕获具体文件、目标内容和位置；完成后重新校验文件身份、内容、功能状态以及组件是否仍有效。涉及选区的操作还需校验选区，不能读取届时的新光标来替换原操作目标。
- 链接粘贴应先验证 URL 再阻止原生事件。选择后先插入默认链接，再获取标题；内容、文件或选区变化时放弃异步更新，不覆盖用户后续编辑。`fetchTitleTimeout = 0` 表示跳过请求；超时只停止等待，`requestUrl` 不能取消已发送的请求。
- 加密块写回沿用 `blockContent.ts` 的快照 / 冲突检查及 `blockStorage.ts` 的策略：存在有效编辑器时使用编辑器写回并保留撤销；否则使用 `Vault.process`。无法安全定位、目标变化或编辑器缓冲区不一致时拒绝覆盖。
- 编辑器位置按编辑器隔离，敏感会话按当前渲染视图隔离，不得以模块级“上一次匹配”或共享密码代替当前上下文。

### 设置与生命周期

- 设置提交后由 `SettingsView.tsx` 更新内存设置、调用 `Mikansei.applySettings()`，再通过 `saveSettings()` 保存。持久化使用快照并串行执行，失败须被调用方处理，不能让旧写入覆盖新值或静默丢失错误。
- 长期事件处理器在操作时读取最新设置，不要在注册时解构并永久捕获。修改功能开关必须同步实际行为；确需重载的设置在中英文文案与用户说明中明确标注。目前界面语言即时切换，命令名称在重载后更新。
- CodeMirror 扩展通过注册的可变数组重配置并调用 `workspace.updateOptions()`。加密处理器切换使用可重复调用的 dispose 注销旧处理器并卸载已注册子组件，不重复注册事件或命令。
- 未改变加密开关 / 语言标识符时，不得因颜色或超时等无关设置变更销毁解锁会话。更改加密开关 / 标识符会清理原渲染会话，需在文档提醒先保存草稿；不自动迁移已有笔记的围栏标识符。
- 事件、定时器、React root、渲染子组件和全局 CSS 变量 / class 都要有清理路径。异步完成后不得重新挂载已卸载视图，也不得继续提交尚未发起的写入；已发出的宿主操作不能假设能撤销。

### 其他约定

- **设置面板**：每个功能一个 tab；「恢复默认」必须经过确认弹窗。
- **i18n**：所有面向用户的文案都要走 `src/i18n`，中英文键集必须保持一致（由类型增强与回归测试校验）。
- **加密数据格式**：`src/features/crypto-block/crypto.ts` 的打包格式与算法参数不得随意改动，需保持向后兼容。密码和明文草稿不得写入设置、日志或遥测。
- **文档同步**：行为变更须同步 README、设置提示及本开发文档中的相关说明；`AGENTS.md` 只保留硬性规则与引用。不要写死测试总数、产物大小等容易过期的数据。

## 验证与验收

### 自动化门槛

提交前必须通过 `pnpm check`（依次执行 `pnpm lint`、`pnpm test`、`pnpm build`）。也可以分别运行三条命令，但不得省略任何一项；另运行 `git diff --check` 检查补丁空白问题。依赖变更后使用冻结锁文件安装验证可复现性，发布前再运行版本 / 产物检查。CI 已分别执行安装、Lint、测试和构建，无需重复添加相同 job。

测试使用 Node 内置测试器，`pnpm test` 自动发现 `tests/*.test.mjs`，不需要新增测试框架。主要覆盖如下：

- `project-constraints.test.mjs`：通过真实 ESLint 配置验证运行时代码的 Node / Electron 限制与构建脚本边界。
- `mobile-bundle.test.mjs`：开发、生产构建的单入口、必要产物、导入允许列表与无 Node 全局变量加载。测试不写入 `dist/`，不依赖旧构建产物。
- `runtime-regressions.test.mjs`：无效 URL 原生回退、链接 / 图片标题转义、捕获位置、异步内容 / 选区 / 文件保护、最新设置读取、HTTP 超时及按编辑器的括号跳转。
- `settings-runtime.test.mjs`：启动时禁用后再启用、按需重新注册、子组件清理、顺序保存与失败恢复、输入防抖和零值。
- `crypto-block.test.mjs`、`crypto-edit-modal.test.mjs`、`crypto-interactions.test.mjs`：密文兼容、文件冲突、自动锁定、敏感 UI、编辑草稿、预览资源和交互安全；中英文翻译键集也在测试中校验。
- `release.test.mjs`：tag、版本映射和构建 manifest 一致性。

新增或修复行为时必须增加 / 更新对应回归测试。优先执行真实模块、实际构建或事件回调并断言结果，不能只匹配源码字符串。替身测试未覆盖的宿主行为要在手动验收中明确；不得为通过检查禁用规则、删测试或放宽密文兼容校验。

### 移动端真机验收

涉及构建、依赖、编辑器或交互的发布，应分别在 Android / iOS 的测试仓库执行以下检查；桌面端同时回归。只使用非敏感测试内容，更新前保存草稿并备份设置。

- [ ] 将同一构建的三个文件复制到正确插件目录，保留 `data.json`；全新启用和覆盖更新后均能启动。
- [ ] 打开设置页、切换 tab / 语言；输入数字、拖动颜色后关闭面板或重启，确认合法值保存、无效值不写入、触控无明显卡顿。
- [ ] 切换功能开关后立即验证实际行为；重复开关不产生重复弹窗、命令或高亮，关闭后无残留样式。
- [ ] 粘贴链接 / 原文 / 图片、无效 URL；验证标题获取开关、零超时和超时回退。等待标题时输入、移动选区、切换文件或关闭功能，不得覆盖新内容。
- [ ] 在不同笔记及可用的多编辑器场景验证括号高亮、双向跳转和选择，不能沿用其他笔记的位置。
- [ ] 用新建与历史格式的测试密文验证加密、解锁、编辑保存、修改密码和永久解密；错误密码、冲突、取消不改变文件，编辑器写回支持撤销。
- [ ] 验证预览、自动锁定、切换编辑 / 阅读模式及应用前后台；关闭加密功能或更改语言标识符后会话被清理，无迟到的异步写入。

记录设备 / 系统、Obsidian 版本、插件版本或提交、测试模式（开发 / 生产）、检查项结果及失败日志。自动化构建加载使用宿主 API 替身，只证明该测试边界内能加载，不证明 WebView 全部能力、系统剪贴板、软键盘或第三方插件正常。未验证的平台明确记录「未验证」，不得宣称真机兼容全部通过。

## 发布流程

- 版本号在 `manifest.json` 与 `versions.json` 中维护；`pnpm version` 会调用 `version-bump.mjs` 并 `git add` 这两个文件。
- 发布产物为 `dist/` 中的 `main.js`、`styles.css`、`manifest.json`。
- 发布说明列出用户可见变更、安装 / 设置注意事项和实际验证平台；区分自动化、桌面实测、Android / iOS 实测，不把未执行的清单标为通过。
- 推送分支或提交 PR 会自动执行冻结安装、lint、测试和构建；推送 tag 时，还会校验发布版本并创建 Draft Release。
- 发布前运行 `pnpm check:release -- <tag>`，确认 tag（允许 `v` 前缀）、`package.json`、`manifest.json` 与 `versions.json` 一致，且构建产物完整。直接使用 `node scripts/check-release.mjs <tag>` 也可。
- 构建 job 仅有 `contents: read` 权限；独立发布 job 仅下载同次运行的产物并创建草稿，不执行依赖安装或项目代码。
- Actions 使用完整 commit SHA 固定版本，由 Dependabot 每周检查更新。缓存仅保存 pnpm store，不缓存 `node_modules`。
- 工作流修复后，应从包含修复提交的新版本 tag 发布；重新运行旧 tag 的任务通常仍使用旧工作流。不要随意移动已发布 tag。
