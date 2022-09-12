import { resolve } from 'pathe'
import type { ViteConfig } from '../core'
import { defineConfig } from '../core'
import { inspect, uiEngine } from '../core/stacks'

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
