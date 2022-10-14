import { defineConfig } from 'vite'
import type { ViteConfig } from '@stacksjs/types'
import { examplesPath } from '@stacksjs/utils'
import { uiEngine } from '../src'

const config: ViteConfig = {
  root: examplesPath('vue-components'),

  server: {
    port: 3333,
    open: true,
  },

  plugins: [
    uiEngine(),
  ],
}

export default defineConfig(() => {
  return config
})
