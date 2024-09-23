import VueI18n from '@intlify/unplugin-vue-i18n/vite'
import { path as p } from '@stacksjs/path'
import type { Plugin } from 'vite'

export function i18n(): Plugin {
  return VueI18n({
    runtimeOnly: true,
    compositionOnly: true,
    fullInstall: true,
    include: [p.resolve(__dirname, '../../../../../../../lang/**')],
  })
}
