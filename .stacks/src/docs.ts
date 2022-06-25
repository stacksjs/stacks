import type { UserConfig } from 'vitepress'
import { defineConfig } from 'vitepress'
import { docs } from './config'

export type DocsConfig = UserConfig

export default defineConfig(docs)
