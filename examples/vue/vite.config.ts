import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    dedupe: ['vue'],
  },

  plugins: [Vue()],
})
