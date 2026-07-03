<template>
  <div class="proofread-container">
    <!-- Toolbar -->
    <div class="proofread-toolbar">
      <select v-model="selectedFile" @change="loadFile" :disabled="loading">
        <option value="">-- 选择文件 --</option>
        <option v-for="file in fileList" :key="file" :value="file">{{ file }}</option>
      </select>
      <button class="layout-btn" @click="toggleLayout">
        {{ layout === 'horizontal' ? '竖排' : '横排' }}
      </button>
      <TokenInput @token-change="onTokenChange" />
      <button
        class="save-btn"
        @click="saveFile"
        :disabled="!canSave || saving"
      >
        {{ saving ? '保存中...' : '保存' }}
      </button>
      <span v-if="statusMsg" :class="['status-msg', statusType]">{{ statusMsg }}</span>
    </div>

    <!-- Panels -->
    <div :class="['proofread-panels', `layout-${layout}`]">
      <!-- Source (read-only, plain text) -->
      <div class="panel panel-source">
        <div class="panel-header">原文 (Source)</div>
        <pre class="panel-plain" v-if="sourceContent">{{ sourceContent }}</pre>
        <div class="panel-placeholder" v-else>选择文件后显示原文</div>
      </div>

      <!-- Divider -->
      <div :class="['panel-divider', `divider-${layout}`]"></div>

      <!-- Translation (editable, plain textarea) -->
      <div class="panel panel-translation">
        <div class="panel-header">译文 (Translation) — 可编辑</div>
        <textarea
          v-model="translatedContent"
          class="panel-editor"
          placeholder="选择文件后显示译文，可直接编辑"
          :disabled="!selectedFile"
        ></textarea>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import TokenInput from './TokenInput.vue'

const REPO = 'kinzzn/SaveMySelfGroup'
const API_BASE = 'https://api.github.com'

const token = ref(null)
const fileList = ref([])
const selectedFile = ref('')
const sourceContent = ref('')
const translatedContent = ref('')
const loading = ref(false)
const saving = ref(false)
const statusMsg = ref('')
const statusType = ref('')
const layout = ref('horizontal')

const canSave = computed(() => {
  return token.value && selectedFile.value && translatedContent.value.trim()
})

onMounted(() => {
  const isMobile = window.matchMedia('(max-width: 768px)').matches
  layout.value = isMobile ? 'vertical' : 'horizontal'
})

function toggleLayout() {
  layout.value = layout.value === 'horizontal' ? 'vertical' : 'horizontal'
}

function onTokenChange(newToken) {
  token.value = newToken
  if (newToken) {
    loadFileList()
  }
}

function showStatus(msg, type = 'info') {
  statusMsg.value = msg
  statusType.value = type
  if (type !== 'error') {
    setTimeout(() => { statusMsg.value = '' }, 3000)
  }
}

async function ghFetch(path, options = {}) {
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    ...options.headers
  }
  if (token.value) {
    headers['Authorization'] = `Bearer ${token.value}`
  }
  const resp = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (resp.status === 401) {
    showStatus('Token 无效或已过期，请重新配置', 'error')
    throw new Error('Unauthorized')
  }
  return resp
}

