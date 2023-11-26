import { ViteSSG } from 'vite-ssg'
import { setupLayouts } from 'virtual:generated-layouts'
import VueHighlightJS from 'vue3-highlightjs'
import App from './App.vue'
import generatedRoutes from '~pages'
import '@unocss/reset/tailwind.css'
import 'highlight.js/styles/atom-one-light.css'
import '../../../../resources/assets/styles/main.css'
import 'uno.css'
const routes = setupLayouts(generatedRoutes)
ViteSSG(
  App,
  {
    routes,
    base: import.meta.env.BASE_URL,
  },
  (ctx) => {
    ctx.app.use(VueHighlightJS)
  },
)