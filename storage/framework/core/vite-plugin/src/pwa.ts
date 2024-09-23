import { path } from '@stacksjs/path'
import type { Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export function pwa(): Plugin {
  return {
    name: 'pwa-plugin',
    ...VitePWA({
      srcDir: path.publicPath(),
      registerType: 'autoUpdate',
    }),
  }
}
