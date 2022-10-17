import { defineConfig } from 'vite'
import generateSitemap from 'vite-ssg-sitemap'
import type { ViteConfig } from '@stacksjs/types'
import { functionsPath, projectPath } from '@stacksjs/utils'
import { alias, atomicCssEngine, autoImports, components, i18n, inspect, layouts, markdown, pages, preview, pwa, uiEngine } from 'stacksjs'

const config: ViteConfig = {
  root: functionsPath(),
  envDir: projectPath(),
  envPrefix: 'APP_',

  resolve: {
    alias,
  },

  plugins: [
    preview(),
    uiEngine(),
    pages(),
    atomicCssEngine(),
    components(),
    layouts(),
    i18n(),
    markdown(),
    autoImports(),
    pwa(),
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
    return config

  // command === 'build'
  return config
})
