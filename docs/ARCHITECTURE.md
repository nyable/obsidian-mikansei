# 架构与数据边界

本文用于定位实现和理解数据流，不代替 [开发规范](./CONVENTIONS.md) 或 [用户操作说明](./USER-GUIDE.md)。路径均相对仓库根目录。

## 运行模型

这是运行于 Obsidian 的本地插件，没有自建后端、数据库或独立权限系统。React 负责设置与弹窗；Obsidian / CodeMirror 负责编辑器、文件与渲染；Web Crypto 负责加解密。技术与开发命令见 [开发环境](./DEVELOPMENT.md)。

插件与第三方处理器共享宿主权限；网络请求通过 Obsidian `requestUrl` 发出，不存在隔离的服务端代理或渲染沙箱。

## 模块入口

- `src/main.ts`：加载设置、初始化 i18n、注册命令与事件、按需重配置、串行保存。
- `src/settings/`：`types.ts` 定义设置、默认值与持久化校验；`SettingsView.tsx` 协调更新 / 恢复默认；`components/useDebouncedDraft.ts` 管理草稿与提交，`ColorInput.tsx` 复用该机制。
- `src/features/link-paste/`：粘贴事件、动作选择与标题更新；`src/shared/http.ts` 请求及解析标题。
- `src/features/bracket-matching/`：CodeMirror 匹配状态、高亮及按编辑器执行的跳转 / 选择命令。
- `src/features/crypto-block/`：围栏解析、密文服务、写回、命令、密码 / 编辑弹窗、预览与自动锁定。
- `src/shared/react/ReactRenderChild.ts`：将 React 树接入 Obsidian 渲染生命周期。
- `src/i18n/`：中英文资源与类型增强；`src/styles/`：宿主主题样式。
- `tests/`、`scripts/`、`.github/`：验证与发布工具；入口分别见 [测试](./TESTING.md) 和 [发布](./RELEASE.md)。

## 核心流程

### 设置

`loadData → parseSettings → 内存设置 → applySettings`

交互路径为 `本地草稿 → 防抖 / flush → SettingsView.update → applySettings → saveSettings → saveData`。保存使用不可变快照串行排队；重置通过草稿代次废弃旧回调。失败不回滚当前会话值，而是提示并支持重试。

`applySettings` 按受影响字段重新配置编辑器扩展与加密处理器；长期处理器在执行时读取最新设置。无关设置不应销毁解锁会话。

### 链接粘贴

`URL 校验 → 捕获文件 / 文本 / 选区 → 选择动作 → 插入默认内容 → 可选标题请求 → 重新校验 → 更新标题`

先验证 URL 再阻止原生粘贴；请求返回后不能使用新光标替代原始目标。超时只停止等待，不会取消已发出的请求。

### 括号匹配

CodeMirror 渲染时保存当前编辑器状态，命令通过 `currentBracketMatch` 校验文档、选区和当前光标；状态按编辑器弱引用隔离，不使用全局“上一次匹配”。

### 加密与写回

工具栏与命令均经过以下底层模块：

1. `blockContent.ts`：识别围栏，捕获快照，按原始内容定位，歧义时拒绝覆盖。
2. `blockStorage.ts`：捕获具体 `TFile`；优先写有效 source 编辑器以尊重未保存文本并保留撤销，否则使用 `Vault.process`。
3. `cryptoService.ts`：校验密文、适配旧字段、分类格式 / 认证 / 运行异常。
4. `crypto.ts`：既有算法与包结构，必须保持兼容。

`cryptoCommands.ts` 管理每文件操作门禁及取消；`CryptoCodeBlockView.tsx` 管理当前视图的解锁会话；`CryptoConfirmModal.tsx` 负责密码提交，`CryptoEditModal.tsx` 管理独立草稿和退出确认。写入前及宿主回调内校验操作有效期、文件身份与内容冲突。

`previewRendering.ts` 为每次预览创建独立宿主组件，转交 Markdown 渲染并负责清理；旧 API 分支不等于旧宿主已完成实测。自动锁定决策见 `autoLock.ts`，不要把有意的 busy 暂停当成待修缺陷。

## 持久化与信任边界

- **设置**：宿主插件目录的 `data.json`；不存密码、明文草稿或敏感会话。
- **笔记**：围栏内为 Base64 编码的 JSON 密文包，字段包括 `salt`、`iv`、`text`、`iterations`、`timestamp`、`remark`、`language`。Base64 不是加密；正文由 AES-GCM 保护，密钥经 PBKDF2 派生。参数与编码精确定义见 `crypto.ts`，不在文档复制数值常量。
- **历史兼容**：旧包可能没有备注或语言，service 负责回退；围栏换行与字面数据不能混淆。
- **公开元数据**：备注与语言不受正文认证保护；语言会影响第三方渲染器选择。
- **内存**：密码、解锁明文与草稿按当前视图隔离。释放引用不是 JavaScript 物理内存擦除保证。
- **外部副作用**：标题请求、剪贴板、永久解密后的同步 / 历史、第三方渲染动作均不能通过关闭视图全部撤回。

安全限制的用户说明见 [数据与安全限制](./USER-GUIDE.md#数据与安全限制)。尚未确认的策略另列 [验证记录](./RELEASE-VALIDATION.md)，不能据此擅自迁移密文或改变产品行为。
