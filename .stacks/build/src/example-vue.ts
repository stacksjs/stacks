import { defineConfig } from 'vite'
import type { ViteConfig } from '../src'
import { uiEngine } from '../src'
import { examplesPath } from '../utils/src'

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
