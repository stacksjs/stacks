/**
 * Error Page Rendering - Ignition-style error pages
 *
 * Provides beautiful development error pages with full stack traces,
 * database queries, and request context.
 */

// Types
export interface ErrorPageConfig {
  appName?: string
  theme?: 'light' | 'dark' | 'auto'
  showEnvironment?: boolean
  showQueries?: boolean
  showRequest?: boolean
  enableCopyMarkdown?: boolean
  snippetLines?: number
  basePaths?: string[]
  /**
   * Show frames from `@stacksjs/*` packages. Default: `false` — the
   * dev page hides framework internals so user code is visible at the
   * top of the trace. Toggle on when debugging the framework itself.
   */
  showFrameworkFrames?: boolean
}

export interface RequestContext {
  method: string
  url: string
  headers: Record<string, string>
  queryParams?: Record<string, string>
  body?: unknown
}

export interface RoutingContext {
  controller?: string
  routeName?: string
  middleware?: string[]
}

export interface UserContext {
  id?: string | number
  email?: string
  name?: string
}

export interface QueryInfo {
  query: string
  time?: number
  connection?: string
}

export interface StackFrame {
  file: string
  line: number
  column?: number
  function?: string
  code?: string
}

export interface CodeSnippet {
  file: string
  line: number
  code: string[]
  highlight: number
}

export interface EnvironmentContext {
  nodeVersion?: string
  platform?: string
  arch?: string
  env?: Record<string, string>
}

export interface JobContext {
  name?: string
  queue?: string
  attempts?: number
}

export interface ErrorPageData {
  error: Error
  status: number
  stack: StackFrame[]
  request?: RequestContext
  routing?: RoutingContext
  user?: UserContext
  queries?: QueryInfo[]
  environment?: EnvironmentContext
  job?: JobContext
  framework?: { name: string, version?: string }
}

export type HttpStatusCode = 400 | 401 | 403 | 404 | 405 | 408 | 409 | 410 | 422 | 429 | 500 | 502 | 503 | 504

export interface HttpError {
  status: HttpStatusCode
  title: string
  message: string
  /** Link to documentation explaining this error and how to resolve it */
  docLink?: string
  /** Likely root causes a developer can scan to recognize their bug */
  commonCauses?: string[]
  /** Concrete next step the developer can try */
  suggestion?: string
}

const DOCS_BASE = 'https://stacksjs.org/docs/errors'

