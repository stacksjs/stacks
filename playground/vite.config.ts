import { defineConfig } from 'vite'
import { Stacks, alias } from '../packages/vite/src'

// eslint-disable-next-line no-console
console.log('test');

/** @type {import('vite').UserConfig} */
const config = {
  resolve: {
    // dedupe: ['vue'],
    alias
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
