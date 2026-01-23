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
}

// HTTP error definitions
export const HTTP_ERRORS: Record<HttpStatusCode, HttpError> = {
  400: { status: 400, title: 'Bad Request', message: 'The request was malformed or invalid.' },
  401: { status: 401, title: 'Unauthorized', message: 'Authentication is required to access this resource.' },
  403: { status: 403, title: 'Forbidden', message: 'You do not have permission to access this resource.' },
  404: { status: 404, title: 'Not Found', message: 'The requested resource could not be found.' },
  405: { status: 405, title: 'Method Not Allowed', message: 'The request method is not supported for this resource.' },
  408: { status: 408, title: 'Request Timeout', message: 'The request took too long to complete.' },
  409: { status: 409, title: 'Conflict', message: 'The request conflicts with the current state of the resource.' },
  410: { status: 410, title: 'Gone', message: 'The requested resource is no longer available.' },
  422: { status: 422, title: 'Unprocessable Entity', message: 'The request was well-formed but could not be processed.' },
  429: { status: 429, title: 'Too Many Requests', message: 'You have exceeded the rate limit.' },
  500: { status: 500, title: 'Internal Server Error', message: 'An unexpected error occurred on the server.' },
  502: { status: 502, title: 'Bad Gateway', message: 'The server received an invalid response from an upstream server.' },
  503: { status: 503, title: 'Service Unavailable', message: 'The service is temporarily unavailable.' },
  504: { status: 504, title: 'Gateway Timeout', message: 'The upstream server did not respond in time.' },
}