// HTTP error definitions. Each entry includes a doc link, likely causes,
// and a concrete suggestion so the dev-mode error page reads like a hint
// instead of just "something went wrong".
export const HTTP_ERRORS: Record<HttpStatusCode, HttpError> = {
  400: {
    status: 400,
    title: 'Bad Request',
    message: 'The request was malformed or invalid.',
    docLink: `${DOCS_BASE}/400`,
    commonCauses: [
      'JSON body is missing or has a syntax error',
      'A required field is absent from the payload',
      'Content-Type header does not match the body format',
    ],
    suggestion: 'Inspect the request body and Content-Type — most 400s come from malformed JSON or a missing required field.',
  },
  401: {
    status: 401,
    title: 'Unauthorized',
    message: 'Authentication is required to access this resource.',
    docLink: `${DOCS_BASE}/401`,
    commonCauses: [
      'No Authorization header was sent',
      'The bearer token expired',
      'The session cookie was cleared',
    ],
    suggestion: 'Confirm a valid `Authorization: Bearer <token>` header is sent and the token has not expired.',
  },
  403: {
    status: 403,
    title: 'Forbidden',
    message: 'You do not have permission to access this resource.',
    docLink: `${DOCS_BASE}/403`,
    commonCauses: [
      'The authenticated user lacks the required ability or role',
      'A Gate or policy denied access (see app/Gates.ts)',
      'The token was issued without the needed ability',
    ],
    suggestion: 'Check Gates / policies and the abilities encoded in the access token.',
  },
  404: {
    status: 404,
    title: 'Not Found',
    message: 'The requested resource could not be found.',
    docLink: `${DOCS_BASE}/404`,
    commonCauses: [
      'The route is not registered in app/Routes.ts',
      'A typo in the URL path',
      'A model lookup returned no row (ModelNotFoundError)',
    ],
    suggestion: 'Run `buddy route:list` to see registered routes, or verify the model exists with the given id.',
  },
  405: {
    status: 405,
    title: 'Method Not Allowed',
    message: 'The request method is not supported for this resource.',
    docLink: `${DOCS_BASE}/405`,
    commonCauses: [
      'The route is registered for a different HTTP method',
      'A form posted GET when the route expects POST',
    ],
    suggestion: 'Confirm the HTTP method in `app/Routes.ts` matches what the client sent.',
  },
  408: {
    status: 408,
    title: 'Request Timeout',
    message: 'The request took too long to complete.',
    docLink: `${DOCS_BASE}/408`,
    commonCauses: [
      'A long-running query or external API call exceeded the timeout',
      'The client uploaded a slow body that stalled',
    ],
    suggestion: 'Move slow work into a queued job, or raise the route timeout if the work is genuinely long.',
  },
  409: {
    status: 409,
    title: 'Conflict',
    message: 'The request conflicts with the current state of the resource.',
    docLink: `${DOCS_BASE}/409`,
    commonCauses: [
      'A unique-constraint violation (duplicate email, slug, etc.)',
      'Optimistic locking detected a stale write',
    ],
    suggestion: 'Re-fetch the resource and retry, or surface the conflict to the user.',
  },
  410: {
    status: 410,
    title: 'Gone',
    message: 'The requested resource is no longer available.',
    docLink: `${DOCS_BASE}/410`,
    commonCauses: ['The resource was permanently deleted', 'A signed URL expired'],
    suggestion: 'Issue a fresh signed URL or fall back to the canonical resource.',
  },
  422: {
    status: 422,
    title: 'Unprocessable Entity',
    message: 'The request was well-formed but could not be processed.',
    docLink: `${DOCS_BASE}/422`,
    commonCauses: [
      'Validation rules from the action / model rejected the payload',
      'A field value is outside the allowed range or shape',
    ],
    suggestion: 'Inspect `errors` in the response body — each key maps to a failing field.',
  },
  429: {
    status: 429,
    title: 'Too Many Requests',
    message: 'You have exceeded the rate limit.',
    docLink: `${DOCS_BASE}/429`,
    commonCauses: ['Rate-limit middleware tripped on this IP / token', 'A retry loop is hammering the endpoint'],
    suggestion: 'Honor the `Retry-After` response header and back off before retrying.',
  },
  500: {
    status: 500,
    title: 'Internal Server Error',
    message: 'An unexpected error occurred on the server.',
    docLink: `${DOCS_BASE}/500`,
    commonCauses: [
      'An unhandled exception in an action or middleware',
      'A failing database connection or migration',
      'A misconfigured environment variable',
    ],
    suggestion: 'Check server logs for the original stack trace — the error page above shows the throw site in dev.',
  },
  502: {
    status: 502,
    title: 'Bad Gateway',
    message: 'The server received an invalid response from an upstream server.',
    docLink: `${DOCS_BASE}/502`,
    commonCauses: ['An upstream HTTP API returned a malformed response', 'A reverse proxy could not reach the origin'],
    suggestion: 'Verify the upstream service is healthy and returning the expected content type.',
  },
  503: {
    status: 503,
    title: 'Service Unavailable',
    message: 'The service is temporarily unavailable.',
    docLink: `${DOCS_BASE}/503`,
    commonCauses: ['Maintenance mode is enabled', 'A health check is failing', 'A dependency (db, redis, queue) is down'],
    suggestion: 'Run `buddy doctor` and check dependent services.',
  },
  504: {
    status: 504,
    title: 'Gateway Timeout',
    message: 'The upstream server did not respond in time.',
    docLink: `${DOCS_BASE}/504`,
    commonCauses: ['An upstream HTTP call exceeded its deadline', 'A long-running database query timed out'],
    suggestion: 'Move the work to a queued job or raise the upstream timeout if the latency is expected.',
  },
}

