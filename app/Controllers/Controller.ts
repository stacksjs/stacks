import type { ResponseData } from '@stacksjs/types'
import { response } from '@stacksjs/router'

/**
 * Base Controller class providing Laravel-like functionality
 */
export class BaseController {
  /**
   * Create a JSON response
   */
  protected json(data: any, status: number = 200): ResponseData {
    return response.json(data, status)
  }

  /**
   * Return a successful response
   */
  protected success(data: any): ResponseData {
    return this.json(data, 200)
  }

  /**
   * Return a created response
   */
  protected created(data: any): ResponseData {
    return this.json(data, 201)
  }

  /**
   * Return a no content response
   */
  protected noContent(): ResponseData {
    return {
      status: 204,
      headers: {},
      body: ''
    }
  }

  /**
   * Return an error response
   */
  protected error(message: string, status: number = 500): ResponseData {
    return this.json({ error: message }, status)
  }

  /**
   * Return a not found response
   */
  protected notFound(message: string = 'Resource not found'): ResponseData {
    return this.error(message, 404)
  }

  /**
   * Return an unauthorized response
   */
  protected unauthorized(message: string = 'Unauthorized'): ResponseData {
    return this.error(message, 401)
  }

  /**
   * Return a forbidden response
   */
  protected forbidden(message: string = 'Forbidden'): ResponseData {
    return this.error(message, 403)
  }
}