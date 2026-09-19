<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const DEFAULT_WIDTH = 272
const MIN_WIDTH = 220
const MAX_WIDTH = 480
const STORAGE_KEY = 'vitepress-sidebar-width'

const isDragging = ref(false)

function setSidebarWidth(width) {
  const clampedWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width))
  document.documentElement.style.setProperty('--vp-sidebar-width', `${clampedWidth}px`)
  return clampedWidth
}

function stopDragging() {
  if (!isDragging.value) return

  isDragging.value = false
  document.body.classList.remove('is-resizing-sidebar')
  window.removeEventListener('pointermove', resizeSidebar)
  window.removeEventListener('pointerup', stopDragging)
}

function resizeSidebar(event) {
  const layoutOffset = Math.max(0, (window.innerWidth - 1440) / 2)
  const width = setSidebarWidth(event.clientX - layoutOffset)
  localStorage.setItem(STORAGE_KEY, String(width))
}

function startDragging(event) {
  if (event.button !== 0) return

  event.preventDefault()
  isDragging.value = true
  document.body.classList.add('is-resizing-sidebar')
  window.addEventListener('pointermove', resizeSidebar)
  window.addEventListener('pointerup', stopDragging)
}

function resetSidebarWidth() {
  setSidebarWidth(DEFAULT_WIDTH)
  localStorage.removeItem(STORAGE_KEY)
}

onMounted(() => {
  const savedWidth = Number(localStorage.getItem(STORAGE_KEY))
  if (Number.isFinite(savedWidth) && savedWidth > 0) {
    setSidebarWidth(savedWidth)
  }
})

onBeforeUnmount(stopDragging)
</script>

<template>
  <button
    class="sidebar-resize-handle"
    type="button"
    aria-label="调整侧栏宽度"
    title="拖动调整侧栏宽度，双击恢复默认宽度"
    @pointerdown="startDragging"
    @dblclick="resetSidebarWidth"
  />
</template>

<style>
@media (min-width: 960px) {
  .sidebar-resize-handle {
    position: fixed;
    z-index: 35;
    top: var(--vp-nav-height);
    bottom: 0;
    left: var(--vp-sidebar-width);
    width: 7px;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: col-resize;
    transform: translateX(-3px);
  }

  .sidebar-resize-handle::after {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 3px;
    width: 1px;
    background: var(--vp-c-divider);
    content: '';
    opacity: 0;
    transition: opacity 0.2s, background-color 0.2s;
  }

  .sidebar-resize-handle:hover::after,
  .is-resizing-sidebar .sidebar-resize-handle::after {
    background: var(--vp-c-brand-1);
    opacity: 1;
  }

  .is-resizing-sidebar {
    cursor: col-resize;
    user-select: none;
  }
}

@media (min-width: 1440px) {
  .sidebar-resize-handle {
    left: calc((100vw - var(--vp-layout-max-width)) / 2 + var(--vp-sidebar-width));
  }
}

@media (max-width: 959px) {
  .sidebar-resize-handle {
    display: none;
  }
}
</style>