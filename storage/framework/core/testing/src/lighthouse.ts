import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'

export const lighthouseCategories = ['performance', 'accessibility', 'best-practices', 'seo'] as const
export type LighthouseCategory = typeof lighthouseCategories[number]
export type LighthouseDevice = 'mobile' | 'desktop'
export interface LighthouseFinding { id: string, title: string, value?: string }
export interface LighthousePerformanceLoss extends LighthouseFinding { pointsLost: number }
const lcpTraceLabels = {
  timeToFirstByte: 'first byte',
  resourceLoadDelay: 'resource discovery',
  resourceLoadDuration: 'resource download',
  elementRenderDelay: 'element render',
} as const
type LighthouseLcpPhase = keyof typeof lcpTraceLabels
export interface LighthouseResult {
  url: string
  finalUrl: string
  device: LighthouseDevice
  scores: Record<LighthouseCategory, number>
  minimum: number
  passed: boolean
  findings: LighthouseFinding[]
  metrics: Record<string, number>
  largestPerformanceLoss?: LighthousePerformanceLoss
  /** Observed trace timings, in milliseconds. */
  lcpTraceMs?: Partial<Record<LighthouseLcpPhase, number>>
  json: string
  html: string
}
export interface LighthouseOptions {
  urls: string[]
  outputDir: string
  device?: LighthouseDevice | 'both'
  minimum?: number
  timeoutMs?: number
  /** Port of an isolated, already authenticated Chrome instance. */
  chromePort?: number
  onResult?: (result: LighthouseResult) => void | Promise<void>
}
export type LighthouseRunner = (args: string[], timeoutMs: number) => Promise<{ code: number, stderr: string }>
export interface LighthouseCollectionFailure { url: string, device: LighthouseDevice, message: string }

export function basicAuditOrigin(base: string, targets: string[]): string {
  const url = new URL(pageUrl(base))
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !loopback) throw new TypeError('Basic auth audits require HTTPS or loopback')
  if (targets.some(target => new URL(target, base).origin !== url.origin))
    throw new TypeError('Basic auth audit URLs must all share --base origin')
  return url.origin
}

function pageUrl(value: string, base?: string): string {
  const url = new URL(value, base)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new TypeError('Audit URLs must use HTTP or HTTPS without embedded credentials')
  url.hash = ''
  return url.href
}

/** A sitemap supplies paths on the selected preview origin, not its production canonical host. */
export async function lighthouseTargets(options: { url?: string, sitemap?: string, base?: string }): Promise<string[]> {
  const base = options.base || 'http://localhost:3000'
  const values = String(options.url || '').split(',').map(value => value.trim()).filter(Boolean)
  if (options.sitemap) {
    const xml = await readFile(resolve(options.sitemap), 'utf8')
    const locations = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map(match => match[1]!.replaceAll('&amp;', '&'))
    if (!locations.length) throw new Error('The sitemap contains no page URLs')
    for (const location of locations) {
      const url = new URL(pageUrl(location))
      values.push(new URL(url.pathname + url.search, base).href)
    }
  }
  if (!values.length) throw new Error('Pass --url or --sitemap to select pages to audit')
  return [...new Set(values.map(value => pageUrl(value, base)))]
}

/** Missing or malformed categories must never produce a passing receipt. */
export function lighthouseScores(report: any): Record<LighthouseCategory, number> {
  if (report.runtimeError) throw new Error(`Lighthouse could not measure the page: ${report.runtimeError.message || report.runtimeError.code}`)
  return Object.fromEntries(lighthouseCategories.map((category) => {
    const value = report.categories?.[category]?.score
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1)
      throw new Error(`Lighthouse returned no valid ${category} score`)
    return [category, Math.round(value * 100)]
  })) as Record<LighthouseCategory, number>
}

/** Identify the measured metric with the largest penalty under Lighthouse's own weights. */
function largestPerformanceLoss(report: any): LighthousePerformanceLoss | undefined {
  const references = report.categories?.performance?.auditRefs
  if (!Array.isArray(references)) return undefined
  let totalWeight = 0
  let largest: LighthousePerformanceLoss | undefined
  for (const { id, weight } of references) {
    const audit = report.audits?.[id]
    const score = audit?.score
    if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(score) || score < 0 || score > 1) continue
    totalWeight += weight
    const loss = weight * (1 - score)
    if (loss > (largest?.pointsLost ?? 0))
      largest = { id, title: audit.title, value: audit.displayValue, pointsLost: loss }
  }
  if (largest) largest.pointsLost = 100 * largest.pointsLost / totalWeight
  return largest
}

function lcpTraceMs(report: any): LighthouseResult['lcpTraceMs'] {
  const phases = report.audits?.['lcp-breakdown-insight']?.details?.items?.[0]?.items
  if (!Array.isArray(phases)) return undefined

  const timings: NonNullable<LighthouseResult['lcpTraceMs']> = {}
  for (const phase of phases) {
    const name = phase?.subpart
    const duration = phase?.duration
    if (typeof name === 'string' && Object.hasOwn(lcpTraceLabels, name)
      && typeof duration === 'number' && Number.isFinite(duration) && duration >= 0)
      timings[name as LighthouseLcpPhase] = duration
  }
  return Object.keys(timings).length ? timings : undefined
}

