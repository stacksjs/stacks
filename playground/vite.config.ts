import { defineConfig } from 'vite'
import { alias } from '../alias'
import Test from '../packages/vite/src/test'
// import Stacks from '../packages/vite/src/index'
import Vue from '@vitejs/plugin-vue'

/** @type {import('vite').UserConfig} */
const config = {
  resolve: {
    alias,
  },

  plugins: [
    // Vue(),
    Test(),

    // Stacks(),
  ],
}

// https://vitejs.dev/config
export default defineConfig(({ command }) => {
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
