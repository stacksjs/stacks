/** Reproducible documentation screenshots, using Bun's native browser view. */
import { createHash } from 'node:crypto'
import { lstat, mkdir, mkdtemp, readFile, rename, rm, stat } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { discoverScreenshotModels, screenshotFixturePath, type ScreenshotFixtures, type ScreenshotModelOptions, type ScreenshotModelPlan } from './screenshot-models'
export { discoverScreenshotModels, planScreenshotModels, screenshotFixturePath } from './screenshot-models'
export type { ScreenshotFixtures, ScreenshotModel, ScreenshotModelOptions, ScreenshotModelPlan } from './screenshot-models'
import { spawnOwnedProcess } from '@stacksjs/cli/owned-process'
import { version as generatorVersion } from '../package.json'

export interface ScreenshotViewport { name: string, width: number, height: number }
export interface ScreenshotContext {
  view: Bun.WebView
  baseUrl: string
  profile: string
  viewport: ScreenshotViewport
  page: ScreenshotPage & { path: string }
  httpStatus?: number
}
export interface ScreenshotPathContext { fixtures: ScreenshotFixtures, models: ScreenshotModelPlan, profile: string }
export interface ScreenshotPage {
  /** Stable filename, independent of route parameters and translated titles. */
  id: string
  title: string
  path: string | ((context: ScreenshotPathContext) => string | Promise<string>)
  /** Route pattern for an asynchronous fixture-resolved path, without record secrets. */
  route?: string
  /** Explain what the reader sees and what decision this screen supports. */
  description: string
  reason?: string
  /** Bind dynamic route parameters from this model's synthetic fixture. */
  model?: string
  /** Project-relative template paths covered by this screen. */
  sources?: string[]
  profiles?: string[]
  waitFor: string
  /** Intentional HTTP error screens must name their expected status. */
  expectedStatus?: number
  /** Run after navigation, before readiness and masking. */
  prepare?: (context: ScreenshotContext) => Promise<void>
  /** Application-specific readiness, e.g. data loaded instead of a skeleton. */
  ready?: (context: ScreenshotContext) => Promise<boolean>
  masks?: string[]
  /** A deliberate exclusion remains visible in the inventory. */
  skip?: string
}
export interface ScreenshotConfig {
  baseUrl: string
  outDir: string
  pages: ScreenshotPage[]
  viewports?: ScreenshotViewport[]
  /** Each profile runs in its own process, including Chrome's cookie store. */
  profiles?: Record<string, { prepare?: (context: ScreenshotContext) => Promise<void> }>
  backend?: 'webkit' | 'chrome'
  /** Refuse captures when the browser cannot report the document HTTP status. */
  requireHttpStatus?: boolean
  timeoutMs?: number
  /** Additional source/version files whose changes require recapture. */
  inputs?: string[]
  /** Optional template coverage. Every .stx needs a page or an explanation. */
  coverage?: { directories: string[], exclude?: Record<string, string> }
  /** Secret env values to redact if an application hook throws. */
  redactEnv?: string[]
  /** Own app models are discovered by default; framework defaults are opt-in. */
  models?: ScreenshotModelOptions | false
  fixtures?: ScreenshotFixtures
  /** Trusted fixture adapter; invoked only during capture, never list/check. */
  data?: {
    prepare: (plan: ScreenshotModelPlan) => Promise<ScreenshotFixtures>
    cleanup?: () => Promise<void>
  }
}
export interface ScreenshotResult {
  id: string
  profile: string
  viewport: ScreenshotViewport
  title: string
  description: string
  reason?: string
  path: string
  status: 'captured' | 'failed' | 'skipped'
  httpStatus?: number
  file?: string
  sha256?: string
  error?: string
}
export interface ScreenshotReport {
  format: 1
  generator: '@stacksjs/docs/screenshots'
  generatorVersion: string
  configHash: string
  backend: string
  bun: string
  results: ScreenshotResult[]
  models: ScreenshotModelPlan
  inventory: Array<{ id: string, title: string, path: string, sources: string[], skip?: string }>
}
export interface ScreenshotOptions {
  config?: string
  root?: string
  outDir?: string
  only?: string[]
  viewports?: string[]
  list?: boolean
  check?: boolean
  onProgress?: (result: ScreenshotResult) => void
}
export const defineScreenshotConfig = (config: ScreenshotConfig): ScreenshotConfig => config
const defaults: ScreenshotViewport[] = [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]
const hash = (bytes: string | Uint8Array): string => createHash('sha256').update(bytes).digest('hex')
const safeName = (value: string): boolean => /^[a-z0-9][a-z0-9._-]*$/i.test(value) && !value.endsWith('.') && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value)
const cleanPath = (value: string): string => { const url = new URL(value); return url.origin + url.pathname }

