import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import alias from './stacks/src/alias'

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias,
  },

  server: {
    open: '/components/index.html',
  },

  plugins: [Vue()],
})
