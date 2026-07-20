import type { ExtensionConfig, FirefoxAddonsConfig } from './types'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { buildExtension, resolveOutdir } from './build'

export interface FirefoxAddonsAuth {
  /** AMO API JWT issuer. @default AMO_JWT_ISSUER or WEB_EXT_API_KEY */
  issuer?: string
  /** AMO API JWT secret. @default AMO_JWT_SECRET or WEB_EXT_API_SECRET */
  secret?: string
}

export interface FirefoxPublishOptions extends FirefoxAddonsAuth {
  version: string
  cwd?: string
  /** Rebuild the Firefox extension before submission. @default true */
  build?: boolean
  /** Human-readable source archive for AMO review. */
  sourceCodePath?: string
  /** Milliseconds to wait for automated validation. @default 300000 */
  timeout?: number
  /** Milliseconds to wait for human approval; 0 returns after submission. @default 0 */
  approvalTimeout?: number
}

export interface FirefoxPublishResult {
  artifactsDir: string
  artifacts: string[]
  channel: 'listed' | 'unlisted'
}

interface FirefoxSignArgsOptions {
  executable: string
  sourceDir: string
  artifactsDir: string
  channel: 'listed' | 'unlisted'
  timeout: number
  approvalTimeout: number
}

export function firefoxSignArgs(options: FirefoxSignArgsOptions): string[] {
  return [
    options.executable,
    'sign',
    '--source-dir', options.sourceDir,
    '--artifacts-dir', options.artifactsDir,
    '--channel', options.channel,
    '--timeout', String(options.timeout),
    '--approval-timeout', String(options.approvalTimeout),
    '--no-input',
  ]
}

function resolveFirefoxAuth(options: FirefoxAddonsAuth): Required<FirefoxAddonsAuth> {
  const issuer = options.issuer ?? process.env.AMO_JWT_ISSUER ?? process.env.WEB_EXT_API_KEY
  const secret = options.secret ?? process.env.AMO_JWT_SECRET ?? process.env.WEB_EXT_API_SECRET
  const missing = [!issuer && 'AMO_JWT_ISSUER', !secret && 'AMO_JWT_SECRET'].filter(Boolean)
  if (missing.length)
    throw new Error(`[browser-extension] missing Firefox Add-ons credentials: ${missing.join(', ')}`)
  return { issuer: issuer!, secret: secret! }
}

/** Metadata accepted by AMO v5 when web-ext creates the first listed version. */
export function firefoxListingMetadata(config: ExtensionConfig, store: FirefoxAddonsConfig): Record<string, unknown> | undefined {
  if (!store.license && !store.categories?.length)
    return undefined
  if (!store.license || !store.categories?.length)
    throw new Error('[browser-extension] a new Firefox listing needs both firefoxAddons.license and firefoxAddons.categories')

  return {
    version: { license: store.license },
    categories: { firefox: store.categories },
    summary: { 'en-US': config.description },
    ...(store.homepage ? { homepage: { 'en-US': store.homepage } } : {}),
    ...(store.supportEmail ? { support_email: { 'en-US': store.supportEmail } } : {}),
    requires_payment: store.requiresPayment ?? false,
  }
}

/** Resolve web-ext from PATH or from this package's declared dependency. */
export function resolveWebExtExecutable(which: (command: string) => string | null = Bun.which): string | undefined {
  const fromPath = which('web-ext')
  if (fromPath)
    return fromPath

  try {
    const require = createRequire(import.meta.url)
    const packagePath = require.resolve('web-ext/package.json')
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as { bin?: string | Record<string, string> }
    const relativeBin = typeof packageJson.bin === 'string' ? packageJson.bin : packageJson.bin?.['web-ext']
    if (!relativeBin)
      return undefined
    const executable = resolve(packagePath, '..', relativeBin)
    return existsSync(executable) ? executable : undefined
  }
  catch {
    return undefined
  }
}

/** Build and submit a Firefox extension through Mozilla's official web-ext/AMO v5 flow. */
export async function publishFirefoxExtension(config: ExtensionConfig, options: FirefoxPublishOptions): Promise<FirefoxPublishResult> {
  if (!config.geckoId)
    throw new Error('[browser-extension] Firefox publishing needs geckoId in config/extension.ts')
  const store = config.firefoxAddons ?? {}
  const auth = resolveFirefoxAuth(options)
  const cwd = options.cwd ?? process.cwd()
  if (options.build !== false)
    await buildExtension(config, { target: 'firefox', version: options.version, cwd })

  const sourceDir = resolve(cwd, resolveOutdir(config, 'firefox'))
  const artifactsDir = resolve(cwd, store.artifactsDir ?? 'web-ext-artifacts')
  const executable = resolveWebExtExecutable()
  if (!executable)
    throw new Error('[browser-extension] web-ext is unavailable; reinstall @stacksjs/browser-extension dependencies')
  await mkdir(artifactsDir, { recursive: true })
  const before = new Set(existsSync(artifactsDir) ? readdirSync(artifactsDir) : [])
  const tempDir = await mkdtemp(join(tmpdir(), 'stacks-firefox-publish-'))

  try {
    const args = firefoxSignArgs({
      executable,
      sourceDir,
      artifactsDir,
      channel: store.channel ?? 'listed',
      timeout: options.timeout ?? 300000,
      approvalTimeout: options.approvalTimeout ?? 0,
    })
    const metadata = firefoxListingMetadata(config, store)
    if (metadata) {
      const metadataPath = join(tempDir, 'amo-metadata.json')
      await Bun.write(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`)
      args.push('--amo-metadata', metadataPath)
    }
    if (options.sourceCodePath)
      args.push('--upload-source-code', resolve(cwd, options.sourceCodePath))

    const child = Bun.spawn(args, {
      cwd,
      env: {
        ...process.env,
        WEB_EXT_API_KEY: auth.issuer,
        WEB_EXT_API_SECRET: auth.secret,
      },
      stdout: 'inherit',
      stderr: 'inherit',
    })
    const exitCode = await child.exited
    if (exitCode !== 0)
      throw new Error(`[browser-extension] Firefox Add-ons submission failed (${exitCode})`)
  }
  finally {
    await rm(tempDir, { recursive: true, force: true })
  }

  return {
    artifactsDir,
    artifacts: readdirSync(artifactsDir).filter(file => !before.has(file)),
    channel: store.channel ?? 'listed',
  }
}
