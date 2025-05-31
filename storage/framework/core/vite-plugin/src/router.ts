import type { Options } from 'unplugin-vue-router'
import type { Plugin } from 'vite'
import { config } from '@stacksjs/config'
import { path as p } from '@stacksjs/path'
import VueRouter from 'unplugin-vue-router/vite'

interface RouterOptions extends Options {
  type?: 'views'
}

// https://github.com/posva/unplugin-vue-router
export function router(options?: RouterOptions): Plugin {
  const opts = {
    extensions: ['.stx', '.vue', '.md'],
    dts: p.frameworkPath('types/router.d.ts'),
    routesFolder: [
      p.frameworkPath('defaults/views'),
      p.resourcesPath('views'),
    ],
    logs: config.app.debug || false,
    ...options,
  }

  if (options?.type === 'views') {
    // @ts-expect-error - somehow a pwa error happens when we type `name` in antfus plugins, so ignore it for now
    return VueRouter({
      exclude: ['/dashboard/**', '/errors/**', '/system-tray/**', '/docs/**', '/api/**'], // these are provided by the framework, and that's why they cannot be reused
      ...opts,
    })
  }

  // @ts-expect-error - somehow a pwa error happens when we type `name` in antfus plugins, so ignore it for now
  return VueRouter(opts)
}
