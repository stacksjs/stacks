import type { ViteConfig } from '@stacksjs/types'
import { path as p } from '@stacksjs/path'
import { alias } from '@stacksjs/alias'
import generateSitemap from 'vite-ssg-sitemap'
import { autoImports, components, cssEngine, layouts, pages, uiEngine } from './plugins'
import { defineConfig } from '.'

export const pagesConfig = {
  root: p.frameworkPath('views/desktop'),
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
    pages({
      routesFolder: p.projectStoragePath('framework/dashboard/src/pages'),
    }),

    uiEngine(),
    components(),
    autoImports(),
    cssEngine(),

    layouts({
      layoutsDirs: p.resourcesPath('layouts'),
    }, false),
  ],

  // https://github.com/antfu/vite-ssg
  ssgOptions: {
    script: 'async',
    formatting: 'minify',
    onFinished() {
      generateSitemap()
    },
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
