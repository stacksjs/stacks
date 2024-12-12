import type { UserModule } from '@stacksjs/types'
import type { Locale } from 'vue-i18n'
import fs from 'node:fs/promises'
import path from 'node:path'
import { handleError } from '@stacksjs/error-handling'
import yaml from 'js-yaml'
import { createI18n } from 'vue-i18n'

const i18n = createI18n({
  legacy: false,
  locale: '',
  messages: {},
})

const loadedLanguages: string[] = []

export const install: UserModule = async ({ app }) => {
  const glob = new Bun.Glob('*.yml')
  const langPath = path.resolve(__dirname, '../../resources/lang')

  // Check if the directory exists
  try {
    await fs.access(langPath)
  }
  catch (error) {
    handleError(`The lang directory does not exist: ${langPath}`, { shouldExit: false })
    handleError(error, { shouldExit: false })
    return // Exit the function if the directory doesn't exist
  }

  const langFiles = []

  for await (const file of glob.scan(langPath)) {
    langFiles.push(`${langPath}/${file}`)
  }

  const localesMap = Object.fromEntries(
    await Promise.all(
      langFiles.map(async (file) => {
        const fileName = path.basename(file)
        const locale = fileName.replace('.yml', '')
        const content = await fs.readFile(file, 'utf-8')
        const parsedContent = yaml.load(content) as Record<string, string>

        return [locale, async () => ({ default: parsedContent })]
      }),
    ),
  ) as Record<Locale, () => Promise<{ default: Record<string, string> }>>

  app.use(i18n)
  await loadLanguageAsync('en', localesMap)
}

async function loadLanguageAsync(
  lang: string,
  localesMap: Record<Locale, () => Promise<{ default: Record<string, string> }>>,
): Promise<Locale> {
  // If the same language
  if (i18n.global.locale.value === lang)
    return setI18nLanguage(lang)

  // If the language was already loaded
  if (loadedLanguages.includes(lang))
    return setI18nLanguage(lang)

  // If the language hasn't been loaded yet
  const messages = await localesMap[lang]?.()
  if (!messages)
    return setI18nLanguage(lang)
  i18n.global.setLocaleMessage(lang, messages.default)
  loadedLanguages.push(lang)

  return setI18nLanguage(lang)
}

function setI18nLanguage(lang: Locale) {
  i18n.global.locale.value = lang as any
  if (typeof document !== 'undefined')
    document.querySelector('html')?.setAttribute('lang', lang)
  return lang
}
