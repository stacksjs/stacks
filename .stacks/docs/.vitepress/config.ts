import userConfig from '../../../config/docs'
import { frameworkDefaults } from '@stacksjs/docs'
import type { UserConfig } from 'vitepress'

const resolvedUserConfig = {
  ...frameworkDefaults,
  ...userConfig,
} satisfies UserConfig

export default resolvedUserConfig