// CSS for error pages
export const ERROR_PAGE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    line-height: 1.6;
    color: #1a1a2e;
    background: #f8f9fa;
  }
  .dark body { background: #1a1a2e; color: #e8e8e8; }
  .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
  .error-header {
    background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
    color: white;
    padding: 2rem;
    border-radius: 12px;
    margin-bottom: 1.5rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
  .error-title { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem; }
  .error-message { font-size: 1.1rem; opacity: 0.9; word-break: break-word; }
  .error-status { font-size: 0.875rem; opacity: 0.75; margin-top: 0.5rem; }
  .card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    margin-bottom: 1.5rem;
    overflow: hidden;
  }
  .dark .card { background: #252540; }
  .card-header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #e9ecef;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .dark .card-header { border-bottom-color: #3a3a5a; }
  .card-body { padding: 1.5rem; }
  .stack-frame {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #e9ecef;
    cursor: pointer;
    transition: background 0.2s;
  }
  .stack-frame:hover { background: #f8f9fa; }
  .dark .stack-frame:hover { background: #1a1a2e; }
  .stack-frame:last-child { border-bottom: none; }
  .stack-frame.expanded { background: #f8f9fa; }
  .dark .stack-frame.expanded { background: #1a1a2e; }
  .frame-file { font-family: 'Monaco', 'Menlo', monospace; font-size: 0.875rem; color: #6c757d; }
  .frame-function { font-weight: 500; color: #495057; }
  .dark .frame-function { color: #e8e8e8; }
  .frame-line { color: #dc3545; font-weight: 600; }
  .code-snippet {
    background: #282c34;
    color: #abb2bf;
    padding: 1rem;
    margin-top: 0.5rem;
    border-radius: 8px;
    overflow-x: auto;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.8125rem;
    line-height: 1.8;
  }
  .code-line { display: flex; }
  .code-line-number {
    width: 3rem;
    text-align: right;
    padding-right: 1rem;
    color: #636d83;
    user-select: none;
  }
  .code-line-content { flex: 1; }
  .code-line.highlight { background: rgba(220, 53, 69, 0.2); }
  .code-line.highlight .code-line-number { color: #dc3545; }
  .info-table { width: 100%; border-collapse: collapse; }
  .info-table td { padding: 0.75rem 0; border-bottom: 1px solid #e9ecef; }
  .dark .info-table td { border-bottom-color: #3a3a5a; }
  .info-table td:first-child { font-weight: 500; width: 30%; color: #6c757d; }
  .info-table tr:last-child td { border-bottom: none; }
  .query-item {
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 8px;
    margin-bottom: 0.75rem;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.8125rem;
  }
  .dark .query-item { background: #1a1a2e; }
  .query-time { color: #6c757d; font-size: 0.75rem; margin-top: 0.5rem; }
  .badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
  }
  .badge-method { background: #e7f5ff; color: #1971c2; }
  .dark .badge-method { background: #1971c2; color: white; }
  .production-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    text-align: center;
    padding: 2rem;
  }
  .production-status { font-size: 6rem; font-weight: 700; color: #dee2e6; margin-bottom: 1rem; }
  .production-title { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem; }
  .production-message { color: #6c757d; margin-bottom: 2rem; }
  .production-link { color: #0d6efd; text-decoration: none; }
  .production-link:hover { text-decoration: underline; }
  @media (prefers-color-scheme: dark) {
    .auto body { background: #1a1a2e; color: #e8e8e8; }
    .auto .card { background: #252540; }
    .auto .card-header { border-bottom-color: #3a3a5a; }
    .auto .stack-frame:hover { background: #1a1a2e; }
    .auto .stack-frame.expanded { background: #1a1a2e; }
    .auto .frame-function { color: #e8e8e8; }
    .auto .info-table td { border-bottom-color: #3a3a5a; }
    .auto .query-item { background: #1a1a2e; }
    .auto .badge-method { background: #1971c2; color: white; }
  }
`

/**
 * Parse stack trace into frames
 */
function parseStackTrace(stack: string | undefined, basePaths?: string[]): StackFrame[] {
  if (!stack) return []

  const lines = stack.split('\n').slice(1) // Skip the error message line
  const frames: StackFrame[] = []

  for (const line of lines) {
    const match = line.match(/^\s*at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/)
    if (match) {
      let file = match[2]
      // Shorten file path if base paths provided
      if (basePaths) {
        for (const basePath of basePaths) {
          if (file.startsWith(basePath)) {
            file = file.slice(basePath.length + 1)
            break
          }
        }
      }
      frames.push({
        function: match[1] || '<anonymous>',
        file,
        line: parseInt(match[3], 10),
        column: parseInt(match[4], 10),
      })
    }
  }

  return frames
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Render a simple production error page
 */
export function renderProductionErrorPage(status: number): string {
  const httpError = HTTP_ERRORS[status as HttpStatusCode] || {
    status,
    title: 'Error',
    message: 'An unexpected error occurred.',
  }

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
  render(error: Error, status: number = 500): string {
    const frames = parseStackTrace(error.stack, this.config.basePaths)
    const themeClass = this.config.theme || 'auto'

    return `<!DOCTYPE html>
<html lang="en" class="${themeClass}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${status} - ${escapeHtml(error.name || 'Error')}</title>
  <style>${ERROR_PAGE_CSS}</style>
</head>
<body>
  <div class="container">
    <div class="error-header">
      <div class="error-title">${escapeHtml(error.name || 'Error')}</div>
      <div class="error-message">${escapeHtml(error.message)}</div>
      <div class="error-status">${status} • ${this.framework ? `${this.framework.name}${this.framework.version ? ` v${this.framework.version}` : ''}` : 'Application'}</div>
    </div>

    ${frames.length > 0 ? `
    <div class="card">
      <div class="card-header">📚 Stack Trace</div>
      ${frames.map((frame, i) => `
        <div class="stack-frame" onclick="this.classList.toggle('expanded')">
          <div class="frame-function">${escapeHtml(frame.function || '<anonymous>')}</div>
          <div class="frame-file">
            ${escapeHtml(frame.file)}:<span class="frame-line">${frame.line}</span>${frame.column ? `:${frame.column}` : ''}
          </div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${this.config.showRequest && this.request ? `
    <div class="card">
      <div class="card-header">🌐 Request</div>
      <div class="card-body">
        <table class="info-table">
          <tr>
            <td>Method</td>
            <td><span class="badge badge-method">${escapeHtml(this.request.method)}</span></td>
          </tr>
          <tr>
            <td>URL</td>
            <td>${escapeHtml(this.request.url)}</td>
          </tr>
          ${this.request.queryParams && Object.keys(this.request.queryParams).length > 0 ? `
          <tr>
            <td>Query Params</td>
            <td><code>${escapeHtml(JSON.stringify(this.request.queryParams, null, 2))}</code></td>
          </tr>
          ` : ''}
          ${this.request.body ? `
          <tr>
            <td>Body</td>
            <td><code>${escapeHtml(JSON.stringify(this.request.body, null, 2))}</code></td>
          </tr>
          ` : ''}
        </table>
      </div>
    </div>
    ` : ''}

    ${this.routing ? `
    <div class="card">
      <div class="card-header">🛤️ Routing</div>
      <div class="card-body">
        <table class="info-table">
          ${this.routing.controller ? `<tr><td>Controller</td><td>${escapeHtml(this.routing.controller)}</td></tr>` : ''}
          ${this.routing.routeName ? `<tr><td>Route Name</td><td>${escapeHtml(this.routing.routeName)}</td></tr>` : ''}
          ${this.routing.middleware?.length ? `<tr><td>Middleware</td><td>${this.routing.middleware.map(m => escapeHtml(m)).join(', ')}</td></tr>` : ''}
        </table>
      </div>
    </div>
    ` : ''}

    ${this.user ? `
    <div class="card">
      <div class="card-header">👤 User</div>
      <div class="card-body">
        <table class="info-table">
          ${this.user.id ? `<tr><td>ID</td><td>${escapeHtml(String(this.user.id))}</td></tr>` : ''}
          ${this.user.email ? `<tr><td>Email</td><td>${escapeHtml(this.user.email)}</td></tr>` : ''}
          ${this.user.name ? `<tr><td>Name</td><td>${escapeHtml(this.user.name)}</td></tr>` : ''}
        </table>
      </div>
    </div>
    ` : ''}

    ${this.config.showQueries && this.queries.length > 0 ? `
    <div class="card">
      <div class="card-header">🗄️ Queries (${this.queries.length})</div>
      <div class="card-body">
        ${this.queries.map(q => `
          <div class="query-item">
            ${escapeHtml(q.query)}
            ${q.time !== undefined ? `<div class="query-time">${q.time.toFixed(2)}ms${q.connection ? ` • ${escapeHtml(q.connection)}` : ''}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    ${this.config.showEnvironment ? `
    <div class="card">
      <div class="card-header">⚙️ Environment</div>
      <div class="card-body">
        <table class="info-table">
          <tr><td>Node Version</td><td>${typeof process !== 'undefined' ? process.version : 'N/A'}</td></tr>
          <tr><td>Platform</td><td>${typeof process !== 'undefined' ? process.platform : 'N/A'}</td></tr>
          <tr><td>Architecture</td><td>${typeof process !== 'undefined' ? process.arch : 'N/A'}</td></tr>
        </table>
      </div>
    </div>
    ` : ''}
  </div>
</body>
</html>`
  }

  /**
   * Handle error and return Response
   */
  handleError(error: Error, status: number = 500): Response {
    const html = this.render(error, status)
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
export function renderErrorPage(error: Error, status: number = 500, config?: ErrorPageConfig): string {
  const handler = createErrorHandler(config)
  return handler.render(error, status)
}

/**
 * Render error (alias)
 */
export function renderError(error: Error, status: number = 500): string {
  return renderErrorPage(error, status)
}

/**
 * Create an error response
 */
export function errorResponse(error: Error, status: number = 500, config?: ErrorPageConfig): Response {
  const handler = createErrorHandler(config)
  return handler.handleError(error, status)
}
