import type { Request, ResponseStatus } from '@stacksjs/router'
import { response } from '@stacksjs/router'
import { log } from '@stacksjs/logging'
/**
 * Base Controller class providing Laravel-like functionality
 */
export class Controller {
  /**
   * Create a JSON response
   */
  protected json(data: unknown, status: ResponseStatus = 200): Response {
    return response.json(data, status)
  }

  /**
   * Return a successful response
   */
  protected success(data: unknown): Response {
    return this.json(data, 200)
  }

  /**
   * Return a created response
   */
  protected created(data: unknown): Response {
    return this.json(data, 201)
  }

  /**
   * Return a no content response
   */
  protected noContent(): any {
    return response.noContent()
  }

  /**
   * Return an error response
   */
  protected error(message: string, status: ResponseStatus = 500): Response {
    return this.json({ error: message }, status)
  }

  /**
   * Return a not found response
   */
  protected notFound(message: string = 'Resource not found'): Response {
    return this.error(message, 404)
  }

  /**
   * Return an unauthorized response
   */
  protected unauthorized(message: string = 'Unauthorized'): Response {
    return this.error(message, 401)
  }

  /**
   * Return a forbidden response
   */
  protected forbidden(message: string = 'Forbidden'): Response {
    return this.error(message, 403)
  }

  /**
   * Validate request data
   */
  /*
   * Validate the request against `rules`.
   *
   * Three things were wrong here, and a local `type Request = any` at the top
   * of this file kept all of them quiet. The parameter was that alias, so it
   * accepted anything; `request.validate` is async, and its result was neither
   * awaited nor returned; and the body caught synchronously and then always
   * resolved, so a validation failure was logged and reported as success.
   */
  protected async validate(request: Request, rules: Record<string, unknown>): Promise<void> {
    if (typeof request.validate !== 'function')
      throw new TypeError('This request does not carry the validation macro.')

    const result = await request.validate(rules)

    log.info('Validation result:', result)
  }
}
