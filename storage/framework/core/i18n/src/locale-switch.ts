/**
 * Locale switch redirect — mirrors STX `buildLangPickerScript` path logic
 * (`/<code>/…` prefixes) so cookie-based fallbacks and `/locale/{code}`
 * redirects stay consistent with stx-serve i18n routing.
 */

export interface LocaleSwitchConfig {
  locales: string[]
  defaultLocale: string
}

function normalizeLocale(code: string, config: LocaleSwitchConfig): string | null {
  const normalized = code.trim().toLowerCase()
  if (config.locales.includes(normalized))
    return normalized
  const short = normalized.split('-')[0]
  if (short && config.locales.includes(short))
    return short
  return null
}

export function stripLocalePrefix(path: string, locales: string[]): { locale: string | null, path: string } {
  for (const loc of locales) {
    if (path === `/${loc}` || path === `/${loc}/`)
      return { locale: loc, path: '/' }
    if (path.startsWith(`/${loc}/`))
      return { locale: loc, path: path.slice(loc.length + 1) }
  }
  return { locale: null, path }
}

export function localizePath(path: string, locale: string, defaultLocale: string): string {
  if (locale === defaultLocale)
    return path
  if (path === '/')
    return `/${locale}/`
  if (path === '/404.html')
    return `/${locale}/404.html`
  return `/${locale}${path}`
}

/**
 * Build a redirect Response that sets the `locale` cookie and sends the
 * visitor to the equivalent path in the requested locale (STX-style).
 */
export function createLocaleSwitchResponse(
  request: Request,
  localeCode: string,
  config: LocaleSwitchConfig,
): Response {
  const locale = normalizeLocale(localeCode, config)
  if (!locale) {
    return Response.redirect(new URL('/', request.url).href, 302)
  }

  const referer = request.headers.get('referer')
  let basePath = '/'

  if (referer) {
    try {
      const ref = new URL(referer)
      if (!ref.pathname.startsWith('/locale/')) {
        const stripped = stripLocalePrefix(ref.pathname, config.locales)
        basePath = stripped.path || '/'
      }
    }
    catch {
      basePath = '/'
    }
  }

  const targetPath = localizePath(basePath, locale, config.defaultLocale)
  const target = new URL(targetPath, request.url)

  const res = Response.redirect(target.href, 302)
  res.headers.append(
    'Set-Cookie',
    `locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`,
  )
  return res
}
