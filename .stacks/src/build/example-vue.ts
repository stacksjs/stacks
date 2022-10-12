import { defineConfig } from 'vite'
import type { ViteConfig } from '..'
import { uiEngine } from '..'
import { examplesPath } from '../utils'

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
