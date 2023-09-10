import { posix } from 'node:path'
import { getPackageInfo } from 'local-pkg'

function normalizePath(path: string) {
  path = path.startsWith('/') ? path : `/${path}`
  return posix.normalize(path)
}

export async function isVite2() {
  const info = await getPackageInfo('vite')
  if (info)
    return /.?2/.test(info.version)

  return false
}

interface VirtualModuleCodeOptions {
  layoutDir: string
  defaultLayout: string
  importMode: 'sync' | 'async'
}

async function createVirtualGlob(
  target: string,
  isSync: boolean,
) {
  const g = `"${target}/**/*.vue"`
  if (await isVite2())
    return isSync ? `import.meta.globEager(${g})` : `import.meta.glob(${g})`

  return `import.meta.glob(${g}, { eager: ${isSync} })`
}

export async function createVirtualModuleCode(
  options: VirtualModuleCodeOptions,
) {
  const { layoutDir, defaultLayout, importMode } = options

  const normalizedTarget = normalizePath(layoutDir)

  const isSync = importMode === 'sync'

  return `
  export const createGetRoutes = (router, withLayout = false) => {
      const routes = router.getRoutes()
      if (withLayout) {
          return routes
      }
      return () => routes.filter(route => !route.meta.isLayout)
  }

  export const setupLayouts = routes => {
      const layouts = {}

      const modules = ${await createVirtualGlob(
    normalizedTarget,
    isSync,
  )}

      Object.entries(modules).forEach(([name, module]) => {
          let key = name.replace("${normalizedTarget}/", '').replace('.vue', '')
          layouts[key] = ${isSync ? 'module.default' : 'module'}
      })

    function deepSetupLayout(routes, top = true) {
      return routes.map(route => {
        if (route.children?.length > 0) {
          route.children = deepSetupLayout(route.children, false)
        }

        if (top && route.meta?.layout !== false) {
          return {
            path: route.path,
            component: layouts[route.meta?.layout || '${defaultLayout}'],
            children: [ {...route, path: ''} ],
            meta: {
              isLayout: true
            }
          }
        }

        if (route.meta?.layout) {
          return {
            path: route.path,
            component: layouts[route.meta?.layout],
            children: [ {...route, path: ''} ],
            meta: {
              isLayout: true
            }
          }
        }

        return route
      })
    }

      return deepSetupLayout(routes)
  }`
}
