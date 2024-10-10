import type { Model, Route, RouteParam, StatusCode } from '@stacksjs/types'
import process from 'node:process'
import { handleError } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { getModelName } from '@stacksjs/orm'
import { extname, path } from '@stacksjs/path'
import { globSync } from '@stacksjs/storage'
import { route } from '.'
import { middlewares } from './middleware'
import { request as RequestParam } from './request'

interface ServeOptions {
  host?: string
  port?: number
  debug?: boolean
  timezone?: string
}

interface Options {
  statusCode?: StatusCode
}

export async function serve(options: ServeOptions = {}): Promise<void> {
  const hostname = options.host || 'localhost'
  const port = options.port || 3000
  const development = options.debug ? true : process.env.APP_ENV !== 'production' && process.env.APP_ENV !== 'prod'

  if (options.timezone)
    process.env.TZ = options.timezone

  Bun.serve({
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
  // log.debug(`Query: ${JSON.stringify(req.query)}`)
  // log.debug(`Params: ${JSON.stringify(req.params)}`)
  // log.debug(`Cookies: ${JSON.stringify(req.cookies)}`)

  // Trim trailing slash from the URL if it's not the root '/'
  // This automatically allows for route definitions, like
  // '/about' and '/about/' to be treated as the same
  const trimmedUrl = req.url.endsWith('/') && req.url.length > 1 ? req.url.slice(0, -1) : req.url
  const url = new URL(trimmedUrl)
  const routesList: Route[] = await route.getRoutes()

  log.info(`Routes List: ${JSON.stringify(routesList)}`)
  log.info(`URL: ${JSON.stringify(url)}`)

  if (req.method === 'OPTIONS') {
    return handleOptions(req)
  }

  const foundRoute: Route | undefined = routesList
    .filter((route: Route) => {
      const pattern = new RegExp(`^${route.uri.replace(/\{(\w+)\}/g, '(\\w+)')}$`)

      return pattern.test(url.pathname)
    })
    .find((route: Route) => route.method === req.method)

  log.info(`Found Route: ${JSON.stringify(foundRoute)}`)

  if (!foundRoute) {
    // TODO: create a pretty 404 page
    return new Response('Pretty 404 page coming soon', {
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
  await addHeaders(req.headers)

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
    return null
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
  const foundCallback: CallbackWithStatus = await route.resolveCallback(foundRoute.callback)

  //   return new Response(`<html><body><h1>Error</h1><p>${foundCallback}</p><pre></pre></body></html>`, {
  //   headers: {
  //     'Content-Type': 'text/html',
  //     'Access-Control-Allow-Origin': '*',
  //     'Access-Control-Allow-Headers': '*',
  //   },
  //   status: 500,
  // })
  
  const middlewarePayload = await executeMiddleware(foundRoute)
  

  if (
    middlewarePayload !== null
    && typeof middlewarePayload === 'object'
    && Object.keys(middlewarePayload).length > 0
  ) {
    const middlewareStatus = middlewarePayload.status

    const { status, ...payloadWithoutStatus } = middlewarePayload

    return new Response(JSON.stringify(payloadWithoutStatus), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      },
      status: middlewareStatus || 401,
    })
  }

  if (!statusCode)
    statusCode = 200

  if (foundRoute?.method === 'GET' && (statusCode === 301 || statusCode === 302)) {
    const callback = String(foundCallback)
    const response = Response.redirect(callback, statusCode)

    return noCache(response)
  }

  if (foundRoute?.method !== req.method) {
    return new Response('Method not allowed', {
      status: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      },
    })
  }

  // Check if it's a path to an HTML file
  if (isString(foundCallback) && extname(foundCallback) === '.html') {
    try {
      const fileContent = Bun.file(foundCallback)

      return new Response(fileContent, {
        headers: {
          'Content-Type': 'text/html',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
        },
      })
    }
    catch (error) {
      handleError('Error reading the HTML file', error)
      return new Response('Error reading the HTML file', {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
        },
      })
    }
  }

  if (isString(foundCallback)) {
    return new Response(foundCallback, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      },
      status: 200,
    })
  }

  if (foundCallback === undefined || foundCallback === null) {
    return new Response('', {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      },
      status: 204,
    })
  }

  if (isFunction(foundCallback)) {
    const result = foundCallback()

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      },
    })
  }

  if (isObject(foundCallback) && foundCallback.status) {
    if (foundCallback.status === 401) {
      const { status, ...rest } = await foundCallback

      return new Response(JSON.stringify(rest), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
        },
        status: 401,
      })
    }

    if (foundCallback.status === 404) {
      const { status, ...rest } = await foundCallback

      const { errors } = rest
      return new Response(JSON.stringify(errors), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
        },
        status: 404,
      })
    }

    if (foundCallback.status === 403) {
      const { status, ...rest } = await foundCallback

      return new Response(JSON.stringify(rest), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
        },
        status: 403,
      })
    }

    if (foundCallback.status === 422) {
      const { status, ...rest } = await foundCallback

      return new Response(JSON.stringify(rest), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
        },
        status: 422,
      })
    }

    if (foundCallback.status === 500) {
      const { status, ...rest } = await foundCallback

      const { errors } = rest
      return new Response(`<html><body><h1>Error</h1><p>${errors}</p><pre></pre></body></html>`, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
        },
        status: 500,
      })
    }
  }

  if (isObject(foundCallback)) {
    return new Response(JSON.stringify(foundCallback), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      },
      status: 200,
    })
  }

  // If no known type matched, return a generic error.
  return new Response('Unknown callback type.', {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
    },
    status: 500,
  })
}

