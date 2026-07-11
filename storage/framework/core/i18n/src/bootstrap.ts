import { existsSync } from 'node:fs'
import { config } from '@stacksjs/config'
import { projectPath } from '@stacksjs/path'
import { loadFromDirectory } from './loader'
import { configure, getAvailableLocales, setLocale } from './translator'

let localesLoaded = false

/**
 * Load translation files from the project `locales/` directory once.
 * Locale subdirectories (`locales/de.yml`, `locales/en.yml`, …) are detected
 * automatically by `loadFromDirectory`.
 */
export async function ensureLocalesLoaded(): Promise<void> {
  if (localesLoaded)
    return

  const directory = projectPath('locales')
  if (existsSync(directory)) {
    await loadFromDirectory({
      directory,
      extensions: ['.yaml', '.yml', '.json'],
    })
  }

  const app = (config as { app?: { locale?: string, fallbackLocale?: string, env?: string } }).app
  const defaultLocale = app?.locale ?? 'en'
  const fallback = app?.fallbackLocale ?? defaultLocale
  const available = getAvailableLocales()
  configure({
    locale: defaultLocale,
    fallbackLocale: fallback,
    availableLocales: available.length > 0 ? available : [defaultLocale],
    warnMissing: (app?.env ?? process.env.APP_ENV) !== 'production',
  })

  localesLoaded = true
}

/**
 * Resolve the active locale for an HTTP request.
 * Order: STX locale prefix (`/en/...`), `?locale=`, `locale` cookie,
 * Accept-Language, then `config.app.locale`.
 */
export function resolveRequestLocale(request?: Request): string {
  const app = (config as { app?: { locale?: string, fallbackLocale?: string } }).app
  const defaultLocale = app?.locale ?? 'en'
  const available = new Set(getAvailableLocales())
  if (!available.size)
    available.add(defaultLocale)

  const pick = (code: string): string => {
    const normalized = code.trim().toLowerCase()
    if (available.has(normalized))
      return normalized
    const short = normalized.split('-')[0]
    if (short && available.has(short))
      return short
    return defaultLocale
  }

  if (!request)
    return defaultLocale

  const url = new URL(request.url)
  const pathname = url.pathname

  const fromStx = request.headers.get('x-stx-locale')
  if (fromStx)
    return pick(fromStx)

  // Non-default locales are served under `/<code>/…` by stx-serve i18n routing.
  for (const code of available) {
    if (code === defaultLocale)
      continue
    if (pathname === `/${code}` || pathname === `/${code}/`)
      return pick(code)
    if (pathname.startsWith(`/${code}/`))
      return pick(code)
  }

  const fromQuery = url.searchParams.get('locale')
  if (fromQuery)
    return pick(fromQuery)

  const cookie = request.headers.get('cookie') ?? ''
  const match = cookie.match(/(?:^|;\s*)locale=([a-z]{2}(?:-[a-z]{2})?)(?:;|$)/i)
  if (match?.[1])
    return pick(match[1])

  const accept = request.headers.get('accept-language') ?? ''
  for (const part of accept.split(',')) {
    const tag = part.split(';')[0]?.trim()
    if (tag)
      return pick(tag)
  }

  return defaultLocale
}

/** Load `locales/` and activate the global translator for this request. */
export async function applyRequestLocale(request?: Request): Promise<string> {
  await ensureLocalesLoaded()
  const locale = resolveRequestLocale(request)
  setLocale(locale)
  return locale
}
