const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const modeArg = args[0];

const IS_INIT_MODE = modeArg === '--init';
const IS_BATCH_MODE = modeArg === '--batch';

const SOURCE_DIR = 'source';
const OUTPUT_DIR = 'output';
const PROMPTS_DIR = 'prompts';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-6';
const MAX_STYLE_SOURCE_CHARS = 24000;
const MAX_CONTEXT_SOURCE_CHARS = 20000;

const DEFAULT_SOURCE_FILE = 'source/chapter1.md';
const SOURCE_FILE = (!IS_INIT_MODE && !IS_BATCH_MODE) ? (args[0] || DEFAULT_SOURCE_FILE) : '';
const CONTEXT_INFO = (IS_INIT_MODE || IS_BATCH_MODE) ? (args[1] || '本文背景是关于日本乐队访谈。') : (args[1] || '本文背景是关于日本乐队访谈。');

const TRANS_PROMPT_FILE = path.join(PROMPTS_DIR, 'translation_expert.md');
const EDIT_PROMPT_FILE = path.join(PROMPTS_DIR, 'editing_expert.md');
const PROOF_PROMPT_FILE = path.join(PROMPTS_DIR, 'proofreading_expert.md');
const INIT_PROMPT_FILE = path.join(PROMPTS_DIR, 'init_expert.md');
const STYLE_GUIDE_FILE = path.join(PROMPTS_DIR, 'style_guide.md');
const FILE_CONTEXTS_FILE = path.join(OUTPUT_DIR, 'file_contexts.json');

