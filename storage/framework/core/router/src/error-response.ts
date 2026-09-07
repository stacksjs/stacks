import type { EnhancedRequest } from '@stacksjs/bun-router'

export interface ErrorResponseBody {
  error: string
  message: string
  status: number
  timestamp: string
  details?: Record<string, unknown>
}

export function buildErrorJson(opts: {
  error: string
  message: string
  status: number
  details?: Record<string, unknown>
}): string {
  const body: ErrorResponseBody = {
    error: opts.error,
    message: opts.message,
    status: opts.status,
    timestamp: new Date().toISOString(),
  }
  if (opts.details) body.details = opts.details
  return JSON.stringify(body)
}

export function getJsonHeaders(): Record<string, string> {
  // The router's post-response wrapper owns CORS so success and error paths
  // always use the same configured policy.
  return { 'Content-Type': 'application/json' }
}

export function getJsonHeadersFull(): Record<string, string> {
  return getJsonHeaders()
}

export function createValidationErrorResponse(
  errors: Record<string, string[]>,
  _request: Request | EnhancedRequest,
): Response {
  return new Response(
    buildErrorJson({
      error: 'ValidationError',
      message: 'Validation failed',
      status: 422,
      details: { errors },
    }),
    { status: 422, headers: getJsonHeaders() },
  )
}
