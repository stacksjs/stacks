import { type ViteConfig } from '@stacksjs/types'
import { path as p } from '@stacksjs/path'
import { alias } from '@stacksjs/alias'
import generateSitemap from 'vite-ssg-sitemap'

import UnoCSS from 'unocss/vite'
import { autoImports, components, inspect, layouts, pages, uiEngine } from './stacks'
import { defineConfig } from './'

export const pagesConfig = {
  root: p.projectStoragePath('framework/web'),
  envDir: p.projectPath(),
  envPrefix: 'FRONTEND_',

  resolve: {
    alias,
  },

  server: {
    host: '127.0.0.1',
    port: 3333,
  },

  plugins: [
    // preview(),
    uiEngine(),
    pages({
      dirs: p.resourcesPath('views'),
    }),
    UnoCSS({
      configFile: p.corePath('vite/src/uno.config.ts')
    }),
    // cssEngine(),
    components(),
    layouts({
      layoutsDirs: p.resourcesPath('layouts'),
    }),
    autoImports(),
    inspect(),
  ],

  // https://github.com/antfu/vite-ssg
  ssgOptions: {
    script: 'async',
    formatting: 'minify',
    onFinished() { generateSitemap() },
  },

  ssr: {
    // TODO: workaround until they support native ESM
    noExternal: ['workbox-window', /vue-i18n/],
  },
} satisfies ViteConfig

export default defineConfig(({ command }) => {
  if (command === 'serve')
    return pagesConfig

  // command === 'build'
  return pagesConfig
})
