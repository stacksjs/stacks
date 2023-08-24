import { URL } from 'node:url'
import { type Route } from '@stacksjs/types'
import { request } from './request'

export function handleRequest(routes: Route[]) {
  Bun.serve({
    fetch(req) {
      const url = new URL(req.url)

      const foundRoute: Route = routes.find((route: Route) => {
        const pattern = new RegExp(`^${route.uri.replace(/:\w+/g, '\\w+')}$`)

        return pattern.test(url.pathname)
      }) as Route

      if (url.pathname === '/favicon.ico')
        return new Response('')

      if (!foundRoute)
        return new Response('Not found', { status: 404 })

      const route = foundRoute

      if (!isObjectNotEmpty(url.searchParams))
        request.addQuery(url)

      request.extractParamsFromRoute(route.uri, url.pathname)

      if (route?.method !== req.method)
        return new Response('Method not allowed', { status: 405 })

      if (isString(route.callback))
        return new Response(route.callback)

      if (isFunction(route.callback)) {
        const result = (route.callback)()

        return new Response(JSON.stringify(result))
      }

      if (isObject(route.callback))
        return new Response(JSON.stringify(route.callback))

      // If no known type matched, return a generic error.
      return new Response('Unknown callback type.', { status: 500 })
    },
  })
}

function isString(val: unknown): val is string {
  return typeof val === 'string'
}

function isObjectNotEmpty(obj: object): boolean {
  return Object.keys(obj).length > 0
}

// eslint-disable-next-line @typescript-eslint/ban-types
function isFunction(val: unknown): val is Function {
  return typeof val === 'function'
}

function isObject(val: unknown): val is object {
  return val !== null && typeof val === 'object' && !Array.isArray(val)
}
