import { resolve } from 'pathe'
import { defineConfig } from 'vite'
import type { ViteConfig } from '..'
import { inspect, uiEngine } from '..'

const config: ViteConfig = {
  root: resolve(__dirname, '../../examples/vue'),

  server: {
    port: 3333,
    open: true,
  },

  plugins: [
    inspect,

    uiEngine(),
  ],
}

export default defineConfig(() => {
  return config
})
