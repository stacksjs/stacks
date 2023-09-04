import { type ViteConfig } from '@stacksjs/types'
import { resourcesPath, projectPath } from '@stacksjs/path'

import { cssEngine, inspect, autoImports, components, layouts, pages, uiEngine, pwa } from './stacks'

import { alias } from '@stacksjs/alias'
import { defineConfig } from './'

import generateSitemap from 'vite-ssg-sitemap'

export const pagesConfig: ViteConfig = {
  root: projectPath('storage/framework/web/'),
  envDir: projectPath(),
  envPrefix: 'FRONTEND_',

  resolve: {
    alias,
  },

  plugins: [
    // preview(),
    uiEngine(),
    pages({
      routesFolder: [resourcesPath('views')],
    }),
    cssEngine(),
    components(),
    layouts({
      layoutsDirs: resourcesPath('layouts'),
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
