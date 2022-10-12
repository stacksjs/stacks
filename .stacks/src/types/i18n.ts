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

export type i18nOptions = VitePluginVueI18nOptions
