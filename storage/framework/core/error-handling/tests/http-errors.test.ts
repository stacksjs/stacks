import { describe, expect, it } from 'bun:test'
import { HttpError, HttpErrorHandler, createHttpErrorHandler, renderHttpError, errorMiddleware } from '../src/http'

describe('HttpError', () => {
  it('should construct with status and message', () => {
    const error = new HttpError(404, 'Not Found')
    expect(error.status).toBe(404)
    expect(error.message).toBe('Not Found')
  })

  it('should set name to the HTTP status name', () => {
    // HttpError maps status → standard name via httpStatusName():
    // 500 → "Internal Server Error", 404 → "Not Found", etc.
    // The previous "Server Error!" expectation was a pre-mapping
    // placeholder that drifted from the actual constructor.
    expect(new HttpError(500, 'oops').name).toBe('Internal Server Error')
    expect(new HttpError(404, 'oops').name).toBe('Not Found')
    expect(new HttpError(400, 'oops').name).toBe('Bad Request')
  })

  it('should extend Error', () => {
    const error = new HttpError(400, 'Bad Request')
    expect(error).toBeInstanceOf(Error)
  })

  it('should have a stack trace', () => {
    const error = new HttpError(500, 'test')
    expect(error.stack).toBeDefined()
  })

  it('should preserve custom messages', () => {
    const error = new HttpError(422, 'Validation failed for field email')
    expect(error.message).toBe('Validation failed for field email')
    expect(error.status).toBe(422)
  })
})

describe('HttpErrorHandler', () => {
  describe('factory methods', () => {
    it('badRequest returns a 400 response', async () => {
      const handler = new HttpErrorHandler({ isDevelopment: false })
      const response = await handler.badRequest()
      expect(response.status).toBe(400)
    })

    it('unauthorized returns a 401 response', async () => {
      const handler = new HttpErrorHandler({ isDevelopment: false })
      const response = await handler.unauthorized()
      expect(response.status).toBe(401)
    })

    it('forbidden returns a 403 response', async () => {
      const handler = new HttpErrorHandler({ isDevelopment: false })
      const response = await handler.forbidden()
      expect(response.status).toBe(403)
    })

    it('notFound returns a 404 response', async () => {
      const handler = new HttpErrorHandler({ isDevelopment: false })
      const response = await handler.notFound()
      expect(response.status).toBe(404)
    })

    it('validationError returns a 422 response', async () => {
      const handler = new HttpErrorHandler({ isDevelopment: false })
      const response = await handler.validationError()
      expect(response.status).toBe(422)
    })

    it('tooManyRequests returns a 429 response', async () => {
      const handler = new HttpErrorHandler({ isDevelopment: false })
      const response = await handler.tooManyRequests()
      expect(response.status).toBe(429)
    })

    it('serverError returns a 500 response', async () => {
      const handler = new HttpErrorHandler({ isDevelopment: false })
      const response = await handler.serverError(new Error('boom'))
      expect(response.status).toBe(500)
    })

    it('serviceUnavailable returns a 503 response', async () => {
      const handler = new HttpErrorHandler({ isDevelopment: false })
      const response = await handler.serviceUnavailable()
      expect(response.status).toBe(503)
    })
  })

  describe('custom error messages', () => {
    it('badRequest accepts a custom message', async () => {
      const handler = new HttpErrorHandler({ isDevelopment: false })
      const response = await handler.badRequest('Invalid JSON payload')
      expect(response.status).toBe(400)
      const body = await response.text()
      expect(body).toContain('400')
    })

    it('notFound accepts a custom message', async () => {
      const handler = new HttpErrorHandler({ isDevelopment: false })
      const response = await handler.notFound('Page does not exist')
      expect(response.status).toBe(404)
    })

    it('forbidden accepts a custom message', async () => {
      const handler = new HttpErrorHandler({ isDevelopment: false })
      const response = await handler.forbidden('Admin access required')
      expect(response.status).toBe(403)
    })
  })

  describe('development vs production mode', () => {
    it('production mode returns simple HTML page', async () => {
      const handler = new HttpErrorHandler({ isDevelopment: false })
      const response = await handler.notFound()
      const body = await response.text()
      expect(body).toContain('404')
      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
    })

    it('development mode returns detailed error page', async () => {
      const handler = new HttpErrorHandler({ isDevelopment: true })
      const response = await handler.notFound('Missing resource')
      const body = await response.text()
      // The real error page handler renders a full HTML page with the error message
      expect(body).toContain('Missing resource')
    })

    it('handle defaults to status 500 when no status provided', async () => {
      const handler = new HttpErrorHandler({ isDevelopment: false })
      const response = await handler.handle(new Error('unexpected'))
      expect(response.status).toBe(500)
    })
  })
})

describe('createHttpErrorHandler', () => {
  it('returns an HttpErrorHandler instance', () => {
    const handler = createHttpErrorHandler()
    expect(handler).toBeInstanceOf(HttpErrorHandler)
  })
})
