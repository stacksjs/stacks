import { resolve } from 'path'
import type { UserConfig } from 'vite'
import { defineConfig } from 'vite'
import { alias } from './config/alias'
import { Stacks, buildVueComponents } from './packages/core/src'

const p = resolve(__dirname, 'packages/components/src/index.ts')

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

  build: buildVueComponents(p),
}

export default defineConfig(({ command, mode }) => {
  // console.log('config is', config)
  // eslint-disable-next-line no-console
  console.log('mode is', mode)

  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
