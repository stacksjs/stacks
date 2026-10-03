/**
 * Runs the interactive-content probe and collects its record (stacksjs/stacks#877).
 *
 * Serves the probe page on loopback, opens it in a real Craft window (or prints
 * the URL for a browser), waits for the page to POST its observations back,
 * and combines them with what only the host can see: the Craft version, the OS
 * build, the machine model and the display's own refresh rate. The page cannot
 * learn any of those, and the refresh rate in particular is what tells a 60 Hz
 * cap apart from a 60 Hz panel.
 *
 * The window must be visible. Craft's `--headless` does not drive the
 * compositor, so requestAnimationFrame stops after one frame there - which is
 * why this opens an ordinary window and why CI cannot run it.
 *
 * Usage:
 *   buddy desktop:probe                       # Craft window, print the record
 *   buddy desktop:probe --record              # ... and write it to src/probe/results
 *   buddy desktop:probe --browser             # same page in the default browser
 *   buddy desktop:probe --browser=Safari      # ... in a named browser (macOS)
 *   bun storage/framework/core/desktop/src/probe/runner.ts [same flags]
 */

import type { ProbePageConfig, ProbePagePayload } from './payload'
import type { ProbeHostFacts } from './record'
import type { InteractiveProbeRecord } from './schema'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { probePageHtml } from './html'
import { DEFAULT_PROBE_PAGE_CONFIG } from './payload'
import { browserFromUserAgent, buildProbeRecord } from './record'
import { PROBE_RESULTS_DIR, probeRecordFileName } from './records'
import { headline } from './render'
import { assertProbeRecord, PROBE_NAMES } from './schema'
import { parseRefreshHz } from './stats'

export interface ProbeRunOptions {
  /** Open a Craft window, or wait for a browser to load the page. */
  mode: 'craft' | 'browser'
  /** Craft binary; defaults to `CRAFT_BIN`, then `craft` on PATH. */
  craftBin?: string
  /** Browser mode: open the default browser (true), a named one (macOS), or nothing (false). */
  open?: boolean | string
  page?: Partial<ProbePageConfig>
  /** Give up after this long. Defaults to the page's own duration plus a minute. */
  timeoutMs?: number
  port?: number
  log?: (line: string) => void
}

function capture(command: string[]): string | null {
  try {
    const result = Bun.spawnSync(command, { stdout: 'pipe', stderr: 'ignore' })
    return result.exitCode === 0 ? result.stdout.toString().trim() : null
  }
  catch {
    return null
  }
}

/** `craft version 0.0.105` (the first line of `craft --version`) to `0.0.105`. */
export function parseCraftVersion(output: string | null): string | null {
  return output?.match(/craft version\s+(\d+\.\d+\.\d+\S*)/i)?.[1] ?? null
}

interface DisplayFacts { name: string, resolution: string, refreshHz: number | null }

/**
 * The main display from `system_profiler SPDisplaysDataType -json`, without
 * the serial number and vendor identifiers it also reports.
 */
export function mainDisplayFromProfiler(json: string | null): DisplayFacts | null {
  if (!json)
    return null
  try {
    const parsed = JSON.parse(json) as { SPDisplaysDataType?: Array<{ spdisplays_ndrvs?: Array<Record<string, string>> }> }
    const displays = (parsed.SPDisplaysDataType ?? []).flatMap(gpu => gpu.spdisplays_ndrvs ?? [])
    const main = displays.find(display => display.spdisplays_main === 'spdisplays_yes') ?? displays[0]
    if (!main)
      return null
    const resolution = main._spdisplays_resolution ?? 'unknown'
    return { name: main._name ?? 'unknown', resolution, refreshHz: parseRefreshHz(resolution) }
  }
  catch {
    return null
  }
}

/** Everything about the host the page cannot see. */
export function collectHostFacts(mode: 'craft' | 'browser', craftVersion: string | null, userAgent: string): ProbeHostFacts {
  const platform = process.platform
  let osName = OS_NAME[platform] ?? platform
  let osVersion = os.release()
  let build: string | undefined
  let model = 'unknown'
  let cpu = os.cpus()[0]?.model?.trim() || 'unknown'
  let display: DisplayFacts = { name: 'unknown', resolution: 'unknown', refreshHz: null }

  if (platform === 'darwin') {
    osName = 'macOS'
    osVersion = capture(['sw_vers', '-productVersion']) ?? osVersion
    build = capture(['sw_vers', '-buildVersion']) ?? undefined
    model = capture(['sysctl', '-n', 'hw.model']) ?? model
    cpu = capture(['sysctl', '-n', 'machdep.cpu.brand_string']) ?? cpu
    display = mainDisplayFromProfiler(capture(['system_profiler', 'SPDisplaysDataType', '-json'])) ?? display
  }
  else if (platform === 'linux') {
    model = capture(['cat', '/sys/devices/virtual/dmi/id/product_name']) ?? model
  }

  const browser = browserFromUserAgent(userAgent)
  return {
    measuredAt: new Date().toISOString(),
    host: mode === 'craft'
      ? { kind: 'craft', name: 'craft', version: craftVersion ?? 'unknown' }
      : { kind: 'browser', name: browser.name, version: browser.version },
    os: { platform, arch: process.arch, name: osName, version: osVersion, ...(build ? { build } : {}) },
    machine: { model, cpu, display },
  }
}

