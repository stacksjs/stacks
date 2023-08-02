import { defineConfig } from 'vitepress'
import { type UserConfig } from 'vitepress'
import { docs } from '@stacksjs/config'

export default defineConfig(docs as UserConfig)
