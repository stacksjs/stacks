import { config } from '@stacksjs/config'
import { path as p } from '@stacksjs/path'
import type { Options } from 'unplugin-vue-router'
import VueRouter from 'unplugin-vue-router/vite'

interface RouterOptions extends Options {
  type?: 'views'
}

// https://github.com/posva/unplugin-vue-router
export function router(options?: RouterOptions) {
  const opts = {
    extensions: ['.stx', '.vue', '.md'],
    dts: p.frameworkPath('types/router.d.ts'),
    routesFolder: [p.resourcesPath('views')],
    logs: config.app.debug || false,
    ...options,
  }

  if (options?.type === 'views') {
    return VueRouter({
      exclude: ['/dashboard/**', '/errors/**', '/system-tray/**'],
      ...opts,
    })
  }

  return VueRouter(opts)
}
