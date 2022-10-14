import { ViteSSG } from 'vite-ssg'
import { setupLayouts } from 'virtual:generated-layouts'
import Previewer from 'virtual:vue-component-preview'
import type { UserModule } from '../../types'
import App from './App.vue'
import generatedRoutes from '~pages'

import './styles/main.css'
import 'uno.css'

// import '@unocss/reset/tailwind.css'
await import(`@unocss/reset/${reset}.js`)

const routes = setupLayouts(generatedRoutes)

// https://github.com/antfu/vite-ssg
export const createApp = ViteSSG(
  App,
  { routes, base: import.meta.env.APP_URL },
  (ctx) => {
    // install all modules under `modules/`
    Object.values(import.meta.glob<{ install: UserModule }>(frameworkPath('src/modules/*.ts'), { eager: true }))
      .forEach(i => i.install?.(ctx))
    ctx.app.use(Previewer)
  },
)
