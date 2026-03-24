import { describe, expect, test } from 'bun:test'
import {
  HttpError,
  HttpErrorHandler,
  createHttpErrorHandler,
  renderHttpError,
  errorMiddleware,
} from '../src/http'
import {
  ok,
  err,
  fromPromise,
} from 'ts-error-handling'
import {
  HTTP_ERRORS,
  renderProductionErrorPage,
  renderErrorPage,
  renderError,
  errorResponse,
  createErrorHandler,
  ErrorPageHandler,
} from '../src/error-page'
import { ModelNotFoundException } from '../src/model'
import { rescue } from '../src/utils'

describe('Error Handling Integration', () => {
  describe('HttpError creation and properties', () => {
    test('HttpError stores status and message', () => {
      const error = new HttpError(404, 'Page not found')
      expect(error.status).toBe(404)
      expect(error.message).toBe('Page not found')
      expect(error.name).toBe('Server Error!')
    })

    test('HttpError is an instance of Error', () => {
      const error = new HttpError(500, 'Internal error')
      expect(error instanceof Error).toBe(true)
    })

    test('HttpError with different status codes', () => {
      const codes = [400, 401, 403, 404, 422, 429, 500, 503]
      for (const code of codes) {
        const e = new HttpError(code, `Error ${code}`)
        expect(e.status).toBe(code)
        expect(e.message).toBe(`Error ${code}`)
      }
    })

    test('HttpError can be caught in try/catch', () => {
      let caught: HttpError | null = null
      try {
        throw new HttpError(403, 'Forbidden')
      }
      catch (e) {
        caught = e as HttpError
      }
      expect(caught).not.toBeNull()
      expect(caught!.status).toBe(403)
      expect(caught!.message).toBe('Forbidden')
    })
  })

  describe('HttpErrorHandler', () => {
    test('notFound returns 404 response', () => {
      const handler = createHttpErrorHandler({ isDevelopment: false })
      const response = handler.notFound()
      expect(response.status).toBe(404)
      expect(response.headers.get('Content-Type')).toContain('text/html')
    })

    test('forbidden returns 403 response', () => {
      const handler = createHttpErrorHandler({ isDevelopment: false })
      const response = handler.forbidden('No access')
      expect(response.status).toBe(403)
    })

    test('unauthorized returns 401 response', () => {
      const handler = createHttpErrorHandler({ isDevelopment: false })
      const response = handler.unauthorized()
      expect(response.status).toBe(401)
    })

    test('badRequest returns 400 response', () => {
      const handler = createHttpErrorHandler({ isDevelopment: false })
      const response = handler.badRequest('Invalid input')
      expect(response.status).toBe(400)
    })

    test('serverError returns 500 response', () => {
      const handler = createHttpErrorHandler({ isDevelopment: false })
      const response = handler.serverError(new Error('boom'))
      expect(response.status).toBe(500)
    })

    test('validationError returns 422 response', () => {
      const handler = createHttpErrorHandler({ isDevelopment: false })
      const response = handler.validationError()
      expect(response.status).toBe(422)
    })

    test('tooManyRequests returns 429 response', () => {
      const handler = createHttpErrorHandler({ isDevelopment: false })
      const response = handler.tooManyRequests()
      expect(response.status).toBe(429)
    })

    test('serviceUnavailable returns 503 response', () => {
      const handler = createHttpErrorHandler({ isDevelopment: false })
      const response = handler.serviceUnavailable()
      expect(response.status).toBe(503)
    })

    test('development mode renders detailed error page', async () => {
      const handler = createHttpErrorHandler({ isDevelopment: true })
      const response = handler.handle(new Error('Debug error'), 500)
      const html = await response.text()
      expect(html).toContain('Debug error')
      expect(html).toContain('Stack Trace')
    })

    test('production mode does not leak error details', async () => {
      const handler = createHttpErrorHandler({ isDevelopment: false })
      const response = handler.handle(new Error('secret internal detail'), 500)
      const html = await response.text()
      expect(html).not.toContain('secret internal detail')
      expect(html).toContain('500')
    })
  })

  describe('Error page rendering', () => {
    test('renderProductionErrorPage contains status code', () => {
      const html = renderProductionErrorPage(404)
      expect(html).toContain('404')
      expect(html).toContain('Not Found')
    })

    test('renderProductionErrorPage handles all HTTP error codes', () => {
      const codes: Array<keyof typeof HTTP_ERRORS> = [400, 401, 403, 404, 500, 503]
      for (const code of codes) {
        const html = renderProductionErrorPage(code)
        expect(html).toContain(String(code))
        expect(html).toContain(HTTP_ERRORS[code].title)
      }
    })

    test('renderErrorPage includes error message in dev page', () => {
      const html = renderErrorPage(new Error('test failure'), 500)
      expect(html).toContain('test failure')
      expect(html).toContain('<!DOCTYPE html>')
    })

    test('renderError is an alias that works the same', () => {
      const html = renderError(new Error('alias test'), 400)
      expect(html).toContain('alias test')
    })

    test('errorResponse returns a Response object', () => {
      const resp = errorResponse(new Error('response test'), 500)
      expect(resp.status).toBe(500)
      expect(resp.headers.get('Content-Type')).toContain('text/html')
    })

    test('HTTP_ERRORS has correct structure', () => {
      expect(HTTP_ERRORS[404].title).toBe('Not Found')
      expect(HTTP_ERRORS[500].title).toBe('Internal Server Error')
      expect(HTTP_ERRORS[401].title).toBe('Unauthorized')
      expect(HTTP_ERRORS[429].title).toBe('Too Many Requests')
    })
  })

  describe('ErrorPageHandler', () => {
    test('render includes error name and message', () => {
      const handler = new ErrorPageHandler()
      const html = handler.render(new Error('Custom error'), 500)
      expect(html).toContain('Custom error')
      expect(html).toContain('500')
    })

    test('setFramework includes framework info', () => {
      const handler = new ErrorPageHandler()
      handler.setFramework('Stacks', '1.0.0')
      const html = handler.render(new Error('test'), 500)
      expect(html).toContain('Stacks')
      expect(html).toContain('v1.0.0')
    })

    test('setRequest includes request info', () => {
      const handler = new ErrorPageHandler()
      handler.setRequest({
        method: 'POST',
        url: 'https://example.com/api/users',
        headers: { 'content-type': 'application/json' },
      })
      const html = handler.render(new Error('test'), 500)
      expect(html).toContain('POST')
      expect(html).toContain('https://example.com/api/users')
    })

    test('addQuery tracks database queries', () => {
      const handler = new ErrorPageHandler()
      handler.addQuery('SELECT * FROM users', 12.5, 'mysql')
      const html = handler.render(new Error('test'), 500)
      expect(html).toContain('SELECT * FROM users')
      expect(html).toContain('12.50ms')
    })

    test('handleError returns Response with correct status', () => {
      const handler = new ErrorPageHandler()
      const resp = handler.handleError(new Error('test'), 422)
      expect(resp.status).toBe(422)
    })
  })

  describe('ModelNotFoundException', () => {
    test('ModelNotFoundException stores status and message', () => {
      const e = new ModelNotFoundException(404, 'User not found')
      expect(e.status).toBe(404)
      expect(e.message).toBe('User not found')
      expect(e.name).toBe('ModelNotFoundException')
    })

    test('ModelNotFoundException is an instance of Error', () => {
      const e = new ModelNotFoundException(404, 'Not found')
      expect(e instanceof Error).toBe(true)
    })
  })

  describe('Result type (ok/err)', () => {
    test('ok wraps a success value', () => {
      const result = ok(42)
      expect(result.isOk).toBe(true)
      expect(result.isErr).toBe(false)
      expect(result.value).toBe(42)
    })

    test('err wraps an error value', () => {
      const result = err('something failed')
      expect(result.isErr).toBe(true)
      expect(result.isOk).toBe(false)
      expect(result.error).toBe('something failed')
    })

    test('ok result can be mapped', () => {
      const result = ok(10).map(n => n * 2)
      expect(result.isOk).toBe(true)
      expect(result.value).toBe(20)
    })

    test('err result map is skipped', () => {
      const result = err<string, number>('fail').map(n => n * 2)
      expect(result.isErr).toBe(true)
      expect(result.error).toBe('fail')
    })

    test('ok unwrapOr returns inner value', () => {
      expect(ok(10).unwrapOr(0)).toBe(10)
    })

    test('err unwrapOr returns fallback', () => {
      expect(err('fail').unwrapOr(0)).toBe(0)
    })

    test('fromPromise converts resolved promise to Ok', async () => {
      const result = await fromPromise(Promise.resolve(42), (e) => String(e))
      expect(result.isOk).toBe(true)
      expect(result.value).toBe(42)
    })

    test('fromPromise converts rejected promise to Err', async () => {
      const result = await fromPromise(Promise.reject(new Error('boom')), (e) => (e as Error).message)
      expect(result.isErr).toBe(true)
      expect(result.error).toBe('boom')
    })
  })

  describe('rescue utility', () => {
    test('rescue returns value on success', () => {
      const result = rescue(() => 42, -1)
      expect(result).toBe(42)
    })

    test('rescue returns fallback on error', () => {
      const result = rescue(() => { throw new Error('fail') }, -1)
      expect(result).toBe(-1)
    })

    test('rescue handles async functions', async () => {
      const result = await rescue(async () => 'async-ok', 'fallback')
      expect(result).toBe('async-ok')
    })

    test('rescue handles async rejection', async () => {
      const result = await rescue(async () => { throw new Error('async-fail') }, 'fallback')
      expect(result).toBe('fallback')
    })

    test('rescue calls onError callback on failure', () => {
      let captured: Error | null = null
      rescue(() => { throw new Error('tracked') }, 0, (e) => { captured = e })
      expect(captured).not.toBeNull()
      expect(captured!.message).toBe('tracked')
    })
  })

  describe('Error middleware', () => {
    test('errorMiddleware returns handler function', () => {
      const mw = errorMiddleware({ isDevelopment: false })
      expect(typeof mw).toBe('function')
    })

    test('errorMiddleware handles HttpError with correct status', async () => {
      const mw = errorMiddleware({ isDevelopment: false })
      const request = new Request('https://example.com/api')
      const response = await mw(new HttpError(404, 'Not found'), request)
      expect(response.status).toBe(404)
    })

    test('errorMiddleware defaults to 500 for generic errors', async () => {
      const mw = errorMiddleware({ isDevelopment: false })
      const request = new Request('https://example.com/api')
      const response = await mw(new Error('generic'), request)
      expect(response.status).toBe(500)
    })
  })

  describe('renderHttpError helper', () => {
    test('renders error with request context', async () => {
      const request = new Request('https://example.com/test')
      const response = renderHttpError(new Error('test'), request, {
        status: 500,
        isDevelopment: true,
      })
      const html = await response.text()
      expect(html).toContain('test')
      expect(response.status).toBe(500)
    })

    test('renders without request', () => {
      const response = renderHttpError(new Error('no-req'), undefined, { status: 400 })
      expect(response.status).toBe(400)
    })
  })
})
