import { resolve } from 'pathe'
import type { ViteConfig } from '..'
import { defineConfig, inspect, uiEngine } from '..'

const config: ViteConfig = {
  root: resolve(__dirname, '../../examples/web-components'),

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
