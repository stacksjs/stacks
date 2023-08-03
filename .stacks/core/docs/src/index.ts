import { defineConfig } from 'vitepress'
import { type UserConfig } from 'vitepress'
import { docs } from '@stacksjs/config'

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
export default defineConfig(docs as UserConfig)
