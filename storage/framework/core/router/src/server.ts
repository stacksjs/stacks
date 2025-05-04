import type { Model, Options, Route, RouteParam, ServeOptions } from '@stacksjs/types'
// import type { RateLimitResult } from 'ts-rate-limiter'

import process from 'node:process'
import { handleError } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { getModelName, traitInterfaces } from '@stacksjs/orm'
import { extname, path } from '@stacksjs/path'
import { fs, globSync } from '@stacksjs/storage'
import { camelCase } from '@stacksjs/strings'
import { isNumber } from '@stacksjs/validation'

// import { RateLimiter } from 'ts-rate-limiter'
import { route, staticRoute } from '.'

import { middlewares } from './middleware'
import { request as RequestParam } from './request'

export async function serve(options: ServeOptions = {}): Promise<void> {
  const hostname = options.host || 'localhost'
  const port = options.port || 3000
  const development = options.debug ? true : process.env.APP_ENV !== 'production' && process.env.APP_ENV !== 'prod'
  const staticFiles = await staticRoute.getStaticConfig()

  if (options.timezone)
    process.env.TZ = options.timezone

  Bun.serve({
    static: staticFiles,
    hostname,
    port,
    development,

    async fetch(req: Request) {
      const reqBody = await req.text()

      return await serverResponse(req, reqBody)
    },
  })
}

export async function serverResponse(req: Request, body: string): Promise<Response> {
  log.debug(`Incoming Request: ${req.method} ${req.url}`)
  log.debug(`Headers: ${JSON.stringify(req.headers)}`)
  log.debug(`Body: ${JSON.stringify(req.body)}`)

  // const result = await limiter.check(req)

  // if (!result.allowed) {
  //   log.info(`Rate limit exceeded: ${result.current}/${result.limit}`)
  //   log.info(`Reset in ${Math.ceil(result.remaining / 1000)} seconds`)

  //   // Handle rate limiting in your own way
  //   return new Response('Too many requests', { status: 429 })
  // }

  const trimmedUrl = req.url.endsWith('/') && req.url.length > 1 ? req.url.slice(0, -1) : req.url
  const url: URL = new URL(trimmedUrl) as URL
  const routesList: Route[] = await route.getRoutes()

  log.info(`Routes List: ${JSON.stringify(routesList)}`)
  log.info(`URL: ${JSON.stringify(url)}`)

  if (req.method === 'OPTIONS') {
    return handleOptions()
  }

  const foundRoute: Route | undefined = routesList
    .find((route: Route) => {
      const pattern = new RegExp(`^${route.uri.replace(/\{(\w+)\}/g, '(\\w+)')}$`)
      return pattern.test(url.pathname) && route.method === req.method
    })

  log.info(`Found Route: ${JSON.stringify(foundRoute)}`)

  if (!foundRoute) {
    // TODO: create a pretty 404 page
    return new Response('<html><body><h1>Page not found!</h1<pre></pre></body></html>', {
      status: 404,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Content-Type': 'application/json',
      },
    })
  }

  const routeParams = extractDynamicSegments(foundRoute.uri, url.pathname)

  if (!body) {
    await addRouteQuery(url)
  }
  else {
    await addBody(body)
  }

  await addRouteParam(routeParams)
  await addHeaders(req.headers as Headers)

  return await execute(foundRoute, req, { statusCode: foundRoute?.statusCode })
}

function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, Access-Control-Allow-Headers, Access-Control-Allow-Origin, Accept',
      'Access-Control-Max-Age': '86400', // Cache the preflight response for a day
    },
  })
}

function extractDynamicSegments(routePattern: string, path: string): RouteParam {
  const regexPattern = new RegExp(`^${routePattern.replace(/\{(\w+)\}/g, '(\\w+)')}$`)
  const match = path.match(regexPattern)

  if (!match) {
    return {}
  }

  const dynamicSegmentNames = [...routePattern.matchAll(/\{(\w+)\}/g)].map(m => m[1])
  const dynamicSegmentValues = match.slice(1) // First match is the whole string, so we slice it off

  const dynamicSegments: { [key: string]: string } = {}
  dynamicSegmentNames.forEach((name, index) => {
    if (name && dynamicSegmentValues[index] !== undefined) {
      dynamicSegments[name] = dynamicSegmentValues[index] // Ensure value is defined
    }
  })
  return dynamicSegments
}

type CallbackWithStatus = Route['callback'] & { status: number }

