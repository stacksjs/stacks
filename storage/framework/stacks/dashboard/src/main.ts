import { ViteSSG } from 'vite-ssg'
import { setupLayouts } from 'virtual:generated-layouts'
import VueHighlightJS from 'vue3-highlightjs'
import App from './App.vue'
import { routes } from 'vue-router/auto/routes'
import '@unocss/reset/tailwind.css'
import 'highlight.js/styles/atom-one-light.css'
import './styles/main.css'
import { createPinia } from 'pinia'

const pinia = createPinia()


import 'uno.css'
ViteSSG(
  App,
  {
    routes: setupLayouts(routes),
    base: import.meta.env.BASE_URL,
  },
  (ctx) => {
    ctx.app.use(VueHighlightJS)
    ctx.app.use(pinia)
  },
)