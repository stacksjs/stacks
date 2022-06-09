import { defineConfig } from 'vite'
import { alias } from '../alias'
import Stacks from '../packages/vite/src/index'

/** @type {import('vite').UserConfig} */
const config = {
  resolve: {
    alias,
  },

  plugins: [
    Stacks(),
    // Unocss({
    //   configFile: '../packages/core/unocss.config.ts',
    //   mode: 'vue-scoped',
    // }),
  ],
}

// https://vitejs.dev/config
export default defineConfig(({ command }) => {
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
