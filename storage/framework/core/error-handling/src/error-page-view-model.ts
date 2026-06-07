import type {
  ErrorPageConfig,
  HttpStatusCode,
  QueryInfo,
  RequestContext,
  RoutingContext,
  UserContext,
} from './error-page'
import { HTTP_ERRORS as HTTP_ERROR_MAP, isFrameworkFrame, renderHttpErrorHints } from './error-page'
import { highlightSnippet, languageForFile } from './error-page-highlighter'
import { buildErrorMarkdown, escapeHtml, readCodeSnippet, type ParsedFrame } from './error-page-template'

export interface FrameViewModel {
  function: string
  file: string
  line: number
  expanded: boolean
  hasCode: boolean
  codeHtml: string
  isVendor: boolean
}

export interface TraceGroupViewModel {
  type: 'frame' | 'vendor'
  frames: FrameViewModel[]
  vendorCount: number
}

export interface KeyValueRow {
  key: string
  value: string
}

export interface ErrorPageViewModel {
  pageTitle: string
  statusTitle: string
  markdownJson: string
  exceptionClass: string
  message: string
  fileLine: string
  statusCode: number
  errorCode: string
  frameworkLabel: string
  frameworkVersion: string
  runtimeLabel: string
  runtimeVersion: string
  requestMethod: string
  requestUrl: string
  hasRequest: boolean
  hintsHtml: string
  traceGroups: TraceGroupViewModel[]
  queries: Array<{ connection: string, sql: string, sqlHtml: string, time: string }>
  queryCount: number
  headers: KeyValueRow[]
  bodyContent: string
  routing: KeyValueRow[]
  routeParamsJson: string
  userRows: KeyValueRow[]
  environmentRows: KeyValueRow[]
  hasUser: boolean
  hasEnvironment: boolean
  hasQueries: boolean
  hasHeaders: boolean
  hasBody: boolean
  hasRouting: boolean
  hasRouteParams: boolean
  highlightCss: string
  enableCopyMarkdown: boolean
}

