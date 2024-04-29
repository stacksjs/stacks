import { setupLayouts } from 'virtual:generated-layouts'
import '@unocss/reset/tailwind.css'
import 'uno.css'
import { ViteSSG } from 'vite-ssg'
import { routes } from 'vue-router/auto-routes'
import '../../../../../resources/assets/styles/main.css'
import App from './App.stx'
import type { UserModule } from './types'

// import Previewer from 'virtual:vue-component-preview'
// const routes = setupLayouts(generatedRoutes)

// https://github.com/antfu/vite-ssg
export const createApp = ViteSSG(
  App,
  {
    routes: setupLayouts(routes),
    base: import.meta.env.BASE_URL,
  },
  (ctx) => {
    // install all modules under `modules/`
    // Object.values(import.meta.glob<{ install: UserModule }>('../../../../../resources/modules/*.ts'))
    //   .forEach(i => i.install?.(ctx))
    ;(async () => {
      const modules = import.meta.glob<{ install: UserModule }>(
        '../../../../../resources/modules/*.ts',
      )
      const promises = Object.values(modules).map((func) => func())
      const modulesArray = await Promise.all(promises)
      for (const module of modulesArray) module.install?.(ctx)
    })()

    // ctx.app.use(Previewer)
  },
)
