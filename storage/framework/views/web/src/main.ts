import { setupLayouts } from 'virtual:generated-layouts'
import '@unocss/reset/tailwind.css'
import 'unocss'
import path from 'node:path'
import { ViteSSG } from 'vite-ssg'
import { routes } from 'vue-router/auto-routes'
import '../../../../../resources/assets/styles/main.css'
import App from './App.vue'
// import type { UserModule } from './types'

export const createApp = ViteSSG(
  App,
  {
    routes: setupLayouts(routes),
    base: import.meta.env.BASE_URL,
  },
  (ctx) => {
    if (!ctx.isClient) {
      // install all modules under `modules/`
      ;(async () => {
        const glob = new Bun.Glob('**/*.ts')
        const moduleFiles = []
        const modulesPath = path.resolve(__dirname, '../../../../../../resources/modules')
        for await (const file of glob.scan(modulesPath)) {
          log.debug('pushing module', `${modulesPath}/${file}`)
          moduleFiles.push(`${modulesPath}/${file}`)
        }

        // const modules = import.meta.glob<{ install: UserModule }>('../../../../../resources/modules/*.ts')
        // const promises = Object.values(modules).map((func) => func())
        // const modulesArray = await Promise.all(promises)

        const modulesArray = await Promise.all(
          moduleFiles.map(async (file) => {
            const module = await import(/* @vite-ignore */ file)
            return module
          }),
        )

        for (const module of modulesArray) module.install?.(ctx)
      })()
    }
  },
)