export async function validateScreenshotConfig(config: ScreenshotConfig, root = process.cwd()): Promise<void> {
  const base = new URL(config.baseUrl)
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash)
    throw new Error('baseUrl must be an http(s) URL without credentials, query or fragment')
  if (!config.outDir || !config.pages.length) throw new Error('outDir and at least one page are required')
  if (config.timeoutMs !== undefined && (!Number.isFinite(config.timeoutMs) || config.timeoutMs < 100 || config.timeoutMs > 120_000))
    throw new Error('timeoutMs must be between 100 and 120000')
  if (config.backend && !['webkit', 'chrome'].includes(config.backend)) throw new Error('backend must be webkit or chrome')
  if (config.requireHttpStatus !== undefined && typeof config.requireHttpStatus !== 'boolean') throw new Error('requireHttpStatus must be a boolean')
  const profiles = Object.keys(config.profiles ?? { default: {} })
  if (!profiles.length || profiles.some(name => !safeName(name))) throw new Error('Profile names must be safe filenames')
  const ids = new Set<string>()
  const covered = new Set<string>()
  for (const page of config.pages) {
    if (!safeName(page.id) || ids.has(page.id)) throw new Error(`Duplicate or invalid screen id: ${page.id}`)
    ids.add(page.id)
    if (page.expectedStatus !== undefined && (!Number.isInteger(page.expectedStatus) || page.expectedStatus < 100 || page.expectedStatus > 599)) throw new Error(`Invalid expected HTTP status for ${page.id}`)
    if (!page.title.trim() || !page.description.trim() || !page.waitFor.trim()) throw new Error(`Screen ${page.id} needs title, description and waitFor`)
    if (typeof page.path !== 'string' && (typeof page.path !== 'function' || !page.route)) throw new Error(`Screen ${page.id} needs a route pattern for its path resolver`)
    const target = new URL(typeof page.path === 'string' ? page.path : page.route!, base)
    if (target.origin !== base.origin || target.username || target.password) throw new Error(`Screen ${page.id} must stay on baseUrl's origin`)
    if (page.profiles?.some(name => !profiles.includes(name)) || page.profiles?.length === 0) throw new Error(`Unknown or empty profiles for ${page.id}`)
    for (const source of page.sources ?? []) {
      const absolute = resolve(root, source)
      if (relative(root, absolute).startsWith('..') || isAbsolute(source)) throw new Error(`Source must be inside the project: ${source}`)
      await readFile(absolute)
      covered.add(relative(root, absolute).replaceAll('\\', '/'))
    }
  }
  const viewportNames = new Set<string>()
  for (const viewport of config.viewports ?? defaults) {
    if (!safeName(viewport.name) || viewportNames.has(viewport.name) || ![viewport.width, viewport.height].every(value => Number.isInteger(value) && value >= 200 && value <= 7680))
      throw new Error('Viewports need unique safe names and integer dimensions from 200 to 7680')
    viewportNames.add(viewport.name)
  }
  if (!viewportNames.size) throw new Error('At least one viewport is required')
  for (const input of config.inputs ?? []) await readFile(resolve(root, input))
  const missing: string[] = []
  const found = new Set<string>()
  for (const directory of config.coverage?.directories ?? []) {
    const absolute = resolve(root, directory)
    if (relative(root, absolute).startsWith('..')) throw new Error('Coverage directories must be inside the project')
    if (!(await stat(absolute)).isDirectory()) throw new Error(`Missing coverage directory: ${directory}`)
    let count = 0
    for await (const entry of new Bun.Glob('**/*.stx').scan({ cwd: absolute, onlyFiles: true })) {
      count++
      const source = relative(root, join(absolute, entry)).replaceAll('\\', '/')
      found.add(source)
      if (!covered.has(source) && !config.coverage?.exclude?.[source]?.trim()) missing.push(source)
    }
    if (!count) throw new Error(`No .stx screens found in ${directory}`)
  }
  for (const [source, reason] of Object.entries(config.coverage?.exclude ?? {})) {
    if (!reason.trim() || !found.has(source)) throw new Error(`Stale or unexplained coverage exclusion: ${source}`)
  }
  if (missing.length) throw new Error(`Undocumented screens:\n${missing.sort().join('\n')}`)
}

