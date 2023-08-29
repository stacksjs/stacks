import { defineConfig } from 'vitepress'
import { path as p } from '@stacksjs/path'
import { docs, app } from '@stacksjs/config'
import { docsEngine } from '../../vite/src/plugin/docs'

const defaultConfig = {
  title: `${app.name} Documentation`,

  vite: {
    envDir: p.projectPath(),
    envPrefix: 'FRONTEND_',

    server: {
      host: 'docs.stacks.test',
      port: 3333,
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
