# 开发环境与本地调试

面向开发者与 Agent；本文只负责环境、命令和本地运行。开始修改前阅读 [Agent 入口](../AGENTS.md) 与 [开发规范](./CONVENTIONS.md)。模块定位见 [架构](./ARCHITECTURE.md)，验收见 [测试](./TESTING.md)，发布见 [发布流程](./RELEASE.md)。

## 环境与命令

Node.js 版本以 [`.node-version`](../.node-version) 为准，pnpm 版本以 [`package.json`](../package.json) 的 `packageManager` 为准。CI 与本地统一使用 pnpm，不混用 `npm install`；依赖更新须同步提交 `pnpm-lock.yaml`。

```bash
pnpm install --frozen-lockfile # 按锁文件安装，本地与 CI 一致
pnpm dev                     # watch 构建，不是 Vite 开发服务器
pnpm lint                    # ESLint
pnpm test                    # Node 内置回归测试
pnpm build                   # tsc --noEmit + 生产构建
pnpm check                   # lint → test → build，任一步失败即停止
```

命令的准确定义以 `package.json` 为准。包管理器设置见 [`pnpm-workspace.yaml`](../pnpm-workspace.yaml)，注册表 / 认证配置不要复制到文档。

## 本地构建与安装

Vite 输出到 `dist/`：

```text
dist/
  main.js
  styles.css
  manifest.json
```

将三个文件复制到独立测试笔记库的插件目录，安装路径见 [用户安装说明](../README.md#安装与更新)。可以将测试插件目录软链接到 `dist/`，但**每次构建会清空 `dist/`，不得把真实设置、笔记或其他需要保留的数据放在其中**。覆盖更新应保留已安装目录中的 `data.json`。

只使用人工构造的测试笔记和密码。先在测试库验证，不要直接对个人主库执行开发中的写回操作。

## 技术与实现入口

- React + TypeScript：设置界面、加密视图和弹窗。
- Vite lib 模式：CJS 单入口，SCSS 样式，构建时复制 manifest。
- Obsidian / CodeMirror：宿主渲染、编辑器、命令和文件写入。
- i18next / react-i18next：中英文界面。
- react-colorful：颜色选择器。

依赖具体版本以 `package.json` 与锁文件为准，不在文档重复维护版本表。模块职责与数据流以 [架构](./ARCHITECTURE.md) 为入口。

## 调试边界

- `src/` 运行于宿主 WebView，构建脚本和测试运行于 Node；两者允许的 API 不同。
- `pnpm dev` 只重新生成产物，仍需在宿主中重新加载插件来验证注册与卸载。
- 不向日志输出密码、明文草稿或真实笔记路径；诊断信息遵循 [隐私规范](./CONVENTIONS.md#隐私与脱敏)。
- 测试失败时定位真实原因，不跳过测试、不放宽规则或产物导入允许列表。
