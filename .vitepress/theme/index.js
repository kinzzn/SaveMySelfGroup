import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import DynamicSiteTitle from './components/DynamicSiteTitle.vue'
import ProofreadTool from './components/ProofreadTool.vue'
import SidebarResizeHandle from './components/SidebarResizeHandle.vue'

export default {
  extends: DefaultTheme,
  Layout: () => h(DefaultTheme.Layout, null, {
    'nav-bar-title-before': () => h(DynamicSiteTitle),
    'layout-bottom': () => h(SidebarResizeHandle)
  }),
  enhanceApp({ app }) {
    app.component('ProofreadTool', ProofreadTool)
  }
}
