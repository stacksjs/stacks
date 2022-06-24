import { defineConfig, UserConfig } from 'vitepress'
import { docs } from './config'

export type DocsConfig = UserConfig

export default defineConfig(docs)
