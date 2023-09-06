import { type ViteConfig } from '@stacksjs/types'
import { path as p } from '@stacksjs/path'
import { cssEngine, inspect, autoImports, components, layouts, pages, uiEngine } from './stacks'
import { alias } from '@stacksjs/alias'
import { defineConfig } from './'
import generateSitemap from 'vite-ssg-sitemap'

export const pagesConfig: ViteConfig = {
  root: p.projectStoragePath('framework/web'),
  envDir: p.projectPath(),
  envPrefix: 'FRONTEND_',

  resolve: {
    alias,
  },

  plugins: [
    // preview(),
    uiEngine(),
    pages({
      routesFolder: [p.resourcesPath('views')],
    }),
    cssEngine(),
    components(),
    layouts({
      layoutsDirs: p.resourcesPath('layouts'),
    }),
    // i18n(),
    autoImports(),
    // pwa(),
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
}

export default defineConfig(({ command }) => {
  if (command === 'serve')
    return pagesConfig

  // command === 'build'
  return pagesConfig
})
