import { resolve } from 'pathe'
import { defineConfig } from 'vite'
import type { ViteConfig } from '..'
import { uiEngine } from '..'

const config: ViteConfig = {
  root: resolve(__dirname, '../../examples/vue'),

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
