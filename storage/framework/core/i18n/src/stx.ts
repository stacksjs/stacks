import type { I18nConfig } from './types'
import { state } from '@stacksjs/stx'
import { I18n } from './translator'

/**
 * An isolated native STX translator. Reads inside bindings/effects track locale
 * and message changes, so switching words preserves the mounted screen state.
 * Import STX from its root: the template bundler shares this signal runtime.
 */
export function useI18n(options: Partial<I18nConfig> = {}): I18n {
  const revision = state(0)
  let version = 0
  const instance = new I18n(options, () => { revision() })
  instance.subscribe(() => { revision.set(++version) })
  return instance
}
