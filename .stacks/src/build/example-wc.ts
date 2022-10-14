import { defineConfig } from 'vite'
import type { ViteConfig } from '..'
import { uiEngine } from '..'
import { examplesPath } from '../../utils/src'

const config: ViteConfig = {
  root: examplesPath('web-components'),

  server: {
    port: 3333,
    open: true,
  },

  plugins: [
    uiEngine(true),
  ],
}

export default defineConfig(() => {
  return config
})
