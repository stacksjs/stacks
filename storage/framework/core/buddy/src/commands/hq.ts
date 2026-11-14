import type { CLI, HqServicesConfig } from '@stacksjs/types'
import type { HqCliDeps } from '../hq'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { defineCommand } from '@stacksjs/cli'
import { HQ_SERVICE_NAMES, resolveHqServices, runHqConnect, runHqStatus, runSupportDoctor } from '../hq'
import { runSupportVerification } from '../support-verification'
import { runSupportDocsSync, selectSupportDocuments } from '../support-documentation'
import { runSupportImport } from '../support-import'
import { installSupportMessenger } from '../support-installation'
import { version as frameworkVersion } from '../../package.json'

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
      '--messenger': { description: 'Explicitly mount the identified HQ.support messenger in the app layout', default: false },
      '--layout <path>': 'App-local stx layout to mount the opt-in messenger in',
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

      const flags = options as { open?: boolean, verify?: boolean, timeout?: number | string, messenger?: boolean, layout?: string }
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
        if (result.ok && flags.messenger && resolved.services.includes('supporthq')) {
          const { projectPath, frameworkPath } = await import('@stacksjs/path')
          const { config: fullConfig } = await import('@stacksjs/config')
          const installed = await installSupportMessenger({ ...config, supporthq: { ...config.supporthq!, key: process.env.SUPPORTHQ_KEY || config.supporthq?.key, project: process.env.SUPPORTHQ_PROJECT_ID || config.supporthq?.project } }, {
            directory: projectPath(), origin: String(fullConfig.app.url || ''), frameworkVersion,
            componentSource: await Bun.file(frameworkPath('defaults/resources/components/HqSupport.stx')).text(), layout: flags.layout,
          }, deps(controller.signal))
          if (!installed) { process.exitCode = 1; return }
        }
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
    const { config: fullConfig } = await import('@stacksjs/config')
    const result = await runSupportDoctor(config, deps(), { origin: fullConfig.app.url })
    process.exit(result.ok ? 0 : 1)
  },
})

const status = defineCommand({
  name: 'hq:status [...services]',
  description: 'Show usage against the allowance of each connected HQ service',
  examples: ['buddy hq:status'],
  handle: async (...args) => {
    const { config } = await hqConfig()
    const requested = (args as unknown[]).flat().filter((value): value is string => typeof value === 'string')
    const resolved = resolveHqServices(requested, HQ_SERVICE_NAMES)
    if ('error' in resolved) { console.error(resolved.error); process.exitCode = 1; return }
    await runHqStatus(config, deps(), resolved.services)
    process.exit(0)
  },
})

const syncDocs = defineCommand({
  name: 'support:sync-docs [...files]',
  description: 'Synchronize explicitly selected Markdown documents as private draft support knowledge',
  options: {
    '--dry-run': { description: 'Show selected sources without sending content', default: false },
    '--public': { description: 'Explicitly make selected articles customer-visible', default: false },
    '--publish': { description: 'Publish selected articles instead of keeping drafts', default: false },
    '--locale <locale>': { description: 'Knowledge locale', default: 'en' },
  },
  examples: ['buddy support:sync-docs docs/getting-started.md --dry-run', 'buddy support:sync-docs docs/getting-started.md --public --publish'],
  async handle(options, ...args) {
    try {
      const { projectPath } = await import('@stacksjs/path')
      const files = (args as unknown[]).flat().filter((value): value is string => typeof value === 'string')
      const documents = await selectSupportDocuments(projectPath(), files, options)
      const { config } = await hqConfig()
      const ok = await runSupportDocsSync(config, documents, options, { fetch: (input, init) => fetch(input, init), print: line => console.log(line) })
      process.exitCode = ok ? 0 : 1
    }
    catch { console.error('Select one to twenty Markdown files inside this app, each up to 100 KB. No data was sent.'); process.exitCode = 1 }
  },
})

const verify = defineCommand({
  name: 'support:verify <origin>',
  description: 'Publish a Stacks deployment challenge and confirm the permanent HQ.support free tier',
  options: { '--confirm': { description: 'Confirm the public challenge after deployment', default: false } },
  examples: ['buddy support:verify https://my-app.example', 'buddy support:verify https://my-app.example --confirm'],
  async handle(options, origin) {
    const { config } = await hqConfig()
    const { projectPath } = await import('@stacksjs/path')
    const statePath = projectPath('storage/framework/runtime/support-verification.json')
    const ok = await runSupportVerification(config, String(origin || ''), { confirm: options.confirm, frameworkVersion }, {
      fetch: (input, init) => fetch(input, init), print: line => console.log(line),
      writeDocument: async document => { await Bun.write(projectPath('public/.well-known/hq-support'), JSON.stringify(document)) },
      readState: async () => { try { return await Bun.file(statePath).json() } catch { return null } },
      writeState: async state => { await Bun.write(statePath, JSON.stringify(state)) },
    })
    process.exitCode = ok ? 0 : 1
  },
})

const importSupport = defineCommand({
  name: 'support:import <provider> [file]',
  description: 'Preview or resume a private Intercom migration using the connected support project',
  options: {
    '--dry-run': { description: 'Run the server compatibility rehearsal without importing data', default: false },
    '--resume <id>': 'Resume a saved migration run',
    '--status <id>': 'Read counts and status without reading customer transcripts',
  },
  examples: ['buddy support:import intercom export.json --dry-run', 'buddy support:import intercom export.json', 'buddy support:import intercom --resume 1'],
  async handle(options, provider, file) {
    if (provider !== 'intercom') { console.error('The supported migration provider is intercom.'); process.exitCode = 1; return }
    const { config } = await hqConfig()
    const ok = await runSupportImport(config, { file: typeof file === 'string' ? file : undefined, ...options }, { fetch: (input, init) => fetch(input, init), print: line => console.log(line) })
    process.exitCode = ok ? 0 : 1
  },
})

export function hq(buddy: CLI): void {
  connect(buddy)
  status(buddy)
  install(buddy)
  doctor(buddy)
  verify(buddy)
  syncDocs(buddy)
  importSupport(buddy)
}
