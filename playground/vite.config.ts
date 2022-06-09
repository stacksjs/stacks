import { defineConfig } from 'vite'
import { Stacks, alias, buildVueComponents, buildWebComponents } from '../packages/vite/src'

/** @type {import('vite').UserConfig} */
const config = {
  resolve: {
    dedupe: ['vue'],
    alias,
  },

  plugins: [
    Stacks(),
  ],
}

// https://vitejs.dev/config
export default defineConfig(({ command }) => {
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
