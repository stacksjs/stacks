import type { ViteConfig } from '@stacksjs/types'
import { path as p } from '@stacksjs/path'
import { alias } from '@stacksjs/alias'
import generateSitemap from 'vite-ssg-sitemap'
import Components from 'unplugin-vue-components/vite'
import { layouts, pages, uiEngine, autoImports, cssEngine } from './stacks'
import { defineConfig } from '.'

export const pagesConfig = {
  root: p.projectStoragePath('framework/dashboard'),
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
    Components({
      // allow auto load markdown components under `./src/components/`
      extensions: ['stx', 'vue', 'md'],
      // allow auto import and register components used in markdown
      include: [/\.stx$/, /\.stx\?stx/, /\.vue$/, /\.vue\?vue/, /\.md$/],
      dts: p.projectStoragePath('framework/dashboard/components.d.ts'),
    }),

    autoImports(),

    pages({
      routesFolder: p.projectStoragePath('framework/dashboard/src/pages'),
    }),

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
