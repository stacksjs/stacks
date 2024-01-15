import { config } from '@stacksjs/config'
import VueRouter from 'unplugin-vue-router/vite'
import { path as p } from '@stacksjs/path'

type RouterType = 'web' | 'dashboard'

// https://github.com/posva/unplugin-vue-router
export function router(type: RouterType = 'web') {
  if (type === 'dashboard') {
    return VueRouter({
      extensions: ['.stx', '.md'],
      dts: p.frameworkPath('types/dashboard-router.d.ts'),
      routesFolder: [
        p.frameworkPath('views/dashboard/src/pages'),
      ],
      logs: config.app.debug || false,
    })
  }

  return VueRouter({
    extensions: ['.stx', '.md'],
    dts: p.frameworkPath('types/router.d.ts'),
    routesFolder: [
      p.resourcesPath('views'),
    ],
    logs: config.app.debug || false,
  })
}
