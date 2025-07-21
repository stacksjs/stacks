import type { Model, Options, Route, RouteParam, ServeOptions } from '@stacksjs/types'
import type { WebSocketHandler } from 'bun'
// import type { RateLimitResult } from 'ts-rate-limiter'

import process from 'node:process'
import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { getModelName, traitInterfaces } from '@stacksjs/orm'
import { path } from '@stacksjs/path'
import { BunSocket, handleWebSocketRequest, PusherDriver, setBunSocket, SocketDriver } from '@stacksjs/realtime'
import { fs, globSync } from '@stacksjs/storage'

import { camelCase } from '@stacksjs/strings'
// import { RateLimiter } from 'ts-rate-limiter'
import { route, staticRoute } from '.'
import { request as RequestParam } from './request'

export async function serve(options: ServeOptions = {}): Promise<void> {
  const hostname = options.host || 'localhost'
  const port = options.port || 3000
  const development = options.debug ? true : process.env.APP_ENV !== 'production' && process.env.APP_ENV !== 'prod'
  const staticFiles = await staticRoute.getStaticConfig()

  if (options.timezone)
    process.env.TZ = options.timezone

  let driver = null

  // Initialize the appropriate driver based on configuration
  switch (config.realtime?.driver) {
    case 'bun':
      driver = new BunSocket()
      await driver.connect()
      setBunSocket(driver)
      break
    case 'socket':
      driver = new SocketDriver() // Use a different port for Socket.IO
      await driver.connect()
      break
    case 'pusher':
      driver = new PusherDriver()
      await driver.connect()
      break
    default:
      log.warn('No realtime driver configured')
  }

  const server = Bun.serve({
    static: staticFiles,
    hostname,
    port,
    development,

    async fetch(req: Request, server) {
      const url = new URL(req.url)

      // Handle WebSocket connections based on the configured driver
      if (url.pathname === '/ws') {
        switch (config.realtime?.driver) {
          case 'bun':
            return handleWebSocketRequest(req, server)
          case 'socket':
            // Socket.IO handles its own WebSocket connections
            return new Response('Socket.IO WebSocket endpoint', { status: 200 })
          case 'pusher':
            // Pusher connects directly to Pusher's servers
            return new Response('Pusher WebSocket endpoint', { status: 200 })
          default:
            return new Response('No WebSocket driver configured', { status: 400 })
        }
      }

      // Handle regular HTTP requests with body parsing
      const reqBody = await req.text()
      return serverResponse(req, reqBody)
    },

    websocket: config.realtime?.driver === 'bun'
      ? (driver as BunSocket)?.getWebSocketConfig() as WebSocketHandler<any>
      : {
          message() {},
          open() {},
          close() {},
          drain() {},
        },
  })

  if (driver) {
    if (config.realtime?.driver === 'bun') {
      (driver as BunSocket).setServer(server)
    }
    log.info(`WebSocket server initialized with ${config.realtime?.driver} driver`)
  }

  log.info(`Server running at http://${hostname}:${port}`)
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
    return new Response('<html><body><h1>Route not found!</h1<pre></pre></body></html>', {
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
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
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

async function execute(foundRoute: Route, req: Request, _options: Options) {
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

  // foundCallback is now a ResponseData object from response.ts
  const { status, headers, body } = foundCallback

  // Return the response with the exact body from response.ts
  return new Response(body, {
    headers: {
      ...headers,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
    },
    status,
  })
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

  if (!middleware)
    return null

  // Get middleware aliases from app/Middleware.ts
  const middlewareAliases = (await import(path.appPath('Middleware.ts'))).default

  // Helper function to resolve middleware path
  async function resolveMiddlewarePath(middlewareName: string): Promise<string> {
    // Check if it's an alias
    const actualName = middlewareAliases[middlewareName] || middlewareName
    let middlewarePath = path.userMiddlewarePath(`${actualName}.ts`)

    if (!fs.existsSync(middlewarePath))
      middlewarePath = path.storagePath(`framework/defaults/middleware/${actualName}.ts`)

    if (!fs.existsSync(middlewarePath))
      throw new Error(`Middleware "${middlewareName}" not found in user or default paths`)

    return middlewarePath
  }

  // Helper function to execute a single middleware with negation support
  async function executeSingleMiddleware(middlewareName: string) {
    try {
      let isNegated = false
      let actualMiddlewareName = middlewareName

      // Check if middleware is negated (starts with !)
      if (middlewareName.startsWith('!')) {
        isNegated = true
        actualMiddlewareName = middlewareName.slice(1) // Remove the ! prefix
      }

      const middlewarePath = await resolveMiddlewarePath(actualMiddlewareName)
      const middlewareInstance = (await import(middlewarePath)).default

      if (!middlewareInstance?.handle)
        throw new Error(`Middleware "${actualMiddlewareName}" does not have a handle method`)

      // Execute the middleware
      await middlewareInstance.handle(RequestParam)

      // If negated, we want the opposite behavior
      // If the original middleware didn't throw an error (allowed access),
      // then the negated version should throw an error (deny access)
      if (isNegated) {
        return {
          status: 403,
          message: `Access denied by negated middleware "${actualMiddlewareName}"`,
        }
      }
    }
    catch (error: any) {
      // If negated and the original middleware threw an error (denied access),
      // then the negated version should allow access (don't throw)
      if (middlewareName.startsWith('!')) {
        return null // Allow access for negated middleware
      }

      return {
        status: error.status || 500,
        message: error.message || 'Internal Server Error',
      }
    }
  }

  // Handle both single middleware and array of middleware
  const middlewareList = Array.isArray(middleware) ? middleware : [middleware]

  for (const middlewareName of middlewareList) {
    const result = await executeSingleMiddleware(middlewareName)
    if (result)
      return result // Return early if middleware returns an error
  }

  return null
}
