import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue-jsx'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3030,
  },
  preview: {
    port: 8080,
  },
})
