import process from 'node:process'
import { log } from '@stacksjs/logging'
import { extname, path } from '@stacksjs/path'
import { glob } from '@stacksjs/storage'
import type { Model, Route, RouteParam, StatusCode } from '@stacksjs/types'
import { route } from '.'
import { middlewares } from './middleware'
import { request as RequestParam } from './request'
import { getModelName } from '@stacksjs/orm'
import { camelCase, lowercase } from '@stacksjs/strings'

interface ServeOptions {
  host?: string
  port?: number
  debug?: boolean
  timezone?: string
}

interface Options {
  statusCode?: StatusCode
}

export async function serve(options: ServeOptions = {}) {
  const hostname = options.host || 'localhost'
  const port = options.port || 3000
  const development = options.debug ? true : process.env.APP_ENV !== 'production' && process.env.APP_ENV !== 'prod'

  if (options.timezone) process.env.TZ = options.timezone

  Bun.serve({
    hostname,
    port,
    development,

    async fetch(req: Request) {
      return await serverResponse(req)
    },
  })
}

export async function serverResponse(req: Request) {
  log.info(`Incoming Request: ${req.method} ${req.url}`)
  log.info(`Headers: ${JSON.stringify(req.headers)}`)
  log.info(`Body: ${JSON.stringify(req.body)}`)
  // log.info(`Query: ${JSON.stringify(req.query)}`)
  // log.info(`Params: ${JSON.stringify(req.params)}`)
  // log.info(`Cookies: ${JSON.stringify(req.cookies)}`)

  // Trim trailing slash from the URL if it's not the root '/'
  // This automatically allows for route definitions, like
  // '/about' and '/about/' to be treated as the same
  const trimmedUrl = req.url.endsWith('/') && req.url.length > 1 ? req.url.slice(0, -1) : req.url

  const url = new URL(trimmedUrl)

  const routesList: Route[] = await route.getRoutes()
  log.info(`Routes List: ${JSON.stringify(routesList)}`)

  log.info(`URL: ${JSON.stringify(url)}`)

  const foundRoute: Route | undefined = routesList
    .filter((route: Route) => {
      const pattern = new RegExp(`^${route.uri.replace(/\{(\w+)\}/g, '(\\w+)')}$`)

      return pattern.test(url.pathname)
    })
    .find((route: Route) => route.method === req.method)

  log.info(`Found Route: ${JSON.stringify(foundRoute)}`)
  // if (url.pathname === '/favicon.ico')
  //   return new Response('')

  if (!foundRoute) return new Response('Pretty 404 page coming soon', { status: 404 }) // TODO: create a pretty 404 page

  const routeParams = extractDynamicSegments(foundRoute.uri, url.pathname)

  await addRouteQuery(url)
  await addRouteParam(routeParams)

  await executeMiddleware(foundRoute)

  return await execute(foundRoute, req, { statusCode: foundRoute?.statusCode })
}

function extractDynamicSegments(routePattern: string, path: string): RouteParam {
  const regexPattern = new RegExp(`^${routePattern.replace(/\{(\w+)\}/g, '(\\w+)')}$`)
  const match = path.match(regexPattern)

  if (!match) {
    return null
  }
  const dynamicSegmentNames = [...routePattern.matchAll(/\{(\w+)\}/g)].map((m) => m[1])
  const dynamicSegmentValues = match.slice(1) // First match is the whole string, so we slice it off

  const dynamicSegments: { [key: string]: string } = {}
  dynamicSegmentNames.forEach((name, index) => {
    dynamicSegments[name] = dynamicSegmentValues[index]
  })

  return dynamicSegments
}

