import type { UserConfig } from 'vite'
import { defineConfig } from 'vite'
import { Stacks, alias } from '@ow3/stacks'

// https://vitejs.dev/config/
const config: UserConfig = {
  resolve: {
    alias,
  },

  optimizeDeps: {
    exclude: ['vue', '@vueuse/core', 'unocss/vite'],
  },

  plugins: [
    Stacks(),
  ],
}

export default defineConfig(({ command, mode }) => {
  // eslint-disable-next-line no-console
  console.log('mode is', mode)

  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
