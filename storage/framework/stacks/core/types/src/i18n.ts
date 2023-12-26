interface VitePluginVueI18nOptions {
  forceStringify?: boolean
  runtimeOnly?: boolean
  compositionOnly?: boolean
  fullInstall?: boolean
  include?: string | string[]
  defaultSFCLang?: 'json' | 'json5' | 'yml' | 'yaml'
  globalSFCScope?: boolean
  useVueI18nImportName?: boolean
}

/**
 * **Internationalization Options**
 *
 * The i18n option.
 *
 * @see https://github.com/intlify/bundle-tools/blob/main/packages/vite-plugin-vue-i18n/src/options.ts
 */
export type i18nOptions = VitePluginVueI18nOptions