import {
  buildErrorMarkdown,
  escapeHtml,
  renderExceptionTrace,
  wrapErrorPage,
  type ParsedFrame,
} from './error-page-template'
import { ERROR_PAGE_CSS } from './error-page-styles'

export { ERROR_PAGE_CSS }

/**
 * Parse stack trace into frames
 */
/**
 * Path fragments that mark a stack frame as framework-internal. Frames
 * matching any of these are filtered out by default so user-facing errors
 * point at user code instead of buried in @stacksjs/* plumbing. The set
 * is intentionally conservative — anything in `app/`, `routes/`,
 * `config/`, or user-authored files is left alone.
 */
const FRAMEWORK_FRAME_FRAGMENTS: readonly string[] = [
  '/storage/framework/core/',
  '/node_modules/@stacksjs/',
  'node:internal/',
  'bun:wrap',
]

export function isFrameworkFrame(file: string): boolean {
  if (!file) return false
  return FRAMEWORK_FRAME_FRAGMENTS.some(f => file.includes(f))
}

function parseStackTrace(stack: string | undefined, basePaths?: string[], options: { includeFrameworkFrames?: boolean } = {}): ParsedFrame[] {
  if (!stack) return []

  const lines = stack.split('\n').slice(1) // Skip the error message line
  const frames: ParsedFrame[] = []
  const includeAll = options.includeFrameworkFrames === true

  for (const line of lines) {
    const match = line.match(/^\s*at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/)
    if (match) {
      let file = match[2]
      if (file === undefined) continue
      const original = file
      const isFramework = isFrameworkFrame(original)
      // Shorten file path if base paths provided
      if (basePaths) {
        for (const basePath of basePaths) {
          if (file.startsWith(basePath)) {
            file = file.slice(basePath.length + 1)
            break
          }
        }
      }
      if (!includeAll && isFramework) continue
      frames.push({
        function: match[1] || '<anonymous>',
        file,
        absoluteFile: original,
        isFramework,
        line: parseInt(match[3] ?? '0', 10),
        column: parseInt(match[4] ?? '0', 10),
      })
    }
  }

  // If filtering removed *every* frame (rare — error from framework code
  // with no userland callers in the stack), fall back to the unfiltered
  // list so the user still sees something. Otherwise the developer gets
  // a stack-trace card with zero entries.
  if (!includeAll && frames.length === 0) {
    return parseStackTrace(stack, basePaths, { includeFrameworkFrames: true })
  }

  return frames
}

/**
 * Try to load a userland override for a production error page from
 * `resources/views/errors/`. Resolution order:
 *
 *   1. `resources/views/errors/<status>.html`     (e.g., `404.html`)
 *   2. `resources/views/errors/error.html`        (generic fallback)
 *
 * Returns `null` if neither file exists (caller falls back to the
 * built-in template). Read failures (permission denied, decode error,
 * etc.) also return `null` rather than throwing — a broken custom
 * template should never break error rendering itself.
 *
 * Template variables (all HTML-escaped):
 *   - `{{status}}`  e.g. 404
 *   - `{{title}}`   e.g. "Not Found"
 *   - `{{message}}` e.g. "The requested resource could not be found."
 *
 * stacksjs/stacks#863.
 */
