import { config } from '@stacksjs/config'
import { path as p } from '@stacksjs/path'
import type { Options as RouterOptions } from 'unplugin-vue-router'
import VueRouter from 'unplugin-vue-router/vite'

// https://github.com/posva/unplugin-vue-router
export function router(options?: RouterOptions) {
  return VueRouter({
    extensions: ['.stx', '.md'],
    dts: p.frameworkPath('types/router.d.ts'),
    routesFolder: [p.resourcesPath('views')],
    logs: config.app.debug || false,
    ...options,
  })
}
