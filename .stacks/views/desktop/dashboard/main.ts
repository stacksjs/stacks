import { ViteSSG } from 'vite-ssg'
import { routes } from 'vue-router/auto/routes'
import { setupLayouts } from 'virtual:generated-layouts'
import VueHighlightJS from 'vue3-highlightjs'
import App from './App.vue'
import '@unocss/reset/tailwind.css'
import 'highlight.js/styles/atom-one-light.css'

import '../../../stacks/dashboard/src/styles/main.css'

export const createApp = ViteSSG(
  App,
  {
    routes: setupLayouts(routes),
    base: import.meta.env.BASE_URL,
  },
  (ctx) => {
    ctx.app.use(VueHighlightJS)
  },
)
