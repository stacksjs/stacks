import { URL } from 'node:url'
import { type Route } from '@stacksjs/types'
import { request } from './request'
import middlewares from './app/middleware/'

export function handleRequest(routes: Route[]) {
  Bun.serve({
    fetch(req) {
      const url = new URL(req.url)

      console.log(req)

      const foundRoute: Route = routes.find((route: Route) => {
        const pattern = new RegExp(`^${route.uri.replace(/:\w+/g, '\\w+')}$`)

        return pattern.test(url.pathname)
      }) as Route

      if (url.pathname === '/favicon.ico')
        return new Response('')

      if (!foundRoute)
        return new Response('Not found', { status: 404 })

      addRouteParamsandQuery(url, foundRoute)
      executeMiddleware(foundRoute)

      return execute(foundRoute, req)
    },
  })
}

function addRouteParamsandQuery(url: URL, route: Route): void {
  if (!isObjectNotEmpty(url.searchParams))
    request.addQuery(url)

  request.extractParamsFromRoute(route.uri, url.pathname)
}

function executeMiddleware(route: Route): void {
  const { middleware } = route

  if (middleware && middlewares && isObjectNotEmpty(middlewares)) {
    if (isString(middleware)) {
      const fn = middlewares[middleware]
      if (fn)
        fn() // Invoke only if it exists and is not undefined.
    }
    else {
      middleware.forEach((m) => {
        const fn = middlewares[m]
        if (fn)
          fn() // Again, invoke only if it exists.
      })
    }
  }
}

function execute(route: Route, request: any): Response {
  if (route?.method !== request.method)
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
