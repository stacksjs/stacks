import type { Plugin } from 'vite'
import VueI18n from '@intlify/unplugin-vue-i18n/vite'
import { path as p } from '@stacksjs/path'

export function i18n(): Plugin {
  // @ts-expect-error - somehow a pwa error happens when we type `name` in this plugin
  return VueI18n({
    runtimeOnly: true,
    compositionOnly: true,
    fullInstall: true,
    include: [p.resolve(__dirname, '../../../../../../../lang/**')],
  })
}
