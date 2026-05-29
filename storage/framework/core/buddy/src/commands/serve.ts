import type { CLI } from '@stacksjs/types'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { log } from '@stacksjs/cli'

/**
 * `buddy serve` — boot the production HTTP server.
 *
 * Renders the project's STX views (resources/views) via stx-serve and applies
 * the maintenance / coming-soon gate so `APP_COMING_SOON` (and `buddy down` /
 * `buddy coming-soon`) hold every request behind the holding page, with the
 * secret-URL + bypass-cookie escape hatch intact. Bun.serve binds 0.0.0.0 by
 * default, so the server is reachable on the host's public interface.
 *
 * This is the entry the Hetzner deploy runs as a systemd service
 * (`bun storage/framework/core/buddy/src/cli.ts serve`).
 */
export function serve(buddy: CLI): void {
  buddy
    .command('serve', 'Start the production HTTP server (STX views + coming-soon/maintenance gate)')
    .option('-p, --port <port>', 'Port to listen on (defaults to PORT env or 3000)')
    .option('--verbose', 'Enable verbose output', { default: false })
    .action(async (options?: { port?: string | number, verbose?: boolean }) => {
      if (options?.port)
        process.env.PORT = String(options.port)
      process.env.APP_ENV = process.env.APP_ENV || 'production'

      const port = Number(process.env.PORT) || 3000

      const { overridesReady } = await import('@stacksjs/config')
      await overridesReady

      const { injectGlobalAutoImports } = await import('@stacksjs/server')
      await injectGlobalAutoImports()

      // Resolve the stx `serve` implementation: local STX worktree first
      // (dev machines), then the project's pantry-vendored copy, then the
      // installed npm package.
      let stxServe: any
      const serveCandidates = [
        join(homedir(), 'Code/Tools/stx/packages/bun-plugin/dist/serve.js'),
        join(process.cwd(), 'pantry/bun-plugin-stx/dist/serve.js'),
      ]
      for (const entry of serveCandidates) {
        try {
          if (existsSync(entry)) {
            ;({ serve: stxServe } = await import(entry))
            break
          }
        }
        catch { /* try next */ }
      }
      if (!stxServe)
        ;({ serve: stxServe } = await import('bun-plugin-stx/serve'))

      // Pre-resolve the vendored stx module + site/i18n config so `{t:…}`
      // translation tokens and the lang picker render in production exactly
      // like they do under `buddy dev`.
      const stxModule = await resolveVendoredStxModule()
      const { site: siteConfig, i18n: i18nConfig } = await loadStxSiteConfig()

      const userViewsPath = 'resources/views'
      const defaultViewsPath = 'storage/framework/defaults/resources/views'
      const userLayoutsPath = existsSync('resources/views/layouts') ? 'resources/views/layouts' : 'resources/layouts'
      const userComponentsPath = existsSync('resources/views/components') ? 'resources/views/components' : 'resources/components'

      log.info(`Starting production server on port ${port}...`)

      await stxServe({
        patterns: [userViewsPath, defaultViewsPath],
        port,
        componentsDir: 'storage/framework/defaults/resources/components',
        layoutsDir: userLayoutsPath,
        partialsDir: userComponentsPath,
        fallbackLayoutsDir: 'storage/framework/defaults/resources/layouts',
        fallbackPartialsDir: defaultViewsPath,
        quiet: options?.verbose !== true,
        ...(stxModule && { stxModule }),
        ...(i18nConfig && { i18n: i18nConfig }),
        ...(siteConfig?.url && { site: siteConfig }),
        // Maintenance / coming-soon gate runs first so it intercepts every
        // request. The gate allowlists `/coming-soon`, the secret bypass URL,
        // and static assets, so the holding page renders and visitors with a
        // valid bypass cookie pass through.
        onRequest: async (req: Request) => {
          const { maintenanceGate } = await import('@stacksjs/server')
          return (await maintenanceGate(req)) ?? undefined
        },
      })

      log.success(`Production server listening on http://0.0.0.0:${port}`)
    })
}

async function resolveVendoredStxModule(): Promise<any | undefined> {
  const candidates = [
    join(homedir(), 'Code/Tools/stx/packages/stx/dist/index.js'),
    join(process.cwd(), 'pantry/@stacksjs/stx/dist/index.js'),
  ]
  for (const entry of candidates) {
    try {
      if (existsSync(entry))
        return await import(entry)
    }
    catch { /* try next */ }
  }
  // Production fallback: the installed npm package (resolved from node_modules).
  // On a deployed server there is no dev worktree or `pantry/` dir — deps are
  // installed via `bun install`, so this is the path that actually resolves.
  try {
    return await import('@stacksjs/stx')
  }
  catch { /* not installed */ }
  return undefined
}

function fallbackI18nFromSite(site: any) {
  const locales: string[] = site.i18n.locales
  const defaultLocale = site.i18n.defaultLocale ?? locales[0]
  return {
    locales,
    defaultLocale,
    labels: site.i18n.labels ?? Object.fromEntries(locales.map(c => [c, c.toUpperCase()])),
    translations: {} as Record<string, Record<string, string>>,
    pickerSelector: site.i18n.pickerSelector ?? '#lang-picker',
  }
}

async function resolveSiteI18n(site: any): Promise<any> {
  const resolverPaths = [
    join(homedir(), 'Code/Tools/stx/packages/stx/src/site-builder/i18n.ts'),
    join(homedir(), 'Code/Tools/stx/packages/stx/dist/index.js'),
    join(process.cwd(), 'pantry/@stacksjs/stx/dist/index.js'),
  ]
  for (const resolverPath of resolverPaths) {
    try {
      if (!existsSync(resolverPath))
        continue
      const resolved = await import(resolverPath)
      if (typeof resolved.resolveI18n !== 'function')
        continue
      const i18n = resolved.resolveI18n(site, process.cwd())
      if (i18n)
        return i18n
    }
    catch { /* try next */ }
  }
  // Production fallback: resolve `resolveI18n` from the installed npm package so
  // `{t:…}` tokens render on a deployed server (no dev worktree / pantry dir).
  try {
    const resolved = await import('@stacksjs/stx')
    if (typeof (resolved as any).resolveI18n === 'function') {
      const i18n = (resolved as any).resolveI18n(site, process.cwd())
      if (i18n)
        return i18n
    }
  }
  catch { /* not installed */ }
  return fallbackI18nFromSite(site)
}

async function loadStxSiteConfig(): Promise<{ site?: any, i18n?: any }> {
  const sitePath = join(process.cwd(), 'site.config.ts')
  if (!existsSync(sitePath))
    return {}

  try {
    const mod = await import(sitePath)
    const site = mod.default
    if (!site)
      return {}
    if (!site.i18n)
      return { site }
    const i18n = await resolveSiteI18n(site)
    return { site, i18n }
  }
  catch { /* no site config */ }

  return {}
}