function loadCustomErrorPage(status: number, title: string, message: string): string | null {
  // Lazy-require so a missing/unloadable @stacksjs/path module (e.g.,
  // when error-handling is consumed outside a Stacks app) doesn't break
  // built-in error rendering. eslint-disable-next-line over the require.
  let resourcesPath: ((_sub?: string) => string) | undefined
  try {
    // eslint-disable-next-line ts/no-require-imports
    const mod = require('@stacksjs/path') as { path?: { resourcesPath?: (_sub?: string) => string }, resourcesPath?: (_sub?: string) => string }
    resourcesPath = mod.resourcesPath ?? mod.path?.resourcesPath
  }
  catch { /* path module unavailable — fall through to built-in */ }
  if (!resourcesPath) return null

  // eslint-disable-next-line ts/no-require-imports
  const fs = require('node:fs') as typeof import('node:fs')

  const candidates = [
    resourcesPath(`views/errors/${status}.html`),
    resourcesPath('views/errors/error.html'),
  ]

  for (const filePath of candidates) {
    try {
      if (!fs.existsSync(filePath)) continue
      const template = fs.readFileSync(filePath, 'utf-8')
      return template
        .replace(/\{\{\s*status\s*\}\}/g, escapeHtml(String(status)))
        .replace(/\{\{\s*title\s*\}\}/g, escapeHtml(title))
        .replace(/\{\{\s*message\s*\}\}/g, escapeHtml(message))
    }
    catch { /* unreadable file — try the next candidate */ }
  }

  return null
}

/**
 * Render a simple production error page.
 *
 * Checks for a userland override at `resources/views/errors/<status>.html`
 * (or `error.html` as a generic fallback) first; renders the built-in
 * template only when no custom page is provided. stacksjs/stacks#863.
 */
