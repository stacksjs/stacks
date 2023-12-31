import type { ViteConfig } from 'src/types/src'
import { path as p } from 'src/path/src'
import { alias } from 'src/alias/src'
import generateSitemap from 'vite-ssg-sitemap'

import UnoCSS from 'unocss/vite'
import { layouts, pages, uiEngine } from './stacks'
import { defineConfig } from '.'

export const pagesConfig = {
  root: p.projectStoragePath('framework/desktop/music'),
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
      dirs: p.frameworkPath('stacks/music/src/pages'),
    }),
    UnoCSS({
      configFile: p.corePath('vite/src/uno.config.ts'),
    }),
    layouts({
      layoutsDirs: p.frameworkPath('stacks/music/src/layouts'),
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
