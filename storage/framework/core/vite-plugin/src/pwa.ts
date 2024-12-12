import type { Plugin } from 'vite'
import { path } from '@stacksjs/path'
import { VitePWA } from 'vite-plugin-pwa'

export function pwa(): Plugin {
  // @ts-expect-error - somehow a pwa error happens when we type `name` in antfus plugins
  return VitePWA({
    srcDir: path.publicPath(),
    registerType: 'autoUpdate',
    includeAssets: ['favicon.svg', 'safari-pinned-tab.svg'],
    manifest: {
      name: 'Stacks',
      short_name: 'Stacks',
      theme_color: '#ffffff',
      icons: [
        {
          src: '/pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: '/pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
        },
        {
          src: '/pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
    },
  })
}
