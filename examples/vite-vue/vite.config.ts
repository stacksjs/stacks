import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import { alias } from '../../alias'

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    dedupe: ['vue'],
    alias,
  },

  plugins: [Vue()],
})