async function load(configFile: string): Promise<ScreenshotConfig> {
  const config = (await import(pathToFileURL(configFile).href)).default as ScreenshotConfig
  if (!config || typeof config !== 'object') throw new Error('Screenshot configuration must have a default export')
  return config
}
async function until(read: () => Promise<boolean>, timeout: number): Promise<void> {
  const end = Date.now() + timeout
  while (!await read()) {
    if (Date.now() >= end) throw new Error('The screen did not become ready before its deadline')
    await Bun.sleep(100)
  }
}
function redacted(error: unknown, config: ScreenshotConfig): string {
  let text = error instanceof Error ? error.message : 'Screenshot capture failed'
  for (const name of config.redactEnv ?? []) {
    const secret = process.env[name]
    if (secret) text = text.replaceAll(secret, '[redacted]')
  }
  return text.slice(0, 1000)
}

// One profile per process: native Chrome shares its process-wide cookie store
// between WebViews. A tab per role would silently leak the previous role's login.
async function captureProfile(configFile: string, profile: string, options: ScreenshotOptions & { staging: string }): Promise<ScreenshotResult[]> {
  const config = await load(configFile)
  const root = resolve(options.root!)
  const output = resolve(root, options.outDir ?? config.outDir)
  const results: ScreenshotResult[] = []
  const models = await discoverScreenshotModels(root, config.models)
  try {
  const fixtures = { ...config.fixtures, ...await config.data?.prepare(models) }
  const backend = config.backend ?? (process.platform === 'darwin' ? 'webkit' : 'chrome')
  const timeout = config.timeoutMs ?? 30_000
  for (const viewport of config.viewports ?? defaults) {
    if (options.viewports?.length && !options.viewports.includes(viewport.name)) continue
    for (const page of config.pages) {
      if (options.only?.length && !options.only.includes(page.id)) continue
      if (!(page.profiles ?? Object.keys(config.profiles ?? { default: {} })).includes(profile)) continue
      const result: ScreenshotResult = { id: page.id, profile, viewport, title: page.title, description: page.description, ...(page.reason ? { reason: page.reason } : {}), path: new URL(typeof page.path === 'string' ? page.path : page.route!, config.baseUrl).pathname, status: 'failed' }
      results.push(result)
      if (page.skip) { result.status = 'skipped'; result.error = page.skip; process.send?.({ type: 'screenshot-result', result }); continue }
      let phase = 'starting the browser'
      let view: Bun.WebView | undefined
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        if (typeof Bun.WebView !== 'function') throw new Error('This Bun has no WebView. Upgrade Bun before capturing screens.')
        view = new Bun.WebView({ width: viewport.width, height: viewport.height, backend: backend === 'chrome' ? { type: 'chrome', url: false, argv: process.env.CI ? ['--no-sandbox', '--disable-dev-shm-usage'] : [] } : 'webkit' })
        await Promise.race([
          (async () => {
            const path = typeof page.path === 'function' ? await page.path({ fixtures, models, profile }) : screenshotFixturePath(page.path, page.model, fixtures, models)
            const target = new URL(path, config.baseUrl)
            if (target.origin !== new URL(config.baseUrl).origin || target.username || target.password) throw new Error('Resolved screenshot path must stay on the configured origin')
            const concrete = { ...page, path }
            const context: ScreenshotContext = { view: view!, baseUrl: config.baseUrl, profile, viewport, page: concrete }
            result.path = target.pathname
            phase = 'preparing the review profile'
            await config.profiles?.[profile]?.prepare?.(context)
            phase = 'opening the screen'
            await view!.navigate(new URL(concrete.path, config.baseUrl).href)
            phase = 'checking the document HTTP status'
            const httpStatus = Number(await view!.evaluate(`performance.getEntriesByType('navigation')[0]?.responseStatus || 0`))
            if (Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599) {
              context.httpStatus = result.httpStatus = httpStatus
            }
            if (!context.httpStatus && (config.requireHttpStatus || page.expectedStatus !== undefined)) throw new Error('The browser did not expose a document HTTP status; choose the chrome backend for HTTP-verified captures')
            if (page.expectedStatus !== undefined ? context.httpStatus !== page.expectedStatus : httpStatus >= 400) throw new Error(`The screen returned HTTP ${httpStatus}${page.expectedStatus !== undefined ? ` instead of ${page.expectedStatus}` : '; check its route, access and fixture'}`)
            phase = 'preparing the screen state'
            await page.prepare?.(context)
            phase = 'waiting for screen readiness'
            await until(async () => Boolean(await view!.evaluate(`Boolean(document.querySelector(${JSON.stringify(page.waitFor)}))`)) && (!page.ready || await page.ready(context)), timeout)
            const actual = String(await view!.evaluate('location.href'))
            if (cleanPath(actual) !== cleanPath(new URL(concrete.path, config.baseUrl).href)) throw new Error('The screen redirected to a different route; check its login and fixture')
            phase = 'loading fonts and visible images'
            await view!.evaluate(`(async () => {
              const style = document.createElement('style'); style.textContent = '*{animation:none!important;transition:none!important;scroll-behavior:auto!important;caret-color:transparent!important}'; document.head.append(style);
              for (const selector of ${JSON.stringify(['input[type="password"]', ...(page.masks ?? [])])}) for (const node of document.querySelectorAll(selector)) node.style.setProperty('visibility','hidden','important');
              await document.fonts.ready;
              for (const image of document.images) { const box=image.getBoundingClientRect(); if(box.bottom>0 && box.top<innerHeight && !image.complete) await new Promise(resolve=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true})}); }
              await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
            })()`)
            const broken = await view!.evaluate<boolean>('[...document.images].some(image=>{const r=image.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight&&image.complete&&image.naturalWidth===0})')
            if (broken) throw new Error('A visible image failed to load')
            phase = 'saving the screenshot'
            const picture = new Uint8Array(await (await view!.screenshot()).arrayBuffer())
            const file = `${page.id}/${profile}-${viewport.name}.png`
            const destination = join(output, file)
            await mkdir(dirname(destination), { recursive: true })
            const staged = join(options.staging, `${page.id}-${profile}-${viewport.name}.png`)
            await Bun.write(staged, picture)
            await rename(staged, destination)
            result.file = file
            result.sha256 = hash(picture)
            result.status = 'captured'
          })(),
          new Promise<never>((_, reject) => { timer = setTimeout(() => { view?.close(); reject(new Error('Screenshot deadline exceeded')) }, timeout) }),
        ])
      }
      catch (error) { result.error = `${phase}: ${redacted(error, config)}` }
      finally { if (timer) clearTimeout(timer); view?.close(); process.send?.({ type: 'screenshot-result', result }) }
    }
  }
  return results
  } finally { await config.data?.cleanup?.() }
}

