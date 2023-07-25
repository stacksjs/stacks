import { ViteSSG } from 'vite-ssg'
import { routes } from 'vue-router/auto/routes'
import { setupLayouts } from 'virtual:generated-layouts'
import App from './App.vue'
import '@unocss/reset/tailwind.css'

export const createApp = ViteSSG(
  App,
  {
    routes: setupLayouts(routes),
    base: import.meta.env.BASE_URL,
  },
)
