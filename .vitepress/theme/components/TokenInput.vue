<template>
  <div class="token-input">
    <div v-if="!isTokenSet" class="token-form">
      <input
        v-model="tokenValue"
        type="password"
        placeholder="输入 GitHub Personal Access Token"
        @keyup.enter="saveToken"
      />
      <button @click="saveToken" :disabled="!tokenValue.trim()">保存</button>
    </div>
    <div v-else class="token-status">
      <span class="token-badge">Token 已配置</span>
      <button class="token-clear" @click="clearToken">清除</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const STORAGE_KEY = 'github_pat_proofread'

const tokenValue = ref('')
const isTokenSet = ref(false)

const emit = defineEmits(['token-change'])

onMounted(() => {
  isTokenSet.value = !!localStorage.getItem(STORAGE_KEY)
  if (isTokenSet.value) {
    emit('token-change', localStorage.getItem(STORAGE_KEY))
  }
})

function saveToken() {
  const token = tokenValue.value.trim()
  if (!token) return
  localStorage.setItem(STORAGE_KEY, token)
  isTokenSet.value = true
  tokenValue.value = ''
  emit('token-change', token)
}

function clearToken() {
  localStorage.removeItem(STORAGE_KEY)
  isTokenSet.value = false
  emit('token-change', null)
}
</script>

<style scoped>
.token-input {
  display: flex;
  align-items: center;
}
.token-form {
  display: flex;
  gap: 8px;
  align-items: center;
}
.token-form input {
  padding: 4px 10px;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  font-size: 13px;
  width: 260px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}
.token-form button,
.token-clear {
  padding: 4px 12px;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  cursor: pointer;
  font-size: 13px;
}
.token-form button:hover,
.token-clear:hover {
  background: var(--vp-c-bg-mute);
}
.token-form button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.token-status {
  display: flex;
  gap: 8px;
  align-items: center;
}
.token-badge {
  font-size: 13px;
  color: var(--vp-c-green-1);
}
</style>
