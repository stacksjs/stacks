import { resolve } from 'node:path'
import Inspect from 'vite-plugin-inspect'
import Vue from '@vitejs/plugin-vue'
import type { ViteConfig } from '../core'
import { defineConfig } from '../core'

const config: ViteConfig = {
  root: resolve(__dirname, '../../examples/vue'),

  server: {
    port: 3333,
    open: true,
  },

  plugins: [
    Inspect(),

    Vue(),
  ],
}

export default defineConfig(() => {
  return config
})
