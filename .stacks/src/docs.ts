import type { UserConfig } from 'vitepress'
import { defineConfig } from 'vitepress'
import docs from '../../config/docs'

export type DocsConfig = UserConfig

export default defineConfig(docs)
