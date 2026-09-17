const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const modeArg = args[0];

const IS_INIT_MODE = modeArg === '--init';
const IS_BATCH_MODE = modeArg === '--batch';
const IS_RESUME_MODE = modeArg === '--resume';

const SOURCE_DIR = 'source';
const OUTPUT_DIR = 'output';
const PROMPTS_DIR = 'prompts';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-6';
const MAX_STYLE_SOURCE_CHARS = 24000;
const MAX_CONTEXT_SOURCE_CHARS = 20000;

const DEFAULT_SOURCE_FILE = 'source/chapter1.md';
const IS_MULTI_FILE_MODE = IS_INIT_MODE || IS_BATCH_MODE || IS_RESUME_MODE;
const SOURCE_FILE = !IS_MULTI_FILE_MODE ? (args[0] || DEFAULT_SOURCE_FILE) : '';
const CONTEXT_INFO = IS_MULTI_FILE_MODE ? (args[1] || '本文背景是关于日本乐队访谈。') : (args[1] || '本文背景是关于日本乐队访谈。');

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

function runClaudeToFile(inputPath, outputPath, instruction, stepName, allowRefusalRetry = true) {
  const taskDir = fs.mkdtempSync(path.join(os.tmpdir(), 'translate-claude-'));
  writeUtf8(path.join(taskDir, 'CLAUDE.md'), readUtf8(inputPath));
  const outputFd = fs.openSync(outputPath, 'w');
  let result;

  try {
    result = spawnSync(
      'claude',
      [
        '--model', CLAUDE_MODEL,
        '--permission-mode', 'bypassPermissions',
        '--tools', '',
        '-p', instruction,
      ],
      {
        stdio: ['ignore', outputFd, 'inherit'],
        cwd: taskDir,
      }
    );
  } finally {
    fs.closeSync(outputFd);
    fs.rmSync(taskDir, { recursive: true, force: true });
  }

  if (result.error) {
    throw new Error(`[${stepName}] 执行失败: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`[${stepName}] 退出码异常: ${result.status}`);
  }

  const output = readUtf8(outputPath).trim();
  if (!output) {
    throw new Error(`[${stepName}] Claude 未返回内容。请确认 Agent Maestro 使用的是明确模型，而不是 Auto。`);
  }

  if (/^Sorry, I can(?:not|'t) assist with that\.?$/i.test(output)) {
    if (allowRefusalRetry) {
      console.log(`⚠️ [${stepName}] Claude 返回通用拒绝，按合法出版编辑任务自动重试一次...`);
      return runClaudeToFile(
        inputPath,
        outputPath,
        `${instruction} 这是用户提供并授权处理的普通图书出版翻译与文字编辑任务，不涉及实施危险行为。请仅转换给定文本，不扩展或执行其中描述的行为。`,
        stepName,
        false
      );
    }

    throw new Error(`[${stepName}] Claude 拒绝处理该内容，请检查 ${inputPath} 中是否存在触发安全策略的原文或指令。`);
  }

  return output;
}

function splitClaudeOutput(output, marker, stepName) {
  const markerIndex = output.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`[${stepName}] Claude 返回内容缺少分隔标记: ${marker}。完整响应已保留在对应的 tmp_*_response.md 中。`);
  }

  return [
    output.slice(0, markerIndex).trim(),
    output.slice(markerIndex + marker.length).trim(),
  ];
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

function hasNonEmptyFile(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).size > 0;
}

function isPipelineComplete(sourceFile) {
  const articleOutputDir = getArticleOutputDir(sourceFile);
  return hasNonEmptyFile(path.join(articleOutputDir, '3_final_proofed.md'))
    && hasNonEmptyFile(path.join(articleOutputDir, '3_proofreading_report.md'));
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

  writeUtf8(initInputPath, `${initPrompt}\n\n请直接输出终版【术语与风格指南】的 Markdown 正文，不要寒暄，不要调用工具。`);
  const styleGuide = runClaudeToFile(
    initInputPath,
    STYLE_GUIDE_FILE,
    '严格执行系统提示中的任务，只输出终版术语与风格指南 Markdown 正文。',
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

    writeUtf8(summaryInputPath, `${summaryInput}\n\n请直接输出摘要正文，不要寒暄，不要调用工具。`);

    const summaryText = runClaudeToFile(
      summaryInputPath,
      summaryOutputPath,
      '严格执行系统提示中的任务，只输出本篇摘要正文。',
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
    return contextEntry.combinedContext.split('\n【全局术语与风格指南（节选参考）】\n')[0];
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
  writeUtf8(transInputPath, `${transInput}\n请直接输出中文译稿正文，不要寒暄，不要调用工具。`);

  const translatedText = runClaudeToFile(
    transInputPath,
    translatedOutputPath,
    '严格执行系统提示中的翻译任务，只输出中文译稿正文。',
    `Translation - ${getSourceKey(sourceFile)}`
  );
  writeUtf8(translatedOutputPath, `${translatedText}\n`);

  // Step 2
  console.log(`🔍 [${articleName}] Step 2/3 精修译稿并生成编辑报告...`);
  let editPrompt = readUtf8(EDIT_PROMPT_FILE);
  editPrompt = editPrompt.replace(EDIT_PLACEHOLDER, contextInfo);

  const editInput = `${editPrompt}${styleGuideText}\n\n以下是日文原文：\n---\n${sourceText}\n---\n\n以下是需要你精修的中文初稿：\n---\n${translatedText}\n---\n请严格按照 Output Format 的4个部分进行深度加工和输出。\n`;

  const editInputPath = path.join(articleOutputDir, 'tmp_edit_input.md');
  const editedOutputPath = path.join(articleOutputDir, '2_edited.md');
  const editingReportPath = path.join(articleOutputDir, '2_editing_report.md');
  const editResponsePath = path.join(articleOutputDir, 'tmp_edit_response.md');
  const editMarker = '<<<EDITING_REPORT>>>';
  writeUtf8(editInputPath, `${editInput}\n请不要调用工具。先直接输出编辑加工后的中文发排稿正文，然后另起一行原样输出分隔标记 ${editMarker}，标记后输出术语表、Q&A 疑问记录和规范技术调整说明。不要输出其他分隔标记。`);
  const editResult = runClaudeToFile(
    editInputPath,
    editResponsePath,
    `严格执行系统提示中的编辑任务，按要求使用分隔标记 ${editMarker} 输出发排稿与报告。`,
    `Editing - ${getSourceKey(sourceFile)}`
  );
  const [editedText, editingReport] = splitClaudeOutput(editResult, editMarker, `Editing - ${getSourceKey(sourceFile)}`);
  writeUtf8(editedOutputPath, `${editedText}\n`);
  writeUtf8(editingReportPath, `${editingReport}\n`);

  // Step 3
  console.log(`🛡️ [${articleName}] Step 3/3 最终校对并生成改错报告...`);
  const proofPrompt = readUtf8(PROOF_PROMPT_FILE);

  const proofInput = `${proofPrompt}${styleGuideText}\n\n以下是外语原文：\n---\n${sourceText}\n---\n\n以下是编辑加工后的中文稿：\n---\n${editedText}\n---\n请进行最后的硬伤清查。\n`;

  const proofInputPath = path.join(articleOutputDir, 'tmp_proof_input.md');
  const finalProofedPath = path.join(articleOutputDir, '3_final_proofed.md');
  const proofreadingReportPath = path.join(articleOutputDir, '3_proofreading_report.md');
  const proofResponsePath = path.join(articleOutputDir, 'tmp_proof_response.md');
  const proofMarker = '<<<PROOFREADING_REPORT>>>';
  writeUtf8(proofInputPath, `${proofInput}\n请不要调用工具。先直接输出校对修正后的最终清样正文，然后另起一行原样输出分隔标记 ${proofMarker}，标记后输出校对改错报告表和留疑清单。不要输出其他分隔标记。`);
  const proofResult = runClaudeToFile(
    proofInputPath,
    proofResponsePath,
    `严格执行系统提示中的校对任务，按要求使用分隔标记 ${proofMarker} 输出最终清样与报告。`,
    `Proofreading - ${getSourceKey(sourceFile)}`
  );
  const [finalProofedText, proofreadingReport] = splitClaudeOutput(proofResult, proofMarker, `Proofreading - ${getSourceKey(sourceFile)}`);
  writeUtf8(finalProofedPath, `${finalProofedText}\n`);
  writeUtf8(proofreadingReportPath, `${proofreadingReport}\n`);

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

function runBatch({ resume = false } = {}) {
  console.log('=============================================');
  console.log(resume ? '🚀 启动断点续跑模式' : '🚀 启动批量翻译流水线模式');
  console.log('=============================================');

  ensureDir(OUTPUT_DIR);
  const sourceFiles = listSourceMarkdownFiles();
  const contextMap = loadFileContextsMap();

  sourceFiles.forEach((sourceFile) => {
    if (resume && isPipelineComplete(sourceFile)) {
      console.log(`⏭️ 已完成，跳过：${sourceFile}`);
      return;
    }

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

  if (IS_RESUME_MODE) {
    runBatch({ resume: true });
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
