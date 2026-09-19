<script setup>
import { computed, ref, watchEffect } from 'vue'
import { useRoute, withBase } from 'vitepress'

const route = useRoute()
const titleElement = ref(null)

const books = [
  { segment: '/Management2/', title: 'Management 2 本篇', home: '/zh-cn/Management2/README' },
  { segment: '/Management2Extra/', title: 'Management 2 增刊', home: '/zh-cn/Management2Extra/README' },
  { segment: '/RockInOnJapan_BF/', title: 'RockInOnJapan BE:FIRST', home: '/zh-cn/RockInOnJapan_BF/README' },
  { segment: '/Others/', title: '其他采访', home: '/zh-cn/Others/README' }
]

const currentSection = computed(() => {
  const path = route.path
    .replace(/^\/SaveMySelfGroup/, '')
    .replace(/\.html$/, '')
    .replace(/\/$/, '')

  if (path === '/zh-cn/README') {
    return { title: 'Save My Self Project', home: '/zh-cn/README' }
  }

  if (path === '/proofread') {
    return { title: '校对', home: '/proofread' }
  }

  const book = books.find(({ segment }) => `${path}/`.includes(segment))
  return book ?? { title: '文档', home: '/zh-cn/README' }
})

watchEffect(() => {
  const titleLink = titleElement.value?.closest('a')
  if (!titleLink) return

  titleLink.setAttribute('href', withBase(currentSection.value.home))
  titleLink.removeAttribute('aria-disabled')
  titleLink.removeAttribute('tabindex')
  titleLink.classList.remove('is-static-title')
})
</script>

<template>
  <span ref="titleElement" class="dynamic-site-title">{{ currentSection.title }}</span>
</template>

<style scoped>
.dynamic-site-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>