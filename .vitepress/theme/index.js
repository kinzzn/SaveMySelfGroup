import DefaultTheme from 'vitepress/theme'
import ProofreadTool from './components/ProofreadTool.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('ProofreadTool', ProofreadTool)
  }
}
