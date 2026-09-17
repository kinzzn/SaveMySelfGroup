# 翻译流水线说明（translate.cjs）

本目录提供一个三阶段翻译流水线：**翻译 → 编辑 → 校对**，并支持全局初始化与批量处理。

## 1. 脚本入口

主脚本：`translate.cjs`

支持四种运行模式：

1. 初始化模式（生成全局规范与每篇上下文）
2. 批量模式（循环处理 `source/` 下全部 `.md`）
3. 断点续跑模式（跳过已有完整终稿的文件）
4. 单篇模式（处理指定文件）

---

## 2. 快速命令

### 2.1 初始化（建议先跑）

```bash
node translate.cjs --init "你的全局背景信息"
```

作用：
- 扫描 `source/` 顶层及一层子目录中的 `.md`
- 生成全局风格指南：`prompts/style_guide.md`
- 为每篇生成摘要：`output/<相对目录>/<篇名>/0_context_summary.md`
- 合并外部 context + 每篇摘要（+style_guide）并写入：`output/file_contexts.json`

### 2.2 批量处理

```bash
node translate.cjs --batch "你的全局背景信息"
```

作用：
- 读取 `source/` 顶层及一层子目录中的 `.md`
- 按篇顺序执行：翻译 → 编辑 → 校对
- 每篇输出写入独立目录：`output/<相对目录>/<篇名>/`

### 2.3 断点续跑

```bash
node translate.cjs --resume "你的全局背景信息"
```

作用：
- 扫描范围与 `--batch` 相同
- 如果某篇的 `3_final_proofed.md` 和 `3_proofreading_report.md` 同时存在且非空，则视为已经完成并跳过
- 从第一个未完成文件继续执行翻译 → 编辑 → 校对
- 不覆盖已经完成的正式终稿

### 2.4 单篇处理

```bash
node translate.cjs source/0_INTRO.md "你的全局背景信息"
```

作用：
- 仅处理指定文件
- 同样写入 `output/<篇名>/`

---

## 3. 目录与输入输出

### 3.1 输入目录

- 原文：`source/` 顶层及一层子目录中的 `.md`（例如 `source/PART2/0.md`）
- 提示词：
  - `prompts/translation_expert.md`
  - `prompts/editing_expert.md`
  - `prompts/proofreading_expert.md`
  - `prompts/init_expert.md`

### 3.2 输出目录（按原文相对路径分文件夹）

每篇会生成如下文件（示例：`source/PART2/0.md` 对应 `output/PART2/0/`）：

- `0_context_summary.md`（仅 init 阶段）
- `tmp_trans_input.md`
- `tmp_edit_input.md`
- `tmp_edit_response.md`
- `tmp_proof_input.md`
- `tmp_proof_response.md`
- `1_translated.md`
- `2_edited.md`
- `2_editing_report.md`
- `3_final_proofed.md`
- `3_proofreading_report.md`

全局附加文件：
- `prompts/style_guide.md`
- `output/file_contexts.json`

> 说明：中间文件 `tmp_*` 默认保留，便于追溯与人工检查。

---

## 4. 脚本运行过程（内部流程）

### 4.1 `--init`

1. 读取 `source/` 顶层及一层子目录中 `.md` 的抽样文本
2. 套用 `prompts/init_expert.md`，调用 Claude 生成 `prompts/style_guide.md`
3. 对每篇生成内容摘要并保存到 `output/<篇名>/0_context_summary.md`
4. 合并成每篇 `combinedContext`，写入 `output/file_contexts.json`

为兼容 Windows 命令行长度限制，风格指南输入会在全部文件间均匀抽样，总计最多约 24000 字符；单篇摘要最多读取原文前 20000 字符。初始化阶段由 Node.js 直接接收 Claude 输出并写入文件，不依赖 Claude 的 Read/Write 工具。

### 4.2 `--batch` / 单篇

对每篇执行三步：

1. **翻译**
   - 读取 `translation_expert.md`
   - 注入该篇 context（来自 `file_contexts.json`，若缺失则退回外部 context）
  - 注入一次全局 `style_guide.md`（若 `file_contexts.json` 中已内嵌指南，运行时会去重）
   - 生成 `1_translated.md`

2. **编辑**
   - 读取 `editing_expert.md`
   - 基于原文 + 初稿生成：
     - `2_edited.md`
     - `2_editing_report.md`

3. **校对**
   - 读取 `proofreading_expert.md`
   - 基于原文 + 编辑稿生成：
     - `3_final_proofed.md`
     - `3_proofreading_report.md`

所有阶段都会注入 `prompts/style_guide.md`（若存在）。

三个阶段都会禁用 Claude 工具调用。为避免 Windows 命令行长度限制，Node.js 会把完整任务写入隔离的临时 `CLAUDE.md`，Claude 启动时自动加载该文件；命令行本身只传递一条短执行指令。Claude 只返回文本，由 Node.js 负责写入和拆分输出文件，避免 Agent Maestro 在 Read/Write 工具续轮中触发 Auto 模式路由错误。

