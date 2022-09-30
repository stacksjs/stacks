import { resolve } from 'pathe'
import { defineConfig } from 'vite'
import type { ViteConfig } from '..'
import { uiEngine } from '..'

const config: ViteConfig = {
  root: resolve(__dirname, '../../examples/web-components'),

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
