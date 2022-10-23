import { defineConfig } from 'vite'
import type { ViteConfig } from '@stacksjs/types'
import { examplesPath } from '@stacksjs/path'
import { alias } from '../../../alias'
import { uiEngine } from '.'

export const webComponentsExampleConfig: ViteConfig = {
  root: examplesPath('web-components'),

  resolve: {
    alias,
  },

  server: {
    port: 3333,
    open: true,
  },

  plugins: [
    uiEngine(true),
  ],
}

export default defineConfig(() => {
  return webComponentsExampleConfig
})