const OS_NAME: Record<string, string> = { darwin: 'macOS', linux: 'Linux', win32: 'Windows' }

/** The page script, bundled for the browser from source or the published build. */
async function bundlePageScript(): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url))
  const entry = [join(here, 'page.ts'), join(here, 'page.js')].find(existsSync)
  if (!entry)
    throw new Error('The probe page script is missing; reinstall @stacksjs/desktop-build.')
  const result = await Bun.build({ entrypoints: [entry], target: 'browser', format: 'esm', minify: true })
  if (!result.success)
    throw new Error(`Bundling the probe page failed:\n${result.logs.map(String).join('\n')}`)
  return await result.outputs[0]!.text()
}

function openCommand(url: string, app: boolean | string): string[] | null {
  if (app === false)
    return null
  if (process.platform === 'darwin')
    return typeof app === 'string' ? ['open', '-a', app, url] : ['open', url]
  if (process.platform === 'win32')
    return ['cmd', '/c', 'start', '', url]
  return ['xdg-open', url]
}

/** Serve the page, run it, and return the validated record. */
export async function runProbe(options: ProbeRunOptions): Promise<InteractiveProbeRecord> {
  const log = options.log ?? (line => console.log(line))
  const config: ProbePageConfig = { ...DEFAULT_PROBE_PAGE_CONFIG, ...options.page }
  if (options.mode === 'browser')
    config.tryNativeFullscreen = false

  let craftBin: string | null = null
  let craftVersion: string | null = null
  if (options.mode === 'craft') {
    const { resolveCraftExecutable } = await import('../index')
    craftBin = resolveCraftExecutable(options.craftBin)
    craftVersion = parseCraftVersion(capture([craftBin, '--version']))
    if (!craftVersion)
      throw new Error(`Could not read a version from \`${craftBin} --version\`; is it a Craft binary?`)
  }

  const html = probePageHtml(await bundlePageScript(), config)
  let settle!: (payload: ProbePagePayload) => void
  let fail!: (error: Error) => void
  const received = new Promise<ProbePagePayload>((resolve, reject) => {
    settle = resolve
    fail = reject
  })

  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: options.port ?? 0,
    async fetch(request) {
      const { pathname } = new URL(request.url)
      if (request.method === 'POST' && pathname === '/results') {
        settle(await request.json() as ProbePagePayload)
        return new Response('ok')
      }
      if (request.method === 'POST' && pathname === '/progress') {
        log(`  page: ${await request.text()}`)
        return new Response('ok')
      }
      if (request.method === 'POST' && pathname === '/failed') {
        fail(new Error(`The probe page failed: ${await request.text()}`))
        return new Response('ok')
      }
      if (pathname === '/')
        return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } })
      return new Response('not found', { status: 404 })
    },
  })

  const url = server.url.href
  let craft: ReturnType<typeof Bun.spawn> | null = null
  // A signal skips the `finally` below, which left the probe window open
  // after Ctrl-C. Close it on the way out instead.
  const interrupted = () => {
    craft?.kill()
    process.exit(130)
  }
  process.once('SIGINT', interrupted)
  process.once('SIGTERM', interrupted)
  const budget = options.timeoutMs ?? config.idleMs + config.loadMs + config.interactionWindowMs + 60_000
  const timer = setTimeout(() => fail(new Error(`No results within ${Math.round(budget / 1000)} s. Was the window visible?`)), budget)

  try {
    if (options.mode === 'craft') {
      log(`Opening ${url} in Craft ${craftVersion} (${craftBin})`)
      craft = Bun.spawn([craftBin!, url, '--title', 'Stacks interactive probe', '--width', '1280', '--height', '800'], {
        stdout: 'ignore',
        stderr: 'ignore',
      })
      void craft.exited.then(code => fail(new Error(`Craft exited (code ${code}) before the probe finished`)))
    }
    else {
      log(`Probe page: ${url}`)
      const command = openCommand(url, options.open ?? true)
      if (command)
        Bun.spawn(command, { stdout: 'ignore', stderr: 'ignore' })
      else
        log('Open that URL in the browser to measure, and keep its window visible.')
    }

    const payload = await received
    const facts = collectHostFacts(options.mode, craftVersion, payload.userAgent)
    return assertProbeRecord(buildProbeRecord(payload, facts), 'the probe result')
  }
  finally {
    clearTimeout(timer)
    process.off('SIGINT', interrupted)
    process.off('SIGTERM', interrupted)
    craft?.kill()
    server.stop(true)
  }
}

