import type { CLI, HqServicesConfig } from '@stacksjs/types'
import type { HqCliDeps } from '../hq'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { defineCommand } from '@stacksjs/cli'
import { HQ_SERVICE_NAMES, resolveHqServices, runHqConnect, runHqStatus, runSupportDoctor } from '../hq'

/**
 * `buddy hq:connect` and `buddy hq:status`.
 *
 * The HQ services are separate products: each has its own account, keys, plan
 * and subscription. Connecting is therefore one approval per service, in that
 * service, and this file only wires the terminal, the browser and `.env` to
 * the logic in `../hq`.
 */

async function hqConfig(): Promise<{ config: HqServicesConfig, app: string }> {
  const { config, overridesReady } = await import('@stacksjs/config')
  // Before the app's own config files are layered in, a read answers the
  // framework defaults with no error at all.
  await overridesReady.catch(() => {})
  // The HQ entries sit beside every other service in config/services.ts.
  return { config: config.services ?? {}, app: String(config.app?.name || 'app') }
}

function browserCommand(url: string): string[] {
  if (process.platform === 'darwin')
    return ['open', url]
  if (process.platform === 'win32')
    return ['cmd', '/c', 'start', '', url]
  return ['xdg-open', url]
}

function openBrowser(url: string): void {
  if (!process.stdout.isTTY || process.env.CI)
    return
  Bun.spawn(browserCommand(url), { stdin: 'ignore', stdout: 'ignore', stderr: 'ignore' }).unref()
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted)
      return resolve()
    const done = (): void => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', done)
      resolve()
    }
    const timer = setTimeout(done, ms)
    signal?.addEventListener('abort', done, { once: true })
  })
}

/**
 * Write entries to the app's `.env`, and only there.
 *
 * A file that already encrypts its values gets these encrypted too; a plain
 * file stays plain, because encrypting one value would start a keypair the
 * rest of the file does not use. Nothing here prints: `setEnv` answers a
 * summary that names the key, and it is dropped rather than shown.
 */
export async function writeEnvEntries(entries: Record<string, string>, directory: string): Promise<void> {
  const { envHasCiphertext, setEnv } = await import('@stacksjs/env')
  const file = join(directory, '.env')
  const content = existsSync(file) ? readFileSync(file, 'utf8') : ''
  const plain = !envHasCiphertext(content)

  for (const [key, value] of Object.entries(entries)) {
    const result = setEnv(key, value, { cwd: directory, plain })
    if (!result.success)
      throw new Error(result.error ?? `could not set ${key}`)
    // The running process reads the new value too, so a later step in the
    // same command does not see the old one.
    process.env[key] = value
  }
}

function deps(signal?: AbortSignal): HqCliDeps {
  return {
    fetch: (input, init) => fetch(input, init),
    print: line => console.log(line),
    open: openBrowser,
    sleep,
    now: () => Date.now(),
    writeEnv: async (entries) => {
      const { projectPath } = await import('@stacksjs/path')
      await writeEnvEntries(entries, projectPath())
    },
    signal,
  }
}

function connectCommand(supportOnly = false) {
  return defineCommand({
    name: supportOnly ? 'support:install' : 'hq:connect [...services]',
    description: supportOnly ? 'Connect HQ.support and write its server keys to .env' : 'Connect this app to HQ services (BugHQ and LogHQ by default) and write their keys to .env',
    options: {
      '--no-open': 'Print the approve link without opening the browser',
      '--no-verify': 'Skip service read checks and test log/error delivery',
      '--timeout <seconds>': { description: 'How long to wait for each approval', default: 600 },
    },
    examples: supportOnly ? ['buddy support:install', 'buddy support:install --no-open'] : [
      'buddy hq:connect',
      'buddy hq:connect loghq',
      'buddy hq:connect bughq loghq --no-open',
    ],
    handle: async (options, ...args) => {
      // clapp hands a variadic argument over as one array.
      const requested = (args as unknown[]).flat().filter((value): value is string => typeof value === 'string')
      const resolved = resolveHqServices(supportOnly ? ['supporthq'] : requested)
      if ('error' in resolved) {
        console.error(resolved.error)
        process.exit(1)
      }

      const flags = options as { open?: boolean, verify?: boolean, timeout?: number | string }
      const seconds = Number(flags.timeout)
      const { config, app } = await hqConfig()

      // Ctrl+C stops the wait cleanly: nothing is written for the service that
      // was still pending, and what was already connected is reported.
      const controller = new AbortController()
      const cancel = (): void => controller.abort()
      process.once('SIGINT', cancel)

      try {
        const result = await runHqConnect(resolved.services, config, {
          app,
          open: flags.open !== false,
          verify: flags.verify !== false,
          timeoutMs: (Number.isFinite(seconds) && seconds > 0 ? seconds : 600) * 1000,
        }, deps(controller.signal))
        process.exit(controller.signal.aborted ? 130 : result.ok ? 0 : 1)
      }
      finally {
        process.off('SIGINT', cancel)
      }
    },
  })
}

const connect = connectCommand()
const install = connectCommand(true)

const doctor = defineCommand({
  name: 'support:doctor',
  description: 'Check HQ.support configuration and read access without creating a conversation',
  handle: async () => {
    const { config } = await hqConfig()
    const result = await runSupportDoctor(config, deps())
    process.exit(result.ok ? 0 : 1)
  },
})

const status = defineCommand({
  name: 'hq:status',
  description: 'Show usage against the allowance of each connected HQ service',
  examples: ['buddy hq:status'],
  handle: async () => {
    const { config } = await hqConfig()
    await runHqStatus(config, deps(), HQ_SERVICE_NAMES)
    process.exit(0)
  },
})

export function hq(buddy: CLI): void {
  connect(buddy)
  status(buddy)
  install(buddy)
  doctor(buddy)
}
