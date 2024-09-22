import { setupLayouts } from 'virtual:generated-layouts'
import '@unocss/reset/tailwind.css'
import 'unocss'
import { ViteSSG } from 'vite-ssg'
import { routes } from 'vue-router/auto-routes'
import '../../../../../resources/assets/styles/main.css'
import App from './App.vue'
import type { UserModule } from './types'

export const createApp = ViteSSG(
  App,
  {
    routes: setupLayouts(routes),
    base: import.meta.env.BASE_URL,
  },
  (ctx) => {
    // install all modules under `modules/`
    ;(async () => {
      const modules = import.meta.glob<{ install: UserModule }>('../../../../../resources/modules/*.ts')
      const promises = Object.values(modules).map((func) => func())
      const modulesArray = await Promise.all(promises)
      for (const module of modulesArray) module.install?.(ctx)
    })()
  },
)