const run: LighthouseRunner = async (args, timeoutMs) => {
  // The Lighthouse CLI is independent of the application's Bun preloads.
  const child = Bun.spawn(args, { cwd: tmpdir(), stdout: 'ignore', stderr: 'pipe', timeout: timeoutMs, killSignal: 'SIGTERM' })
  const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()])
  return { code, stderr }
}

/** Run the standard Lighthouse mobile/desktop profiles sequentially to avoid CPU contention. */
export async function auditLighthouse(options: LighthouseOptions, runner: LighthouseRunner = run): Promise<LighthouseResult[]> {
  const minimum = options.minimum ?? 100
  const device = options.device || 'both'
  if (!Number.isFinite(minimum) || minimum < 0 || minimum > 100) throw new TypeError('Minimum score must be between 0 and 100')
  if (!['mobile', 'desktop', 'both'].includes(device)) throw new TypeError('Choose mobile, desktop or both')
  if (!options.urls.length) throw new TypeError('Select at least one page to audit')
  const timeoutMs = options.timeoutMs ?? 120_000
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new TypeError('Lighthouse timeout must be a positive number')
  const urls = [...new Set(options.urls.map(url => pageUrl(url)))]
  const directory = resolve(options.outputDir)
  await mkdir(directory, { recursive: true })
  const devices: LighthouseDevice[] = device === 'both' ? ['mobile', 'desktop'] : [device]
  const results: LighthouseResult[] = []
  const failures: LighthouseCollectionFailure[] = []
  const summary = (status: 'running' | 'complete' | 'failed', error?: string) => writeFile(join(directory, 'summary.json'), `${JSON.stringify({ checkedAt: new Date().toISOString(), lighthouse: '13.6.0', minimum, status, error, failures, results }, null, 2)}\n`)
  await summary('running')
  try {
    for (const url of urls) {
      for (const formFactor of devices) {
        const label = `${new URL(url).hostname}${new URL(url).pathname}`.replace(/[^a-z0-9-]+/gi, '-').slice(0, 100)
        const hash = createHash('sha256').update(url).digest('hex').slice(0, 12)
        const output = join(directory, `${label}-${hash}-${formFactor}`)
        const args = [process.execPath, 'x', '--bun', 'lighthouse@13.6.0', url, '--quiet',
          '--chrome-flags=--headless=new --no-sandbox --use-mock-keychain',
          `--only-categories=${lighthouseCategories.join(',')}`, '--output=json', '--output=html', `--output-path=${output}`,
          ...(formFactor === 'desktop' ? ['--preset=desktop'] : []),
          ...(options.chromePort ? [`--port=${options.chromePort}`] : []),
        ]
        const json = `${output}.report.json`
        let report
        let scores
        try {
          const outcome = await runner(args, timeoutMs)
          if (outcome.code !== 0) throw new Error(outcome.stderr.trim() || `exit ${outcome.code}`)
          report = JSON.parse(await readFile(json, 'utf8'))
          scores = lighthouseScores(report)
        }
        catch (error) {
          failures.push({ url, device: formFactor, message: error instanceof Error ? error.message : String(error) })
          await summary('running')
          continue
        }
        const metrics: Record<string, number> = {}
        for (const id of ['first-contentful-paint', 'largest-contentful-paint', 'speed-index', 'total-blocking-time', 'cumulative-layout-shift']) {
          const value = report.audits?.[id]?.numericValue
          if (typeof value === 'number' && Number.isFinite(value)) metrics[id] = value
        }
        const result: LighthouseResult = {
          url, finalUrl: report.finalDisplayedUrl || report.finalUrl || url, device: formFactor, scores, minimum,
          passed: lighthouseCategories.every(category => scores[category] >= minimum),
          findings: Object.entries(report.audits || {}).filter(([, audit]) => (audit as any).score !== null && typeof (audit as any).score === 'number' && (audit as any).score < 1)
            .map(([id, audit]) => ({ id, title: (audit as any).title, value: (audit as any).displayValue })),
          metrics,
          largestPerformanceLoss: largestPerformanceLoss(report),
          lcpTraceMs: lcpTraceMs(report),
          json, html: `${output}.report.html`,
        }
        results.push(result)
        await summary('running')
        await options.onResult?.(result)
      }
    }
    if (failures.length) {
      const first = failures[0]!
      throw new Error(`Lighthouse failed to collect ${failures.length} profile(s). First failure on ${first.url} (${first.device}): ${first.message}`)
    }
    await summary('complete')
  }
  catch (error) {
    await summary('failed', error instanceof Error ? error.message : String(error))
    throw error
  }
  return results
}

export function formatLighthouseResult(result: LighthouseResult): string {
  const scores = lighthouseCategories.map(category => `${category} ${result.scores[category]}`).join(', ')
  const loss = result.scores.performance < result.minimum ? result.largestPerformanceLoss : undefined
  const detail = loss ? ` | ${loss.title}${loss.value ? ` ${loss.value}` : ''} cost ${loss.pointsLost.toFixed(2)} performance points` : ''
  const slowestPhase = loss?.id === 'largest-contentful-paint' && result.lcpTraceMs
    ? Object.entries(result.lcpTraceMs).sort((a, b) => b[1] - a[1])[0]
    : undefined
  const trace = slowestPhase ? ` | LCP trace ${lcpTraceLabels[slowestPhase[0] as LighthouseLcpPhase]} ${Math.round(slowestPhase[1])} ms` : ''
  return `${result.passed ? 'PASS' : 'FAIL'} ${result.device} ${result.url}: ${scores}${detail}${trace}`
}
