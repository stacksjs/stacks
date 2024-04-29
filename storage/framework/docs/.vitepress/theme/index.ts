import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
// https://vitepress.dev/guide/custom-theme
import { h } from 'vue'
import '../../../../../resources/assets/styles/docs.css'

// import TwoSlashFloatingVue from 'vitepress-plugin-twoslash/client'

export default {
  extends: DefaultTheme,

  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      // https://vitepress.dev/guide/extending-default-theme#layout-slots
    })
  },

  // enhanceApp({ app }: EnhanceAppContext) {
  //   app.use(TwoSlashFloatingVue)
  // },
} satisfies Theme
