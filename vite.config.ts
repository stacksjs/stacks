import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import { alias } from './.stacks/src/config'

// eslint-disable-next-line no-console
console.log('alias', alias)

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: alias.default,
  },

  server: {
    open: '/components/index.html',
  },

  plugins: [Vue()],
})
