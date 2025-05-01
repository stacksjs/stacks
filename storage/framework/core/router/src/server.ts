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
  const foundCallback: CallbackWithStatus = await route.resolveCallback(foundRoute.callback)

  const middlewarePayload = await executeMiddleware(foundRoute)

  if (
    middlewarePayload !== null
    && typeof middlewarePayload === 'object'
    && Object.keys(middlewarePayload).length > 0
  ) {
    const { status, message } = middlewarePayload

    return new Response(`<html><body><h1>${message}</h1<pre></pre></body></html>`, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      },
      status: status || 401,
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
    return new Response('<html><body><h1>Method not allowed!</h1<pre></pre></body></html>', {
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

  if (isNumber(foundCallback)) {
    return new Response(String(foundCallback), {
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
      const { body } = await foundCallback

      const { error } = JSON.parse(body)

      return new Response(error, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
        },
        status: 401,
      })
    }

    if (foundCallback.status === 404) {
      const { body } = await foundCallback

      return new Response(body, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
        },
        status: 404,
      })
    }

    if (foundCallback.status === 403) {
      const { body } = await foundCallback

      const { error } = JSON.parse(body)

      return new Response(`<html><body><h1>${error}</h1<pre></pre></body></html>`, {
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

      const { body } = rest

      return new Response(JSON.stringify(body), {
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

      const { errors, stack } = rest

      const file = Bun.file(path.corePath('error-handling/src/views/500.html'))

      return file.text().then((htmlContent) => {
        // Replace the placeholder with the actual error message
        const modifiedHtml = htmlContent.replace('{{ERROR_MESSAGE}}', errors)
          .replace('{{STACK_TRACE}}', stack)

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
  }

  if (isObject(foundCallback)) {
    const { body, status } = await foundCallback

    const output = isString(body) ? body : JSON.stringify(body)

    return new Response(output, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      },
      status: status || 200,
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
      // Skip if request file doesn't exist
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