### 4.3 长输入与临时文件机制

旧版脚本曾把完整 prompt 作为 `claude -p` 的命令行参数传递。章节原文、篇章 context、全局 Style Guide 和阶段提示词合并后，可能超过 Windows 的进程命令行长度上限，导致：

```text
spawnSync claude ENAMETOOLONG
```

这是本地进程创建错误，发生在网络请求发出之前，因此不是网络故障。当前实现采用两层临时文件：

1. **项目内可追溯文件**
  - `output/<相对目录>/<篇名>/tmp_trans_input.md`
  - `output/<相对目录>/<篇名>/tmp_edit_input.md`
  - `output/<相对目录>/<篇名>/tmp_proof_input.md`
  - 保存各阶段交给 Claude 的完整任务，默认保留，便于人工检查和故障追踪。

2. **系统临时传输文件**
  - 每次调用会在系统临时目录创建 `translate-claude-*` 文件夹。
  - 完整任务复制为该目录中的 `CLAUDE.md`。
  - Claude 以该临时目录为工作目录启动并自动加载 `CLAUDE.md`。
  - 命令行只包含模型参数和一条短执行指令，不再包含章节正文。
  - 调用结束后，无论成功还是失败，临时目录都会在 `finally` 中自动删除。

Claude 的文本输出也通过文件落盘：

- 翻译结果直接写入 `1_translated.md`。
- 编辑完整响应先写入 `tmp_edit_response.md`，再按固定标记拆分为 `2_edited.md` 和 `2_editing_report.md`。
- 校对完整响应先写入 `tmp_proof_response.md`，再按固定标记拆分为 `3_final_proofed.md` 和 `3_proofreading_report.md`。

因此，章节继续增长不会再次占用 Windows 命令行参数空间。项目内 `tmp_*` 文件用于留档，不会自动删除；系统 `%TEMP%/translate-claude-*` 目录仅用于传输，会自动清理。

---

## 5. 主要结构（代码层）

`translate.cjs` 主要函数：

- `runInit()`：执行初始化总流程
- `runBatch()`：批量遍历并处理 source 顶层及一层子目录中的全部 Markdown 文件
- `runSingle()`：单篇处理
- `runPipelineForFile()`：单篇三阶段流水线核心
- `generateGlobalStyleGuide()`：全局术语与风格指南生成
- `generatePerFileContexts()`：每篇摘要与 context map 生成
- `runClaudeToFile()`：通过临时 `CLAUDE.md` 执行 Claude CLI，并将响应写入文件

---

## 6. 运行前检查

- 本机可直接执行 `claude` 命令
- 默认使用 `claude-opus-4-6`，避免 Claude CLI 的 Auto 模式路由错误
- 已在当前仓库目录运行
- `source/` 顶层或一层子目录中有待处理 `.md` 文件
- `prompts/` 下各提示词文件存在

如需使用其他模型，可在运行前设置 `CLAUDE_MODEL`：

```powershell
$env:CLAUDE_MODEL = "claude-sonnet-4-6"
node translate.cjs --init "你的全局背景信息"
```

若出现 `Auto mode needs a prompt or a command to route a request`，说明 Claude CLI 经由 VS Code/Agent Maestro 使用了 Auto 路由。当前脚本会显式传入 `claude-opus-4-6`；请勿将 `CLAUDE_MODEL` 设置为 `auto`。

如果旧版本在某篇的 `tmp_trans_input.md` 处中断，可直接重新运行单篇或 `--batch`；对应篇目的已有阶段输出会被重新生成。

若出现 `spawnSync claude ENAMETOOLONG`，表示完整 prompt 被作为进程参数传递并超过了 Windows 命令行长度上限，请确认正在运行的是已改用临时 `CLAUDE.md` 的当前脚本。该错误发生在网络请求之前，与网络状态无关。

若编辑或校对阶段报告“缺少分隔标记”，先查看对应的 `tmp_edit_response.md` 或 `tmp_proof_response.md`。如果文件内容只有：

```text
Sorry, I can't assist with that.
```

表示 Claude 将原文中的敏感议题误判为不允许处理的请求，并非输出格式本身有误。当前脚本会明确说明这是用户授权的普通图书翻译与编辑任务，并自动重试一次。若第二次仍被拒绝，脚本会报告“Claude 拒绝处理该内容”，而不会继续误报为缺少分隔标记。

如果响应不是通用拒绝，但确实没有 `<<<EDITING_REPORT>>>` 或 `<<<PROOFREADING_REPORT>>>`，脚本才会报告真正的分隔标记错误；完整原始响应会保留在对应的 `tmp_*_response.md` 中供人工检查。