const TRANS_PLACEHOLDER = '[BASE ON CONTENT，每翻译一本的新的书都重写该部分]';
const EDIT_PLACEHOLDER = '[BASE ON CONTENT，每编辑一本书或一个章节时都重写该部分]';
const INIT_CONTEXT_PLACEHOLDER = '[CONTEXT_INFO]';
const INIT_TEXT_PLACEHOLDER = '[MERGED_TEXT]';

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeUtf8(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function toPromptPath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function runClaude(argsList, stepName) {
  const result = spawnSync('claude', ['--model', CLAUDE_MODEL, '--permission-mode', 'bypassPermissions', ...argsList], {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  if (result.error) {
    throw new Error(`[${stepName}] 执行失败: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`[${stepName}] 退出码异常: ${result.status}`);
  }
}

function runClaudeText(prompt, stepName) {
  const result = spawnSync(
    'claude',
    ['--model', CLAUDE_MODEL, '--permission-mode', 'bypassPermissions', '--tools', '', '-p', prompt],
    {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      cwd: process.cwd(),
    }
  );

  if (result.error) {
    throw new Error(`[${stepName}] 执行失败: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`[${stepName}] 退出码异常: ${result.status}\n${result.stderr || ''}`);
  }

  const output = result.stdout.trim();
  if (!output) {
    throw new Error(`[${stepName}] Claude 未返回内容。请确认 Agent Maestro 使用的是明确模型，而不是 Auto。`);
  }

  return output;
}

function listSourceMarkdownFiles() {
  if (!fs.existsSync(SOURCE_DIR)) {
    throw new Error(`找不到源文件目录: ${SOURCE_DIR}`);
  }

  const files = fs.readdirSync(SOURCE_DIR, { withFileTypes: true })
    .flatMap((entry) => {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        return [path.join(SOURCE_DIR, entry.name)];
      }

      if (!entry.isDirectory()) {
        return [];
      }

      const subDir = path.join(SOURCE_DIR, entry.name);
      return fs.readdirSync(subDir, { withFileTypes: true })
        .filter((child) => child.isFile() && child.name.endsWith('.md'))
        .map((child) => path.join(subDir, child.name));
    })
    .sort((a, b) => a.localeCompare(b, 'en'));

  if (files.length === 0) {
    throw new Error(`在 ${SOURCE_DIR} 下未找到 .md 文件。`);
  }

  return files;
}

function getArticleName(sourceFile) {
  return path.basename(sourceFile, '.md');
}

function getSourceKey(sourceFile) {
  return path.relative(SOURCE_DIR, sourceFile).replace(/\\/g, '/');
}

function getArticleOutputDir(sourceFile) {
  const relativePath = path.relative(SOURCE_DIR, sourceFile);
  const parsedPath = path.parse(relativePath);
  return path.join(OUTPUT_DIR, parsedPath.dir, parsedPath.name);
}

function loadStyleGuideText() {
  if (!fs.existsSync(STYLE_GUIDE_FILE)) {
    console.log('⚠️ 未检测到 prompts/style_guide.md，建议先运行 --init。');
    return '';
  }

  return `\n\n⚠️【全书统一术语与风格指南指导 - 必须严格遵守】：\n${readUtf8(STYLE_GUIDE_FILE)}\n`;
}

function loadFileContextsMap() {
  if (!fs.existsSync(FILE_CONTEXTS_FILE)) {
    return {};
  }

  try {
    return JSON.parse(readUtf8(FILE_CONTEXTS_FILE));
  } catch {
    return {};
  }
}

function buildMergedScopeText(sourceFiles) {
  let mergedScopeText = '';
  const charsPerFile = Math.max(300, Math.floor(MAX_STYLE_SOURCE_CHARS / sourceFiles.length));
  sourceFiles.forEach((filePath) => {
    const content = readUtf8(filePath);
    mergedScopeText += `\n\n=== 文件名: ${getSourceKey(filePath)} ===\n${content.slice(0, charsPerFile)}`;
  });
  return mergedScopeText;
}

function generateGlobalStyleGuide(sourceFiles) {
  console.log('🔮 [Init 1/2] 生成全局术语与风格指南...');

  if (!fs.existsSync(INIT_PROMPT_FILE)) {
    throw new Error(`找不到初始化提示词文件: ${INIT_PROMPT_FILE}`);
  }

  const mergedScopeText = buildMergedScopeText(sourceFiles);
  const initInputPath = path.join(OUTPUT_DIR, 'tmp_style_guide_input.md');

  ensureDir(OUTPUT_DIR);

  let initPrompt = readUtf8(INIT_PROMPT_FILE);
  initPrompt = initPrompt
    .replace(INIT_CONTEXT_PLACEHOLDER, CONTEXT_INFO)
    .replace(INIT_TEXT_PLACEHOLDER, mergedScopeText);

  writeUtf8(initInputPath, initPrompt);

  const styleGuide = runClaudeText(
    `${initPrompt}\n\n请直接输出终版【术语与风格指南】的 Markdown 正文，不要寒暄，不要调用工具。`,
    'Style Guide Extraction'
  );
  writeUtf8(STYLE_GUIDE_FILE, `${styleGuide}\n`);
}

function generatePerFileContexts(sourceFiles) {
  console.log('🧭 [Init 2/2] 生成每篇 context...');

  const styleGuideText = fs.existsSync(STYLE_GUIDE_FILE) ? readUtf8(STYLE_GUIDE_FILE) : '';
  const contextMap = {};

  sourceFiles.forEach((sourceFile) => {
    const articleName = getArticleName(sourceFile);
    const articleOutputDir = getArticleOutputDir(sourceFile);
    ensureDir(articleOutputDir);

    const sourceText = readUtf8(sourceFile).slice(0, MAX_CONTEXT_SOURCE_CHARS);
    const summaryInputPath = path.join(articleOutputDir, 'tmp_context_input.md');
    const summaryOutputPath = path.join(articleOutputDir, '0_context_summary.md');

    const summaryInput = `你是出版项目统筹编辑。\n\n全局背景信息：\n${CONTEXT_INFO}\n\n以下是本篇原文：\n---\n${sourceText}\n---\n\n请输出：\n1) 本篇主题与主要内容概述（150~300字）\n2) 人物/术语/语气风险点（要点列出）\n3) 翻译时建议重点\n`;

    writeUtf8(summaryInputPath, summaryInput);

    const summaryText = runClaudeText(
      `${summaryInput}\n\n请直接输出摘要正文，不要寒暄，不要调用工具。`,
      `Context Summary - ${articleName}`
    );
    writeUtf8(summaryOutputPath, `${summaryText}\n`);

    const combinedContext = `${CONTEXT_INFO}\n\n【本篇内容摘要】\n${summaryText}\n${styleGuideText ? `\n【全局术语与风格指南（节选参考）】\n${styleGuideText}` : ''}`;

    contextMap[getSourceKey(sourceFile)] = {
      sourceFile,
      articleName,
      summaryFile: summaryOutputPath,
      combinedContext,
    };
  });

  writeUtf8(FILE_CONTEXTS_FILE, JSON.stringify(contextMap, null, 2));
  console.log(`✅ 每篇 context 已生成：${FILE_CONTEXTS_FILE}`);
}

function getContextForFile(sourceFile, globalContext, contextMap) {
  const contextEntry = contextMap[getSourceKey(sourceFile)] || contextMap[path.basename(sourceFile)];
  if (contextEntry && contextEntry.combinedContext) {
    return contextEntry.combinedContext;
  }
  return globalContext;
}

function runPipelineForFile(sourceFile, contextInfo) {
  const articleName = getArticleName(sourceFile);
  const articleOutputDir = getArticleOutputDir(sourceFile);

  ensureDir(articleOutputDir);

  console.log('---------------------------------------------');
  console.log(`🚀 开始处理：${sourceFile}`);
  console.log(`📁 输出目录：${articleOutputDir}`);

  const sourceText = readUtf8(sourceFile);
  const styleGuideText = loadStyleGuideText();

  // Step 1
  console.log(`📥 [${articleName}] Step 1/3 生成中文初稿...`);
  let transPrompt = readUtf8(TRANS_PROMPT_FILE);
  transPrompt = transPrompt.replace(TRANS_PLACEHOLDER, contextInfo);

  const transInput = `${transPrompt}${styleGuideText}\n\n以下是需要翻译的日文原文：\n---\n${sourceText}\n---\n请直接输出中文译稿，严格遵守格式要求。\n`;
  const transInputPath = path.join(articleOutputDir, 'tmp_trans_input.md');
  const translatedOutputPath = path.join(articleOutputDir, '1_translated.md');
  writeUtf8(transInputPath, transInput);

  runClaude(
    [
      '-p',
      `请仔细阅读并严格执行 ${toPromptPath(transInputPath)} 文件中的翻译专家身份、全局术语规范与输出格式，将翻译出的中文初稿直接写入 ${toPromptPath(translatedOutputPath)}。不要带任何多余解释。`,
    ],
    `Translation - ${articleName}`
  );

  // Step 2
  console.log(`🔍 [${articleName}] Step 2/3 精修译稿并生成编辑报告...`);
  let editPrompt = readUtf8(EDIT_PROMPT_FILE);
  editPrompt = editPrompt.replace(EDIT_PLACEHOLDER, contextInfo);

  const translatedText = readUtf8(translatedOutputPath);
  const editInput = `${editPrompt}${styleGuideText}\n\n以下是日文原文：\n---\n${sourceText}\n---\n\n以下是需要你精修的中文初稿：\n---\n${translatedText}\n---\n请严格按照 Output Format 的4个部分进行深度加工和输出。\n`;

  const editInputPath = path.join(articleOutputDir, 'tmp_edit_input.md');
  const editedOutputPath = path.join(articleOutputDir, '2_edited.md');
  const editingReportPath = path.join(articleOutputDir, '2_editing_report.md');
  writeUtf8(editInputPath, editInput);

  runClaude(
    [
      '-p',
      `请阅读 ${toPromptPath(editInputPath)} 并结合全局术语规范。你现在是日语编辑专家。请将精修后的“中文发排稿”写入 ${toPromptPath(editedOutputPath)}。同时创建 ${toPromptPath(editingReportPath)}，写入“术语表和Q&A疑问记录”。`,
    ],
    `Editing - ${articleName}`
  );

  // Step 3
  console.log(`🛡️ [${articleName}] Step 3/3 最终校对并生成改错报告...`);
  const proofPrompt = readUtf8(PROOF_PROMPT_FILE);
  const editedText = readUtf8(editedOutputPath);

  const proofInput = `${proofPrompt}${styleGuideText}\n\n以下是外语原文：\n---\n${sourceText}\n---\n\n以下是编辑加工后的中文稿：\n---\n${editedText}\n---\n请进行最后的硬伤清查。\n`;

  const proofInputPath = path.join(articleOutputDir, 'tmp_proof_input.md');
  const finalProofedPath = path.join(articleOutputDir, '3_final_proofed.md');
  const proofreadingReportPath = path.join(articleOutputDir, '3_proofreading_report.md');
  writeUtf8(proofInputPath, proofInput);

  runClaude(
    [
      '-p',
      `请阅读 ${toPromptPath(proofInputPath)} 并对照全局风格术语要求。请将修正后的“最终清样文本”写入 ${toPromptPath(finalProofedPath)}。同时创建 ${toPromptPath(proofreadingReportPath)}，写入“校对改错报告表”。`,
    ],
    `Proofreading - ${articleName}`
  );

  console.log(`✅ 完成：${sourceFile}`);
}

function runInit() {
  console.log('=============================================');
  console.log('🚀 启动全局初始化模式');
  console.log('=============================================');

  ensureDir(OUTPUT_DIR);
  const sourceFiles = listSourceMarkdownFiles();
  generateGlobalStyleGuide(sourceFiles);
  generatePerFileContexts(sourceFiles);

  console.log('=============================================');
  console.log('🎉 初始化完成：style_guide + 每篇 context 已就绪');
  console.log('=============================================');
}

function runBatch() {
  console.log('=============================================');
  console.log('🚀 启动批量翻译流水线模式');
  console.log('=============================================');

  ensureDir(OUTPUT_DIR);
  const sourceFiles = listSourceMarkdownFiles();
  const contextMap = loadFileContextsMap();

  sourceFiles.forEach((sourceFile) => {
    const fileContext = getContextForFile(sourceFile, CONTEXT_INFO, contextMap);
    runPipelineForFile(sourceFile, fileContext);
  });

  console.log('=============================================');
  console.log('🎉 批量处理完成！');
  console.log('=============================================');
}

function runSingle() {
  console.log('=============================================');
  console.log('🚀 启动单篇翻译流水线模式');
  console.log('=============================================');

  ensureDir(OUTPUT_DIR);

  const contextMap = loadFileContextsMap();
  const mergedContext = getContextForFile(SOURCE_FILE, CONTEXT_INFO, contextMap);
  runPipelineForFile(SOURCE_FILE, mergedContext);

  console.log('=============================================');
  console.log('🎉 单篇处理完成！');
  console.log('=============================================');
}

function main() {
  if (IS_INIT_MODE) {
    runInit();
    return;
  }

  if (IS_BATCH_MODE) {
    runBatch();
    return;
  }

  runSingle();
}

try {
  main();
} catch (error) {
  console.error(`❌ 流水线执行失败: ${error.message}`);
  process.exit(1);
}