/** Capture the explicit inventory; failures remain in the report and fail CI. */
export async function captureScreenshots(options: ScreenshotOptions = {}): Promise<ScreenshotReport> {
  if (options.list && options.check) throw new Error('Choose list or check, not both')
  const root = resolve(options.root ?? process.cwd())
  const configFile = resolve(root, options.config ?? 'config/screenshots.ts')
  const config = await load(configFile)
  await validateScreenshotConfig(config, root)
  for (const id of options.only ?? []) if (!config.pages.some(page => page.id === id)) throw new Error(`Unknown screen: ${id}`)
  for (const name of options.viewports ?? []) if (!(config.viewports ?? defaults).some(viewport => viewport.name === name)) throw new Error(`Unknown viewport: ${name}`)
  const output = resolve(root, options.outDir ?? config.outDir)
  const inputs = [...new Set([...(config.inputs ?? []), ...config.pages.flatMap(page => page.sources ?? [])])].sort()
  const report: ScreenshotReport = { format: 1, generator: '@stacksjs/docs/screenshots', generatorVersion, models: await discoverScreenshotModels(root, config.models), configHash: hash(Buffer.concat([Buffer.from(generatorVersion), await readFile(configFile), ...await Promise.all(inputs.map(file => readFile(resolve(root, file))))])), inventory: config.pages.map(page => ({ id: page.id, title: page.title, path: new URL(typeof page.path === 'string' ? page.path : page.route!, config.baseUrl).pathname, sources: page.sources ?? [], ...(page.skip ? { skip: page.skip } : {}) })), backend: config.backend ?? (process.platform === 'darwin' ? 'webkit' : 'chrome'), bun: Bun.version, results: [] }
  if (options.list) return report
  if (options.check) {
    const existing = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8')) as ScreenshotReport
    if (existing.generator !== '@stacksjs/docs/screenshots') throw new Error('This is not a Stacks screenshot manifest')
    if (existing.generatorVersion !== generatorVersion || existing.configHash !== report.configHash || existing.models?.sourceHash !== report.models.sourceHash || existing.results.some(result => result.status === 'failed')) throw new Error('Screenshot SDK or inventory changed, or the previous capture failed; capture again')
    for (const page of config.pages) {
      for (const profile of page.profiles ?? Object.keys(config.profiles ?? { default: {} })) {
        for (const viewport of config.viewports ?? defaults) {
          const result = existing.results.find(item => item.id === page.id && item.profile === profile && item.viewport.name === viewport.name)
          if (!result || (!page.skip && result.status !== 'captured')) throw new Error(`Missing screenshot: ${page.id}/${profile}-${viewport.name}`)
          if (result.file && (relative(output, resolve(output, result.file)).split(/[\\/]/)[0] === '..' || isAbsolute(relative(output, resolve(output, result.file))) || hash(await readFile(join(output, result.file))) !== result.sha256)) throw new Error(`Screenshot bytes changed: ${page.id}`)
        }
      }
    }
    return existing
  }
  let previous: ScreenshotReport | undefined
  try {
    const file = join(output, 'manifest.json')
    if ((await lstat(file)).isSymbolicLink()) throw new Error('Screenshot manifest must not be a symlink')
    previous = JSON.parse(await readFile(file, 'utf8')) as ScreenshotReport
    if (previous.generator !== '@stacksjs/docs/screenshots') throw new Error('Refusing to overwrite an unowned manifest')
    if ((options.only?.length || options.viewports?.length) && previous.configHash !== report.configHash) throw new Error('Capture inputs or SDK changed; use a fresh output directory or run a complete capture before updating individual screens')
  }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  const owned = new Set(previous?.results.map(result => result.file).filter(Boolean))
  for (const page of config.pages) {
    const directory = join(output, page.id)
    try { if ((await lstat(directory)).isSymbolicLink()) throw new Error(`Screenshot directory is a symlink: ${page.id}`) }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    for (const profile of page.profiles ?? Object.keys(config.profiles ?? { default: {} })) for (const viewport of config.viewports ?? defaults) {
      const file = `${page.id}/${profile}-${viewport.name}.png`
      try {
        const info = await lstat(join(output, file))
        if (info.isSymbolicLink() || !owned.has(file)) throw new Error(`Refusing to overwrite an unowned screenshot: ${file}`)
      }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    }
  }
  for (const name of ['gallery.md', 'manifest.json.tmp']) {
    try {
      const info = await lstat(join(output, name))
      if (info.isSymbolicLink() || !previous) throw new Error(`Refusing to overwrite an unowned screenshot artifact: ${name}`)
    }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  }
  await mkdir(output, { recursive: true })
  const temporary = await mkdtemp(join(output, '.stacks-screenshots-'))
  await Bun.write(join(temporary, 'bunfig.toml'), 'preload = []\n')
  try {
    for (const profile of Object.keys(config.profiles ?? { default: {} })) {
      const resultFile = join(temporary, `${profile}.json`)
      const selected = config.pages.filter(page => (!options.only?.length || options.only.includes(page.id)) && (page.profiles ?? Object.keys(config.profiles ?? { default: {} })).includes(profile))
      const count = selected.length * (config.viewports ?? defaults).filter(viewport => !options.viewports?.length || options.viewports.includes(viewport.name)).length
      if (!count) continue
      const runtime = import.meta.path.startsWith('/$bunfs/') ? Bun.which('bun') : process.execPath
      if (!runtime) throw new Error('An installed Bun is required for screenshot workers')
      const entry = import.meta.path.startsWith('/$bunfs/') ? Bun.resolveSync('@stacksjs/docs/screenshots', root) : import.meta.path
      // Bun's Chrome backend creates a profile under the worker's temp root.
      // Keep it with the rest of this capture so it is retired after the worker exits.
      const workerTemp = await mkdtemp(join(temporary, 'browser-'))
      const env = { ...process.env, TMPDIR: workerTemp, TMP: workerTemp, TEMP: workerTemp }
      const worker = spawnOwnedProcess([runtime, '--no-env-file', `--config=${join(temporary, 'bunfig.toml')}`, entry, '--worker', configFile, profile, JSON.stringify({ ...options, root, staging: temporary }), resultFile], { ownerRuntime: runtime, cwd: root, env, stdin: 'ignore', stdout: 'ignore', stderr: 'ignore', ipc: (message) => {
        const progress = message as { type?: string, result?: ScreenshotResult }
        if (progress?.type === 'screenshot-result' && progress.result) options.onProgress?.(progress.result)
      } })
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        const code = await Promise.race([worker.exited, new Promise<never>((_, reject) => { timer = setTimeout(() => { void worker.stop(); reject(new Error(`Screenshot worker timed out for ${profile}`)) }, count * ((config.timeoutMs ?? 30_000) + 2000) + 30_000) })])
        if (code.code !== 0) throw new Error(`Screenshot worker failed for ${profile}`)
        report.results.push(...JSON.parse(await readFile(resultFile, 'utf8')) as ScreenshotResult[])
      }
      catch (error) {
        for (const page of selected) for (const viewport of config.viewports ?? defaults) {
          if (options.viewports?.length && !options.viewports.includes(viewport.name)) continue
          report.results.push({ id: page.id, profile, viewport, title: page.title, description: page.description, path: new URL(typeof page.path === 'string' ? page.path : page.route!, config.baseUrl).pathname, status: 'failed', error: redacted(error, config) })
        }
      }
      finally { if (timer) clearTimeout(timer); await worker.stop() }
    }
    if (options.only?.length || options.viewports?.length) {
      try {
        const previous = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8')) as ScreenshotReport
        if (previous.configHash === report.configHash && previous.models?.sourceHash === report.models.sourceHash) {
          const refreshed = new Set(report.results.map(result => `${result.id}/${result.profile}/${result.viewport.name}`))
          report.results.unshift(...previous.results.filter(result => !refreshed.has(`${result.id}/${result.profile}/${result.viewport.name}`)))
        }
      }
      catch { /* A first partial capture is incomplete until the rest is captured. */ }
    }
    // A failed refresh still owns the previous PNG, so a later retry can replace
    // it. Its failed status keeps that stale image out of the published gallery.
    for (const result of report.results) {
      if (result.status !== 'failed' || result.file) continue
      const old = previous?.results.find(row => row.id === result.id && row.profile === result.profile && row.viewport.name === result.viewport.name)
      if (old?.file) { result.file = old.file; result.sha256 = old.sha256 }
    }
    await mkdir(output, { recursive: true })
    await Bun.write(join(output, 'manifest.json.tmp'), `${JSON.stringify(report, null, 2)}\n`)
    await rename(join(output, 'manifest.json.tmp'), join(output, 'manifest.json'))
    const escape = (value: string): string => value.replace(/[\\`*_[\]<>]/g, '\\$&').replaceAll('\n', ' ')
    const gallery = ['# Screen captures', '', `Generated from the explicit screen inventory with @stacksjs/docs ${generatorVersion}. Review the images before publishing.`, '']
    for (const result of report.results) {
      gallery.push(`## ${escape(result.title)} (${result.profile}, ${result.viewport.name})`, '', escape(result.description), '', ...(result.reason ? [escape(result.reason), ''] : []), result.status === 'captured' ? `![${escape(result.title)}](${result.file})` : `**${result.status}:** ${escape(result.error ?? 'No image')}`, '')
    }
    await Bun.write(join(output, 'gallery.md'), `${gallery.join('\n')}\n`)
    return report
  }
  finally { await rm(temporary, { recursive: true, force: true }) }
}

if (import.meta.main && process.argv[2] === '--worker') {
  try {
    const results = await captureProfile(process.argv[3]!, process.argv[4]!, JSON.parse(process.argv[5]!))
    await Bun.write(process.argv[6]!, JSON.stringify(results))
  }
  catch { process.exitCode = 1 }
}
