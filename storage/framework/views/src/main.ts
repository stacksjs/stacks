// @ts-expect-error - so createApp doesn't complain about missing types
import { ViteSSG, ViteSSGContext } from 'vite-ssg'
import { setupLayouts } from 'virtual:generated-layouts'

// import Previewer from 'virtual:vue-component-preview'
import { routes } from 'vue-router/auto/routes'
import App from './App.vue'
import type { UserModule } from '@stacksjs/types'
import '@unocss/reset/tailwind.css'
import '../../../../resources/styles/main.css'
import 'uno.css'

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
    Object.values(import.meta.glob<{ install: UserModule }>('../../../../resources/modules/*.ts', { eager: true }))
      .forEach(i => i.install?.(ctx))
    // ctx.app.use(Previewer)
  },
)