async function execute(foundRoute: Route, req: Request, { statusCode }: Options) {
  const foundCallback = await route.resolveCallback(foundRoute.callback)

  const middlewarePayload = await executeMiddleware(foundRoute)
  if (
    middlewarePayload !== null
    && typeof middlewarePayload === 'object'
    && Object.keys(middlewarePayload).length > 0
  ) {
    const { status, message } = middlewarePayload
    return new Response(`<html><body><h1>${message}</h1></body></html>`, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      },
      status: status || 401,
    })
  }

  if (foundRoute?.method !== req.method) {
    return new Response('<html><body><h1>Method not allowed!</h1></body></html>', {
      status: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      },
    })
  }

  const { status, body } = foundCallback

  // Special handling for 500 errors to show error page
  if (status === 500) {
    const file = Bun.file(path.corePath('error-handling/src/views/500.html'))
    return file.text().then((htmlContent) => {
      const modifiedHtml = htmlContent
        .replace('{{ERROR_MESSAGE}}', String(body))
        .replace('{{STACK_TRACE}}', foundCallback.stack || '')

      return new Response(modifiedHtml, {
        headers: {
          'Content-Type': 'text/html',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
        },
        status: 500,
      })
    })
  }

  // All other responses as JSON
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
    },
    status,
  })
}

function noCache(response: Response): Response {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Expires', '0')

  return response
}

async function applyToAllRequests(operation: 'addBodies' | 'addParam' | 'addHeaders' | 'addQuery', data: any): Promise<void> {
  const modelFiles = globSync([path.userModelsPath('*.ts'), path.storagePath('framework/defaults/models/**/*.ts')], { absolute: true })

  // Process model files
  for (const modelFile of modelFiles) {
    const model = (await import(modelFile)).default as Model
    const modelName = getModelName(model, modelFile)
    const requestPath = path.frameworkPath(`requests/${modelName}Request.ts`)
    const requestImport = await import(requestPath)
    const requestInstance = requestImport[`${camelCase(modelName)}Request`]

    if (requestInstance) {
      requestInstance[operation](data)
    }
  }

  // Process trait interfaces
  for (const trait of traitInterfaces) {
    const requestPath = path.frameworkPath(`requests/${trait.name}Request.ts`)
    try {
      const requestImport = await import(requestPath)
      const requestInstance = requestImport[`${camelCase(trait.name)}Request`]

      if (requestInstance) {
        requestInstance[operation](data)
      }
    }
    catch (error) {
      log.error(`Error importing trait interface: ${error}`)
      continue
    }
  }

  RequestParam[operation](data)
}

async function addRouteQuery(url: URL): Promise<void> {
  await applyToAllRequests('addQuery', url)
}

async function addBody(params: any): Promise<void> {
  await applyToAllRequests('addBodies', JSON.parse(params))
}

async function addRouteParam(param: RouteParam): Promise<void> {
  await applyToAllRequests('addParam', param)
}

async function addHeaders(headers: Headers): Promise<void> {
  await applyToAllRequests('addHeaders', headers)
}

async function executeMiddleware(route: Route): Promise<any> {
  const { middleware = null } = route

  if (middleware && await middlewares() && isObjectNotEmpty(await middlewares())) {
    // let middlewareItem: MiddlewareOptions
    if (isString(middleware)) {
      let middlewarePath = path.userMiddlewarePath(`${middleware}.ts`)

      if (!fs.existsSync(middlewarePath)) {
        middlewarePath = path.storagePath(`framework/defaults/middleware/${middleware}.ts`)
      }

      const middlewareInstance = (await import(middlewarePath)).default

      try {
        await middlewareInstance.handle()
      }
      catch (error: any) {
        return error
      }
    }
    else {
      for (const middlewareElement of middleware) {
        let middlewarePath = path.userMiddlewarePath(`${middlewareElement}.ts`)

        if (!fs.existsSync(middlewarePath)) {
          middlewarePath = path.storagePath(`framework/defaults/middleware/${middlewareElement}.ts`)
        }

        const middlewareInstance = (await import(middlewarePath)).default

        try {
          await middlewareInstance.handle()
        }
        catch (error: any) {
          return error
        }
      }
    }
  }
}

function isString(val: unknown): val is string {
  return typeof val === 'string'
}

function isObjectNotEmpty(obj: object): boolean {
  return Object.keys(obj).length > 0
}

// eslint-disable-next-line ts/no-unsafe-function-type
function isFunction(val: unknown): val is Function {
  return typeof val === 'function'
}

function isObject(val: unknown): val is object {
  return typeof val === 'object'
}
