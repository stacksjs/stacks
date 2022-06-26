import type { ViteConfig } from '../core'
import { buildVueComponents as vueComponents } from '../builds'
import { defineConfig, Stacks } from '../core'
import alias from '../../../config/alias'

// https://vitejs.dev/config/
const config: ViteConfig = {
  resolve: {
    dedupe: ['vue'],
    alias,
  },

  optimizeDeps: {
    exclude: ['vue', '@vueuse/core', 'unocss/vite'],
  },

  plugins: [
    Stacks(),
  ],

  build: vueComponents(),
}

export default defineConfig(({ command }) => {
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
