# 发布流程

面向维护者与 Agent；发布需要明确授权。本文定义流程，[发布与验证记录](./RELEASE-VALIDATION.md) 保存特定时间点结果；阶段性状态不写入 README。

## 版本与自动化入口

- `package.json` 保存包版本，`manifest.json` 保存插件版本与最低宿主版本，`versions.json` 维护发布版本到最低宿主版本的映射。三者须一致。
- `pnpm version` 会触发 `version-bump.mjs`，同步 manifest / 映射并 `git add`；不要为验证文档或构建擅自运行版本命令。
- 产物为 `dist/main.js`、`dist/styles.css`、`dist/manifest.json`。构建会清空 `dist/`，本地数据保护见 [开发环境](./DEVELOPMENT.md#本地构建与安装)。
- CI 入口为 `.github/workflows/Auto Build By Tag.yml`。分支 / PR 执行冻结安装、Lint、测试与构建；push tag 额外校验版本并创建 Draft Release。
- 构建 job 仅 `contents: read`；发布 job 下载同次构建产物，以写权限创建草稿，不重新安装依赖或运行项目代码。
- Actions 固定完整 commit SHA，由 Dependabot 检查更新；缓存保存 pnpm store，不缓存 `node_modules`。

## 发布前检查

1. 确认发布范围、预期提交、版本和最低宿主要求。工作区如有其他人的暂存 / 未暂存改动，不得覆盖、重置或直接发布混合内容。
2. 使用锁文件安装，运行 `pnpm check` 与 `git diff --check`。桌面、最低宿主和移动端验收依 [测试清单](./TESTING.md#移动端真机验收) 执行；未验证明确说明。
3. 从预期提交构建，运行 `pnpm check:release -- <tag>`，也可运行 `node scripts/check-release.mjs <tag>`；tag 允许 `v` 前缀。
4. 检查发布说明：用户可见变化、安装 / 设置注意事项、兼容限制和各平台的实际验证范围。不把模拟加载写成手机实测通过。
5. 经授权推送新 tag，检查同次 CI 产物与 Draft Release，核对后再公开。

### 检查脚本的保证范围

`scripts/check-release.mjs` 仅检查 tag / 包版本 / manifest / 当前版本映射和构建 manifest 一致，以及三个必需文件非空。

它**不能**证明 `main.js` / CSS 来自当前源码，不能证明移动端全部可用，也不会校验远端 Release。相同版本的旧入口仍可能通过该检查，不能把通过输出当作来源证明。

## 附件核对与历史兼容

- 记录构建提交与本地产物 SHA-256，上传后下载实际三个附件并比对哈希，确认不是同版本旧文件。
- 验证实际发布入口的加载能力，不只运行源码构建测试；用户安装的是附件而不是主分支源码。
- 工作流修复后从包含修复的新版本 tag 发布；重跑旧 tag 通常仍使用旧工作流。不要随意移动已发布 tag 或静默替换同版本附件。
- 不为整理文档改写历史 tag 或版本映射。历史映射异常先核对对应附件，再决定兼容处理。
- 更新安装只覆盖三个产物，保留 `data.json`；发布说明提醒先保存草稿与备份设置。

## 记录格式

在 `RELEASE-VALIDATION.md` 追加或更新对应记录：日期、版本 / tag、准确构建提交、验证命令、平台范围、附件哈希核对结果、未验证项。没有可追溯对象的检查只能记录为历史线索。

不要在长期流程中写死测试总数、产物大小或“当前全部通过”。诊断与样本遵循 [隐私规范](./CONVENTIONS.md#隐私与脱敏)。
