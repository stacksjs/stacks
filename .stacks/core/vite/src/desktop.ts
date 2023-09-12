import { type ViteConfig } from '@stacksjs/types'
import { path as p } from '@stacksjs/path'
import { layouts, pages, uiEngine } from './stacks'
import { alias } from '@stacksjs/alias'
import { defineConfig } from './'
import generateSitemap from 'vite-ssg-sitemap'

import UnoCSS from 'unocss/vite'

export const pagesConfig = {
  root: p.projectStoragePath('framework/desktop/dashboard'),
  envDir: p.projectPath(),
  envPrefix: 'FRONTEND_',
  publicDir: p.projectPath('public'),

  resolve: {
    alias,
  },

  server: {
    host: '127.0.0.1',
    port: 3333,
  },

  plugins: [
    uiEngine(),
    pages({
      dirs: p.frameworkPath('stacks/dashboard/src/pages'),
    }),
    UnoCSS({
      configFile: p.corePath('vite/src/uno.config.ts')
    }),
    layouts({
      layoutsDirs: p.frameworkPath('stacks/dashboard/src/layouts'),
    }),
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