function parseStackTrace(stack: string | undefined, basePaths?: string[], options: { includeFrameworkFrames?: boolean } = {}): ParsedFrame[] {
  if (!stack) return []

  const lines = stack.split('\n').slice(1)
  const frames: ParsedFrame[] = []
  const includeAll = options.includeFrameworkFrames === true

  for (const line of lines) {
    const match = line.match(/^\s*at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/)
    if (match) {
      let file = match[2]
      if (file === undefined) continue
      const original = file
      const isFramework = isFrameworkFrame(original)
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

  if (!includeAll && frames.length === 0) {
    return parseStackTrace(stack, basePaths, { includeFrameworkFrames: true })
  }

  return frames
}

function groupFrames(frames: ParsedFrame[]): Array<ParsedFrame | ParsedFrame[]> {
  const groups: Array<ParsedFrame | ParsedFrame[]> = []
  let vendorBatch: ParsedFrame[] = []

  const flushVendor = () => {
    if (vendorBatch.length > 0) {
      groups.push(vendorBatch.length === 1 ? vendorBatch[0]! : [...vendorBatch])
      vendorBatch = []
    }
  }

  for (const frame of frames) {
    if (frame.isFramework) {
      vendorBatch.push(frame)
    }
    else {
      flushVendor()
      groups.push(frame)
    }
  }
  flushVendor()
  return groups
}

async function buildFrameView(frame: ParsedFrame, index: number, snippetLines: number): Promise<FrameViewModel> {
  const snippet = readCodeSnippet(frame.absoluteFile, frame.line, snippetLines)
  let codeHtml = ''
  if (snippet) {
    const code = snippet.lines.map(l => l.content).join('\n')
    const startingLine = snippet.lines[0]?.number ?? frame.line
    const highlighted = await highlightSnippet(code, frame.file, frame.line, startingLine)
    codeHtml = highlighted.html
  }

  return {
    function: frame.function || '<anonymous>',
    file: frame.file,
    line: frame.line,
    expanded: index === 0,
    hasCode: codeHtml.length > 0,
    codeHtml,
    isVendor: frame.isFramework,
  }
}

export async function buildErrorPageViewModel(opts: {
  error: Error
  status: number
  config: ErrorPageConfig
  framework?: { name: string, version?: string }
  request?: RequestContext
  routing?: RoutingContext
  user?: UserContext
  queries?: QueryInfo[]
}): Promise<ErrorPageViewModel> {
  const { error, status, config } = opts
  const httpInfo = HTTP_ERROR_MAP[status as HttpStatusCode]
  const statusTitle = httpInfo?.title ?? 'Error'
  const frames = parseStackTrace(error.stack, config.basePaths, {
    includeFrameworkFrames: config.showFrameworkFrames === true,
  })
  const topFrame = frames[0]
  const runtimeVersion = typeof process !== 'undefined' ? process.version.replace(/^v/, '') : ''
  const runtimeLabel = typeof process !== 'undefined' && process.versions.bun ? 'BUN' : 'NODE'
  const errorCode = (error as Error & { code?: string | number }).code

  const traceGroups: TraceGroupViewModel[] = []
  let frameIndex = 0
  for (const group of groupFrames(frames)) {
    if (Array.isArray(group)) {
      const vendorFrames = await Promise.all(
        group.map((f, i) => buildFrameView(f, frameIndex + i, config.snippetLines ?? 8)),
      )
      traceGroups.push({ type: 'vendor', frames: vendorFrames, vendorCount: vendorFrames.length })
      frameIndex += vendorFrames.length
    }
    else {
      traceGroups.push({
        type: 'frame',
        frames: [await buildFrameView(group, frameIndex, config.snippetLines ?? 8)],
        vendorCount: 0,
      })
      frameIndex += 1
    }
  }

  const headers: KeyValueRow[] = opts.request
    ? Object.entries(opts.request.headers).map(([key, value]) => ({ key, value }))
    : []

  const routing: KeyValueRow[] = []
  if (opts.routing?.controller) routing.push({ key: 'controller', value: opts.routing.controller })
  if (opts.routing?.routeName) routing.push({ key: 'route name', value: opts.routing.routeName })
  if (opts.routing?.middleware?.length) {
    routing.push({ key: 'middleware', value: opts.routing.middleware.join(', ') })
  }

  const userRows: KeyValueRow[] = []
  if (opts.user?.id !== undefined) userRows.push({ key: 'id', value: String(opts.user.id) })
  if (opts.user?.email) userRows.push({ key: 'email', value: opts.user.email })
  if (opts.user?.name) userRows.push({ key: 'name', value: opts.user.name })

  const environmentRows: KeyValueRow[] = config.showEnvironment && typeof process !== 'undefined'
    ? [
        { key: 'runtime', value: process.version },
        { key: 'platform', value: process.platform },
        { key: 'arch', value: process.arch },
      ]
    : []

  const queries = (opts.queries ?? []).slice(0, 100).map(q => ({
    connection: q.connection ?? 'default',
    sql: q.query,
    sqlHtml: escapeHtml(q.query),
    time: q.time !== undefined ? q.time.toFixed(2) : '0.00',
  }))

  const bodyContent = opts.request?.body
    ? JSON.stringify(opts.request.body, null, 2)
    : '// No request body'

  const routeParamsJson = opts.request?.queryParams && Object.keys(opts.request.queryParams).length > 0
    ? JSON.stringify(opts.request.queryParams, null, 2)
    : ''

  const markdown = buildErrorMarkdown({
    statusTitle,
    errorName: error.name || 'Error',
    errorMessage: error.message,
    status,
    file: topFrame?.file,
    line: topFrame?.line,
    request: opts.request,
    framework: opts.framework,
    frames,
  })

  const { getSharedHighlighterCss } = await import('./error-page-highlighter')

  return {
    pageTitle: statusTitle,
    statusTitle,
    markdownJson: JSON.stringify(markdown),
    exceptionClass: error.name || 'Error',
    message: error.message,
    fileLine: topFrame ? `${topFrame.file}:${topFrame.line}` : '',
    statusCode: status,
    errorCode: errorCode !== undefined ? String(errorCode) : '0',
    frameworkLabel: opts.framework?.name?.toUpperCase() ?? 'STACKS',
    frameworkVersion: opts.framework?.version ?? '',
    runtimeLabel,
    runtimeVersion,
    requestMethod: opts.request?.method ?? 'GET',
    requestUrl: opts.request?.url ?? '',
    hasRequest: !!opts.request,
    hintsHtml: renderHttpErrorHints(status),
    traceGroups,
    queries,
    queryCount: queries.length,
    headers,
    bodyContent,
    routing,
    routeParamsJson,
    userRows,
    environmentRows,
    hasUser: userRows.length > 0,
    hasEnvironment: environmentRows.length > 0,
    hasQueries: queries.length > 0 && config.showQueries !== false,
    hasHeaders: headers.length > 0 && config.showRequest !== false,
    hasBody: config.showRequest !== false,
    hasRouting: routing.length > 0,
    hasRouteParams: routeParamsJson.length > 0,
    highlightCss: getSharedHighlighterCss(),
    enableCopyMarkdown: config.enableCopyMarkdown !== false,
  }
}

// Re-export for tests
export { parseStackTrace, groupFrames, languageForFile }
