import { setupLayouts } from 'virtual:generated-layouts'
import '@unocss/reset/tailwind.css'
import { createPinia } from 'pinia'
import 'uno.css'
import { ViteSSG } from 'vite-ssg'
import { routes } from 'vue-router/auto-routes'
import App from './App.stx'
import './styles/main.css'

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
