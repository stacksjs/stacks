import { setupLayouts } from 'virtual:generated-layouts'
import '@unocss/reset/tailwind.css'
import { createPinia } from 'pinia'
import 'unocss'
import { ViteSSG } from 'vite-ssg'
import { routes } from 'vue-router/auto-routes'
import '../../../../../resources/assets/styles/main.css'
import App from './App.vue'

const pinia = createPinia()
ViteSSG(
  App,
  {
    routes: setupLayouts(routes),
    base: import.meta.env.BASE_URL,
  },
  (ctx) => {
    ctx.app.use(pinia)
  },
)
