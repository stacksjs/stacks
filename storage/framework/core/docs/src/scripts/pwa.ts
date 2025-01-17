import type { PwaOptions } from '@vite-pwa/vitepress'
import { docs } from '@stacksjs/config'
import { frameworkPath } from '@stacksjs/path'

export const pwaDocs: PwaOptions = {
  outDir: frameworkPath('docs/dist'),
  registerType: 'autoUpdate',
  strategies: 'injectManifest',
  srcDir: frameworkPath('docs/.vitepress'),
  filename: 'sw.ts',
  injectRegister: 'inline',
  manifest: {
    id: '/',
    name: docs.title,
    short_name: docs.title,
    description: docs.description,
    theme_color: '#ffffff',
    start_url: '/',
    lang: 'en-US',
    dir: 'ltr',
    orientation: 'natural',
    display: 'standalone',
    display_override: ['window-controls-overlay'],
    categories: ['development', 'developer tools'],
    icons: [
      {
        src: '/pwa-64x64.png',
        sizes: '64x64',
        type: 'image/png',
      },
      {
        src: '/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/maskable-icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    edge_side_panel: {
      preferred_width: 480,
    },
    screenshots: [{
      src: 'og.png',
      sizes: '1281x641',
      type: 'image/png',
      label: `Screenshot of Stacks`,
    }],
  },
  injectManifest: {
    globPatterns: ['**/*.{css,js,html,svg,png,ico,txt,woff2}', 'hashmap.json'],
    globIgnores: ['og-*.{png,jpg,jpeg}'],
  },
}
