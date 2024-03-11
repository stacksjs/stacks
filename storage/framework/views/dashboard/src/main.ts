import { ViteSSG } from 'vite-ssg'
import { setupLayouts } from 'virtual:generated-layouts'
import { routes } from 'vue-router/auto-routes'
import '@unocss/reset/tailwind.css'
import '../../../../../resources/assets/styles/main.css'
import { createPinia } from 'pinia'
import App from './App.stx'
import 'uno.css'

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