/** A plain-text summary, one line per probe. */
export function summarize(record: InteractiveProbeRecord): string {
  const width = Math.max(...PROBE_NAMES.map(([, label]) => label.length))
  const lines = [`${record.host.kind === 'craft' ? `Craft ${record.host.version}` : `${record.host.name} ${record.host.version}`} on ${record.os.name} ${record.os.version} (${record.machine.model}, ${record.machine.cpu}), display ${record.machine.display.refreshHz ?? 'unknown'} Hz`]
  for (const [name, label] of PROBE_NAMES) {
    const probe = record.probes[name]
    const figure = headline(name, probe)
    lines.push(`  ${label.padEnd(width)}  ${probe.status}${figure ? ` - ${figure}` : ''}`)
  }
  return lines.join('\n')
}

function flag(name: string): string | boolean | undefined {
  const prefix = `--${name}=`
  for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i]!
    if (arg === `--${name}`) {
      const next = process.argv[i + 1]
      return next && !next.startsWith('--') ? next : true
    }
    if (arg.startsWith(prefix))
      return arg.slice(prefix.length)
  }
  return undefined
}

function seconds(name: string): number | undefined {
  const value = flag(name)
  if (value === undefined || value === true)
    return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0)
    throw new Error(`--${name} must be a non-negative number of seconds`)
  return parsed * 1000
}

/** The framework repository root, counted up from the results directory. */
const frameworkRoot = resolve(PROBE_RESULTS_DIR, '../../../../../../..')

export async function run(): Promise<void> {
  const browser = flag('browser')
  const record = flag('record') !== undefined
  const out = flag('out')
  const cpu = flag('cpu-load')
  const instances = flag('instances')

  if (record) {
    // The records are framework data. From an application the path below
    // would be inside node_modules, where a write is lost on the next install.
    const rel = relative(frameworkRoot, process.cwd())
    if (rel.startsWith('..') || !existsSync(join(frameworkRoot, 'storage/framework/core/buddy')))
      throw new Error('--record writes into the Stacks framework repository; run it from that checkout, or use --out <file>.')
  }

  const page: Partial<ProbePageConfig> = {}
  const idle = seconds('idle')
  const load = seconds('load')
  const window = seconds('interaction-window')
  if (idle !== undefined)
    page.idleMs = idle
  if (load !== undefined)
    page.loadMs = load
  if (window !== undefined)
    page.interactionWindowMs = window
  if (typeof cpu === 'string')
    page.cpuLoadMsPerFrame = Number(cpu)
  if (typeof instances === 'string')
    page.instances = Number(instances)

  // `--browser` alone opens the default browser, `--browser=Safari` a named
  // one, and `--no-open` just prints the URL.
  let open: boolean | string = typeof browser === 'string' ? browser : true
  if (flag('no-open') !== undefined)
    open = false
  const craftBin = flag('craft-bin')

  const result = await runProbe({
    mode: browser === undefined ? 'craft' : 'browser',
    open,
    craftBin: typeof craftBin === 'string' ? craftBin : undefined,
    timeoutMs: seconds('timeout'),
    page,
  })

  console.log(`\n${summarize(result)}\n`)
  const json = `${JSON.stringify(result, null, 2)}\n`

  if (record) {
    mkdirSync(PROBE_RESULTS_DIR, { recursive: true })
    const path = join(PROBE_RESULTS_DIR, probeRecordFileName(result))
    writeFileSync(path, json)
    console.log(`Recorded ${relative(process.cwd(), path)}. Run \`buddy docs:capabilities\` to publish it.`)
  }
  if (typeof out === 'string') {
    writeFileSync(out, json)
    console.log(`Wrote ${out}`)
  }
  if (!record && typeof out !== 'string')
    console.log(json)
}

if (import.meta.main) {
  try {
    await run()
  }
  catch (error) {
    // Synchronous on purpose: an awaited logger can lose the message to
    // process.exit (see buddy's desktop-apple `fail`).
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exit(1)
  }
}
