import { createLocaleSwitchResponse } from '@stacksjs/i18n'
import { existsSync } from 'node:fs'
import { projectPath } from '@stacksjs/path'

async function loadSiteI18n(): Promise<{ locales: string[], defaultLocale: string } | null> {
  const sitePath = projectPath('site.config.ts')
  if (!existsSync(sitePath))
    return null

  try {
    const mod = await import(sitePath)
    const site = mod.default ?? mod.config
    const i18n = site?.i18n
    if (!i18n?.locales?.length)
      return null

    return {
      locales: i18n.locales,
      defaultLocale: i18n.defaultLocale ?? i18n.locales[0],
    }
  }
  catch {
    return null
  }
}

export default new Action({
  name: 'SetLocaleAction',
  description: 'Switch locale via cookie and STX-style path redirect',
  method: 'GET',

  async handle(request: RequestInstance) {
    const fromSite = await loadSiteI18n()
    if (fromSite) {
      return createLocaleSwitchResponse(request as unknown as Request, String(request.param('locale') ?? ''), fromSite)
    }

    const { getAvailableLocales } = await import('@stacksjs/i18n')
    const { config } = await import('@stacksjs/config')
    const app = (config as { app?: { locale?: string } }).app
    const locales = getAvailableLocales()
    if (!locales.length) {
      return response.redirect('/')
    }

    return createLocaleSwitchResponse(request as unknown as Request, String(request.param('locale') ?? ''), {
      locales,
      defaultLocale: app?.locale ?? locales[0],
    })
  },
})
