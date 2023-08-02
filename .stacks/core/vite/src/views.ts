import { type ViteConfig } from '@stacksjs/types'
import { functionsPath, projectPath } from '@stacksjs/path'
import { alias } from '@stacksjs/alias'
import { defineConfig } from './'

// import { autoImports, components, cssEngine, inspect, layouts, pages, pwa, uiEngine } from '.'
// import generateSitemap from 'vite-ssg-sitemap'

export const pagesConfig: ViteConfig = {
  root: functionsPath(),
  envDir: projectPath(),
  envPrefix: 'FRONTEND_',

  resolve: {
    alias,
  },

  plugins: [
    // preview(),
    // uiEngine(),
    // pages(),
    // cssEngine(),
    // components(),
    // layouts(),
    // // i18n(),
    // autoImports(),
    // pwa(),
    // inspect(),
  ],

  // https://github.com/antfu/vite-ssg
  // ssgOptions: {
  //   script: 'async',
  //   formatting: 'minify',
  //   onFinished() { generateSitemap() },
  // },

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
