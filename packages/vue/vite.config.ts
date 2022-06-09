import { resolve } from 'pathe'
import type { UserConfig } from 'vite'
import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import { Stacks } from '@ow3/vite-plugin-hello-world'

// https://vitejs.dev/config/
const config: UserConfig = {
  plugins: [
    Stacks({
      customElement: true,
    }),
  ],
}

// https://vitejs.dev/config
export default defineConfig(({ command }) => {
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