export function renderProductionErrorPage(status: number): string {
  const httpError = HTTP_ERRORS[status as HttpStatusCode] || {
    status,
    title: 'Error',
    message: 'An unexpected error occurred.',
  }

  const custom = loadCustomErrorPage(httpError.status, httpError.title, httpError.message)
  if (custom !== null) return custom

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${httpError.status} - ${httpError.title}</title>
  <style>${ERROR_PAGE_CSS}</style>
</head>
<body>
  <div class="production-page">
    <div class="production-status">${httpError.status}</div>
    <h1 class="production-title">${escapeHtml(httpError.title)}</h1>
    <p class="production-message">${escapeHtml(httpError.message)}</p>
    <a href="/" class="production-link">← Back to Home</a>
  </div>
</body>
</html>`
}

/**
 * Render the contextual hint block (common causes, suggestion, doc link)
 * for a given HTTP status. Returns an empty string for statuses without
 * enriched data so the dev page degrades gracefully.
 */
export function renderHttpErrorHints(status: number): string {
  const info = HTTP_ERRORS[status as HttpStatusCode]
  if (!info) return ''
  const hasCauses = Array.isArray(info.commonCauses) && info.commonCauses.length > 0
  const hasSuggestion = typeof info.suggestion === 'string' && info.suggestion.length > 0
  const hasDoc = typeof info.docLink === 'string' && info.docLink.length > 0
  if (!hasCauses && !hasSuggestion && !hasDoc) return ''

  const causes = hasCauses
    ? `<ul class="error-hint-causes">${info.commonCauses!
      .map(c => `<li>${escapeHtml(c)}</li>`)
      .join('')}</ul>`
    : ''
  const suggestion = hasSuggestion ? `<p class="error-hint-suggestion">${escapeHtml(info.suggestion!)}</p>` : ''
  const doc = hasDoc
    ? `<a class="text-blue-600 text-sm dark:text-blue-500 hover:underline" href="${escapeHtml(info.docLink!)}" target="_blank" rel="noreferrer noopener">Read the docs →</a>`
    : ''

  return `<section class="p-4 bg-amber-200/30 dark:bg-amber-950/40 border border-amber-200 rounded-xl dark:border-amber-800 shadow-xs">
  <div class="mb-2 font-semibold text-amber-900 text-sm dark:text-amber-300">Likely causes &amp; next steps</div>
  <div class="text-neutral-700 text-sm dark:text-neutral-300">${causes}${suggestion}${doc}</div>
</section>`
}

/**
 * Error Page Handler class
 */
export class ErrorPageHandler {
  private config: ErrorPageConfig
  private framework?: { name: string, version?: string }
  private request?: RequestContext
  private routing?: RoutingContext
  private user?: UserContext
  private queries: QueryInfo[] = []

  constructor(config?: ErrorPageConfig) {
    this.config = {
      appName: 'App',
      theme: 'auto',
      showEnvironment: true,
      showQueries: true,
      showRequest: true,
      enableCopyMarkdown: true,
      snippetLines: 8,
      ...config,
    }
  }

  setFramework(name: string, version?: string): this {
    this.framework = { name, version }
    return this
  }

  setRequest(request: Request | RequestContext): this {
    if (request instanceof Request) {
      const url = new URL(request.url)
      this.request = {
        method: request.method,
        url: request.url,
        headers: Object.fromEntries(request.headers.entries()),
        queryParams: Object.fromEntries(url.searchParams.entries()),
      }
    } else {
      this.request = request
    }
    return this
  }

  setRouting(routing: RoutingContext): this {
    this.routing = routing
    return this
  }

  setUser(user: UserContext): this {
    this.user = user
    return this
  }

  addQuery(query: string, time?: number, connection?: string): this {
    this.queries.push({ query, time, connection })
    return this
  }

  /**
   * Render error to HTML string
   */
  async render(error: Error, status: number = 500): Promise<string> {
    try {
      const { renderDevErrorPage } = await import('./error-page-renderer')
      return await renderDevErrorPage({
        error,
        status,
        config: this.config,
        framework: this.framework,
        request: this.request,
        routing: this.routing,
        user: this.user,
        queries: this.queries,
      })
    }
    catch (renderError) {
      console.error('[ErrorPageHandler] STX render failed, using fallback:', renderError)
      return this.renderFallback(error, status)
    }
  }

  /** Legacy inline fallback when STX/Crosswind rendering is unavailable. */
  private renderFallback(error: Error, status: number): string {
    const frames = parseStackTrace(error.stack, this.config.basePaths, {
      includeFrameworkFrames: this.config.showFrameworkFrames === true,
    })
    const httpInfo = HTTP_ERRORS[status as HttpStatusCode]
    const statusTitle = httpInfo?.title ?? 'Error'
    const topFrame = frames[0]

    const body = `
    <header class="header"><div class="header-title"><span class="header-dot"></span><span>${escapeHtml(statusTitle)}</span></div></header>
    <section class="summary">
      <h1>${escapeHtml(error.name || 'Error')}</h1>
      ${topFrame ? `<div class="summary-file">${escapeHtml(topFrame.file)}:${topFrame.line}</div>` : ''}
      <p class="summary-message">${escapeHtml(error.message)}</p>
    </section>
    ${renderHttpErrorHints(status)}
    ${renderExceptionTrace(frames, this.config.snippetLines ?? 8)}
    `

    const markdown = buildErrorMarkdown({
      statusTitle,
      errorName: error.name || 'Error',
      errorMessage: error.message,
      status,
      file: topFrame?.file,
      line: topFrame?.line,
      request: this.request,
      framework: this.framework,
      frames,
    })

    return wrapErrorPage(body, markdown)
  }

  /**
   * Handle error and return Response
   */
  async handleError(error: Error, status: number = 500): Promise<Response> {
    const html = await this.render(error, status)
    return new Response(html, {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
}

/**
 * Create an error handler instance
 */
export function createErrorHandler(config?: ErrorPageConfig): ErrorPageHandler {
  return new ErrorPageHandler(config)
}

/**
 * Render an error page (alias)
 */
export async function renderErrorPage(error: Error, status: number = 500, config?: ErrorPageConfig): Promise<string> {
  const handler = createErrorHandler(config)
  return handler.render(error, status)
}

/**
 * Render error (alias)
 */
export async function renderError(error: Error, status: number = 500): Promise<string> {
  return renderErrorPage(error, status)
}

/**
 * Create an error response
 */
export async function errorResponse(error: Error, status: number = 500, config?: ErrorPageConfig): Promise<Response> {
  const handler = createErrorHandler(config)
  return handler.handleError(error, status)
}
