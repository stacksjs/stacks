import { defineConfig } from 'vite'
import { alias } from '../alias'
import Stacks from '../packages/vite/src/index'
import Inspect from 'vite-plugin-inspect'

/** @type {import('vite').UserConfig} */
const config = {
  resolve: {
    alias,
  },

  plugins: [
    Inspect(),

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
