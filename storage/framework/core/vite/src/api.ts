import { defineConfig } from 'vite'
import { path as p } from '@stacksjs/path'

export default defineConfig({
  base: '/api/',

  root: p.frameworkPath('api'),
  publicDir: p.publicPath(),
  envDir: p.projectPath(),

  server: {
    port: 3001,
    proxy: {
      '/': 'http://127.0.0.1:3999',
    },
  },
})
