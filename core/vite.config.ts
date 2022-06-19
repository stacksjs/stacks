import type { UserConfig } from './stacks'
import { Stacks, alias, defineConfig, buildVueComponents as vueComponents } from './stacks'

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
  // console.log('config is', config)
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
