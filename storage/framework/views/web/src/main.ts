import { ViteSSG } from 'vite-ssg'
import { setupLayouts } from 'virtual:generated-layouts'
import { routes } from 'vue-router/auto-routes'
import { resourcesPath } from '@stacksjs/path'
import App from './App.stx'
import type { UserModule } from './types'
import '@unocss/reset/tailwind.css'
import '../../../../../resources/assets/styles/main.css'
import 'uno.css'

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
    Object.values(import.meta.glob<{ install: UserModule }>('../../../../../resources/modules/*.ts'))
      .forEach(i => i.install?.(ctx))

    // ctx.app.use(Previewer)
  },
)
