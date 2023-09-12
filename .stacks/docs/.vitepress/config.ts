import userConfig from '../../../config/docs'
import { frameworkDefaults } from '@stacksjs/docs'
import type { UserConfig } from 'vitepress'

const resolvedUserConfig: UserConfig = {
  ...frameworkDefaults,
  ...userConfig,
}

export default resolvedUserConfig
