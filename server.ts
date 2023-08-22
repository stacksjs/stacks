import { URL } from 'node:url'
import { Request } from './Request'

interface Route {
  uri: string
  // eslint-disable-next-line @typescript-eslint/ban-types
  callback: Function | string | object
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
}

const routes: Route[] = []

Bun.serve({
  fetch(req) {
    const url = new URL(req.url)

    const route = routes.find((route) => {
      return route.uri.match(url.pathname)
    })

    if (url.pathname === '/favicon.ico')
      return new Response('')

    if (!route)
      throw new Error('No matching route found.')

    if (!isObjectNotEmpty(url.searchParams))
      Request.addParams(url)

    if (route?.method !== req.method)
      return new Response('Method not allowed', { status: 405 })

    if (isString(route.callback))
      return new Response(route.callback)

    if (isFunction(route.callback)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result = (route.callback)()

      return new Response(JSON.stringify(result))
    }

    if (isObject(route.callback))
      return new Response(JSON.stringify(route.callback))

    // If no known type matched, return a generic error.
    return new Response('Unknown callback type.', { status: 500 })
  },
})

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

function getUsers(): object {
  return [{
    foo: 'bar',
  }]
}

function postBlogs(): object {
  return [{
    foo: 'bar',
  }]
}

function addRoute(method: Route['method'], uri: string, callback: any): void {
  routes.push({ method, uri, callback })
}

function get(url: string, callback: any): any {
  addRoute('GET', url, callback)
}

function post(url: string, callback: any): any {
  addRoute('POST', url, callback)
}

get('/users', getUsers)
post('/blogs', postBlogs)

console.log('Your local server is: http://localhost:3000')
