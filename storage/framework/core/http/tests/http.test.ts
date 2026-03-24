import { describe, expect, it } from 'bun:test'
import { Response } from '../src/index'

describe('@stacksjs/http Response enum', () => {
  describe('2xx Success codes', () => {
    it('HTTP_OK is 200', () => {
      expect(Response.HTTP_OK).toBe(200)
    })

    it('HTTP_CREATED is 201', () => {
      expect(Response.HTTP_CREATED).toBe(201)
    })

    it('HTTP_NO_CONTENT is 204', () => {
      expect(Response.HTTP_NO_CONTENT).toBe(204)
    })
  })

  describe('3xx Redirection codes', () => {
    it('HTTP_MOVED_PERMANENTLY is 301', () => {
      expect(Response.HTTP_MOVED_PERMANENTLY).toBe(301)
    })

    it('HTTP_FOUND is 302', () => {
      expect(Response.HTTP_FOUND).toBe(302)
    })

    it('HTTP_NOT_MODIFIED is 304', () => {
      expect(Response.HTTP_NOT_MODIFIED).toBe(304)
    })
  })

  describe('4xx Client Error codes', () => {
    it('HTTP_BAD_REQUEST is 400', () => {
      expect(Response.HTTP_BAD_REQUEST).toBe(400)
    })

    it('HTTP_UNAUTHORIZED is 401', () => {
      expect(Response.HTTP_UNAUTHORIZED).toBe(401)
    })

    it('HTTP_FORBIDDEN is 403', () => {
      expect(Response.HTTP_FORBIDDEN).toBe(403)
    })

    it('HTTP_NOT_FOUND is 404', () => {
      expect(Response.HTTP_NOT_FOUND).toBe(404)
    })

    it('HTTP_UNPROCESSABLE_ENTITY is 422', () => {
      expect(Response.HTTP_UNPROCESSABLE_ENTITY).toBe(422)
    })

    it('HTTP_TOO_MANY_REQUESTS is 429', () => {
      expect(Response.HTTP_TOO_MANY_REQUESTS).toBe(429)
    })
  })

  describe('5xx Server Error codes', () => {
    it('HTTP_INTERNAL_SERVER_ERROR is 500', () => {
      expect(Response.HTTP_INTERNAL_SERVER_ERROR).toBe(500)
    })

    it('HTTP_SERVICE_UNAVAILABLE is 503', () => {
      expect(Response.HTTP_SERVICE_UNAVAILABLE).toBe(503)
    })
  })

  describe('Reverse lookup (numeric enum)', () => {
    it('200 maps back to HTTP_OK', () => {
      expect(Response[200]).toBe('HTTP_OK')
    })

    it('404 maps back to HTTP_NOT_FOUND', () => {
      expect(Response[404]).toBe('HTTP_NOT_FOUND')
    })

    it('500 maps back to HTTP_INTERNAL_SERVER_ERROR', () => {
      expect(Response[500]).toBe('HTTP_INTERNAL_SERVER_ERROR')
    })
  })

  describe('Less common status codes', () => {
    it('HTTP_CONTINUE is 100', () => {
      expect(Response.HTTP_CONTINUE).toBe(100)
    })

    it('HTTP_I_AM_A_TEAPOT is 418', () => {
      expect(Response.HTTP_I_AM_A_TEAPOT).toBe(418)
    })

    it('HTTP_GATEWAY_TIMEOUT is 504', () => {
      expect(Response.HTTP_GATEWAY_TIMEOUT).toBe(504)
    })
  })
})
