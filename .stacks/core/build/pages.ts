import { resolve } from 'pathe'
import { defineConfig } from 'vite'
import generateSitemap from 'vite-ssg-sitemap'
import type { ViteConfig } from '../types'
import { autoImports, preview, uiEngine } from '..'
import alias from '../alias'
import { _dirname } from '../utils'

const config: ViteConfig = {
  root: resolve(_dirname, '../../../functions'),
  envDir: resolve(_dirname, '../../../'),
  envPrefix: 'APP_',

  resolve: {
    // dedupe: ['vue'],
    alias,
  },

  // optimizeDeps: {
  //   exclude: ['vue'],
  // },

  plugins: [
    preview,
    uiEngine(),
    autoImports,
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