function noCache(response: Response): Response {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Expires', '0')

  return response
}

async function addRouteQuery(url: URL): Promise<void> {
  const modelFiles = globSync([path.userModelsPath('*.ts')], { absolute: true })
  for (const modelFile of modelFiles) {
    const model = (await import(modelFile)).default
    const modelName = getModelName(model, modelFile)
    const requestPath = path.frameworkPath(`requests/${modelName}Request.ts`)
    const requestImport = await import(requestPath)
    const requestInstance = requestImport.request

    if (requestInstance) {
      requestInstance.addQuery(url)
    }
  }

  RequestParam.addQuery(url)
}

async function addBody(params: any): Promise<void> {
  const modelFiles = globSync([path.userModelsPath('*.ts')], { absolute: true })

  for (const modelFile of modelFiles) {
    const model = (await import(modelFile)).default
    const modelName = getModelName(model, modelFile)
    const requestPath = path.frameworkPath(`requests/${modelName}Request.ts`)
    const requestImport = await import(requestPath)
    const requestInstance = requestImport.request

    if (requestInstance) {
      requestInstance.addBodies(JSON.parse(params))
    }
  }

  RequestParam.addBodies(JSON.parse(params))
}

async function addRouteParam(param: RouteParam): Promise<void> {
  const modelFiles = globSync([path.userModelsPath('*.ts')], { absolute: true })

  for (const modelFile of modelFiles) {
    const model = (await import(modelFile)).default as Model
    const modelName = getModelName(model, modelFile)
    const requestPath = path.frameworkPath(`requests/${modelName}Request.ts`)
    const requestImport = await import(requestPath)
    const requestInstance = requestImport.request

    if (requestInstance) {
      requestInstance.addParam(param)
    }
  }

  RequestParam.addParam(param)
}

async function addHeaders(headers: Headers): Promise<void> {
  const modelFiles = globSync([path.userModelsPath('*.ts')], { absolute: true })

  for (const modelFile of modelFiles) {
    const model = (await import(modelFile)).default as Model
    const modelName = getModelName(model, modelFile)
    const requestPath = path.frameworkPath(`requests/${modelName}Request.ts`)
    const requestImport = await import(requestPath)
    const requestInstance = requestImport.request

    if (requestInstance) {
      requestInstance.addHeaders(headers)
    }
  }

  RequestParam.addHeaders(headers)
}

async function executeMiddleware(route: Route): Promise<any> {
  const { middleware = null } = route

  if (middleware && middlewares && isObjectNotEmpty(middlewares)) {
    // let middlewareItem: MiddlewareOptions
    if (isString(middleware)) {
      const middlewarePath = path.userMiddlewarePath(`${middleware}.ts`)

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
        const middlewarePath = path.userMiddlewarePath(`${middlewareElement}.ts`)

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