async function loadFileList() {
  try {
    const resp = await ghFetch(`/repos/${REPO}/contents/scripts/source`)
    if (!resp.ok) throw new Error('Failed to list files')
    const files = await resp.json()
    fileList.value = files
      .filter(f => f.name.endsWith('.md'))
      .map(f => f.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  } catch (e) {
    if (e.message !== 'Unauthorized') {
      showStatus('加载文件列表失败', 'error')
    }
  }
}

async function loadFile() {
  if (!selectedFile.value) return
  loading.value = true
  statusMsg.value = ''

  const fileName = selectedFile.value
  const baseName = fileName.replace('.md', '')

  try {
    const [sourceResp, transResp] = await Promise.all([
      ghFetch(`/repos/${REPO}/contents/scripts/source/${fileName}`),
      ghFetch(`/repos/${REPO}/contents/scripts/output/${baseName}/3_final_proofed.md`)
    ])

    if (!sourceResp.ok) throw new Error('Failed to load source')

    const sourceData = await sourceResp.json()
    sourceContent.value = decodeBase64(sourceData.content)

    if (transResp.ok) {
      const transData = await transResp.json()
      translatedContent.value = decodeBase64(transData.content)
    } else {
      translatedContent.value = ''
      showStatus('未找到译文文件', 'warn')
    }
  } catch (e) {
    if (e.message !== 'Unauthorized') {
      showStatus('加载文件失败: ' + e.message, 'error')
    }
  } finally {
    loading.value = false
  }
}

async function saveFile() {
  if (!canSave.value) return
  saving.value = true
  statusMsg.value = ''

  const baseName = selectedFile.value.replace('.md', '')
  const savePath = `scripts/output/${baseName}/4_human_proofed.md`

  try {
    let sha = undefined
    const existResp = await ghFetch(`/repos/${REPO}/contents/${savePath}`)
    if (existResp.ok) {
      const existData = await existResp.json()
      sha = existData.sha
    }

    const body = {
      message: `proofread: ${baseName} human proofed`,
      content: encodeBase64(translatedContent.value),
    }
    if (sha) body.sha = sha

    const saveResp = await ghFetch(`/repos/${REPO}/contents/${savePath}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!saveResp.ok) {
      const err = await saveResp.json()
      throw new Error(err.message || 'Save failed')
    }

    showStatus('保存成功', 'success')
  } catch (e) {
    if (e.message !== 'Unauthorized') {
      showStatus('保存失败: ' + e.message, 'error')
    }
  } finally {
    saving.value = false
  }
}

function decodeBase64(encoded) {
  const cleaned = encoded.replace(/\n/g, '')
  return decodeURIComponent(
    atob(cleaned).split('').map(c =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join('')
  )
}

function encodeBase64(str) {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  )
}
</script>

<style scoped>
.proofread-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 64px);
  padding: 0;
}

.proofread-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg-soft);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.proofread-toolbar select {
  padding: 5px 10px;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  font-size: 14px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  min-width: 180px;
}

.layout-btn {
  padding: 5px 12px;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 13px;
  cursor: pointer;
}
.layout-btn:hover {
  background: var(--vp-c-bg-mute);
}

.save-btn {
  padding: 5px 16px;
  border: none;
  border-radius: 4px;
  background: var(--vp-c-brand-1);
  color: white;
  font-size: 14px;
  cursor: pointer;
}
.save-btn:hover:not(:disabled) {
  background: var(--vp-c-brand-2);
}
.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.status-msg {
  font-size: 13px;
}
.status-msg.success { color: var(--vp-c-green-1); }
.status-msg.error { color: var(--vp-c-red-1); }
.status-msg.warn { color: var(--vp-c-yellow-1); }
.status-msg.info { color: var(--vp-c-text-2); }

/* Panels layout */
.proofread-panels {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.proofread-panels.layout-vertical {
  flex-direction: column;
}
.proofread-panels.layout-horizontal {
  flex-direction: row;
}

.panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
}

.panel-header {
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-alt);
  border-bottom: 1px solid var(--vp-c-border);
  flex-shrink: 0;
}

.panel-plain {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  color: var(--vp-c-text-1);
}

.panel-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--vp-c-text-3);
  font-size: 14px;
}

.panel-editor {
  flex: 1;
  width: 100%;
  padding: 16px;
  border: none;
  resize: none;
  font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  outline: none;
}
.panel-editor:disabled {
  opacity: 0.6;
}

/* Divider */
.panel-divider.divider-vertical {
  height: 3px;
  width: 100%;
  background: var(--vp-c-border);
  flex-shrink: 0;
  cursor: row-resize;
}
.panel-divider.divider-horizontal {
  width: 3px;
  height: 100%;
  background: var(--vp-c-border);
  flex-shrink: 0;
  cursor: col-resize;
}
</style>
