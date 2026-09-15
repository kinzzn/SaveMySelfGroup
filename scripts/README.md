# 翻译流水线说明（translate.cjs）

本目录提供一个三阶段翻译流水线：**翻译 → 编辑 → 校对**，并支持全局初始化与批量处理。

## 1. 脚本入口

主脚本：`translate.cjs`

支持三种运行模式：

1. 初始化模式（生成全局规范与每篇上下文）
2. 批量模式（循环处理 `source/` 下全部 `.md`）
3. 单篇模式（处理指定文件）

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

### 2.3 单篇处理

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
- `tmp_proof_input.md`
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

---

## 5. 主要结构（代码层）

`translate.cjs` 主要函数：

- `runInit()`：执行初始化总流程
- `runBatch()`：批量遍历并处理 source 顶层及一层子目录中的全部 Markdown 文件
- `runSingle()`：单篇处理
- `runPipelineForFile()`：单篇三阶段流水线核心
- `generateGlobalStyleGuide()`：全局术语与风格指南生成
- `generatePerFileContexts()`：每篇摘要与 context map 生成
- `runClaude()`：统一执行 Claude CLI（非交互）

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
