import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import { alias } from '../alias'
import { Stacks } from '@ow3/vite-plugin-hello-world'

/** @type {import('vite').UserConfig} */
const config = {
  plugins: [
    Vue(),

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
