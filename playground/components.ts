import type { UserConfig } from '../.stacks'
import { Stacks, alias, defineConfig, buildVueComponents as vueComponents } from '../.stacks'

// eslint-disable-next-line no-console
console.log('config is here ')

// https://vitejs.dev/config/
const config: UserConfig = {
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