async function execute(foundRoute: Route, req: Request, { statusCode }: Options) {
  const errorStatuses = [422, 401, 403, 500]

  const foundCallback = await route.resolveCallback(foundRoute.callback)

  if (!statusCode) statusCode = 200

  if (foundRoute?.method === 'GET' && (statusCode === 301 || statusCode === 302)) {
    const callback = String(foundCallback)
    const response = Response.redirect(callback, statusCode)

    return await noCache(response)
  }

  if (foundRoute?.method !== req.method) return new Response('Method not allowed', { status: 405 })

  // Check if it's a path to an HTML file
  if (isString(foundCallback) && extname(foundCallback) === '.html') {
    try {
      const fileContent = Bun.file(foundCallback)

      return await new Response(fileContent, {
        headers: { 'Content-Type': 'text/html' },
      })
    } catch (error) {
      return await new Response('Error reading the HTML file', { status: 500 })
    }
  }

  if (isString(foundCallback)) return await new Response(foundCallback, { 
      headers: { 'Content-Type': 'json', }, status: 200
    }
  )

  if (isFunction(foundCallback)) {
    const result = foundCallback()

    return await new Response(JSON.stringify(result), { status: 200 })
  }

  if (isObject(foundCallback) && foundCallback.status) {
    if (errorStatuses.includes(foundCallback.status)) {
      delete foundCallback.status
      return await new Response(JSON.stringify(foundCallback),
      { headers: { 'Content-Type': 'json' }, status: 422 })
    }
  }

  if (isObject(foundCallback))
    return await new Response(JSON.stringify(foundCallback),
      { headers: { 'Content-Type': 'json' }, status: 200 })

  // If no known type matched, return a generic error.
  return await new Response('Unknown callback type.', { status: 500 })
}

function noCache(response: Response) {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Expires', '0')

  return response
}

async function addRouteQuery(url: URL) {
  const modelFiles = glob.sync(path.userModelsPath('*.ts'));

  for (const modelFile of modelFiles) {
    const model = (await import(modelFile)).default;
    const modelName = getModelName(model, modelFile);
    const modelNameLower = `${camelCase(modelName)}Request`;
    const requestPath = path.projectStoragePath(`framework/requests/${modelName}Request.ts`);
    const requestImport = await import(requestPath);
    const requestInstance = requestImport[modelNameLower];

    if (requestInstance && !isObjectNotEmpty(url.searchParams)) {
      requestInstance.addQuery(url);
    }
  }

  if (!isObjectNotEmpty(url.searchParams)) {
    RequestParam.addQuery(url);
  }
}

async function addRouteParam(param: RouteParam): Promise<void> {
  const modelFiles = glob.sync(path.userModelsPath('*.ts'));

  for (const modelFile of modelFiles) {
    const model = (await import(modelFile)).default as Model;
    const modelName = getModelName(model, modelFile);
    const modelNameLower = `${lowercase(modelName)}Request`;
    const requestPath = path.projectStoragePath(`framework/requests/${modelName}Request.ts`);
    const requestImport = await import(requestPath);
    const requestInstance = requestImport[modelNameLower];

    if (requestInstance) {
      requestInstance.addParam(param);
    }
  }

  RequestParam.addParam(param)
}

function executeMiddleware(route: Route): void {
  const { middleware = null } = route

  if (middleware && middlewares && isObjectNotEmpty(middlewares)) {
    // let middlewareItem: MiddlewareOptions
    if (isString(middleware)) {
      // TODO: fix and uncomment this
      // middlewareItem = middlewares.find((m) => {
      //   return m.name === middleware
      // })
      // if (middlewareItem)
      //   middlewareItem.handle() // Invoke only if it exists and is not undefined.
    } else {
      // middleware.forEach((m) => {
      middleware.forEach(() => {
        // TODO: fix and uncomment this
        // middlewareItem = middlewares.find((middlewareItem: MiddlewareOptions) => {
        //   return middlewareItem.name === m
        // })
        // if (middlewareItem)
        //   middlewareItem.handle() // Again, invoke only if it exists.
      })
    }
  }
}
function isString(val: unknown): val is string {
  return typeof val === 'string'
}

function isObjectNotEmpty(obj: object): boolean {
  return Object.keys(obj).length > 0
}

function isFunction(val: unknown): val is Function {
  return typeof val === 'function'
}

function isObject(val: unknown): val is object {
  return typeof val === 'object'
}
