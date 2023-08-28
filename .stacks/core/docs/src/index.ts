import { defineConfig } from 'vitepress'
import { path as p } from '@stacksjs/path'
import { app, docs } from '@stacksjs/config'
import { docsEngine } from '../../vite/src/plugin/docs'

const defaultConfig = {
  title: 'StacksJS',
  vite: {
    envDir: p.projectPath(),
    envPrefix: 'FRONTEND_',
    server: {
      host,
      port: 3333,
      open: true,
    },

    plugins: [
      docsEngine(),
    ],
  },
}

const config = {
  ...defaultConfig,
  ...docs,
}

export default defineConfig(config)
