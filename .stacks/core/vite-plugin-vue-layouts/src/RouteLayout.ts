import { ResolvedOptions } from './types'

function getClientCode(importCode: string, options: ResolvedOptions) {
  const code = `
${importCode}

export function setupLayouts(routes) {
  return routes.map(route => {
    const isBoolean = typeof route.meta?.layout === 'boolean'
    if(isBoolean && !route.meta?.layout) {
      return route
    } else {
      let componentName = !isBoolean && route.meta?.layout ? route.meta?.layout : '${options.defaultLayout}'
      return {
        path: route.path,
        component: layouts[componentName],
        children: route.path === '/' ? [route] : [{...route, path: ''}]
      }
    }
  })
}
`
  return code
}

export default getClientCode
