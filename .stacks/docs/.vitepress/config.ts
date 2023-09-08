import { config } from '@stacksjs/config'
import { frameworkDefaults } from '@stacksjs/docs'
import type { UserConfig } from 'vitepress'

const userConfig = config.docs

const resolvedUserConfig: UserConfig = {
  ...frameworkDefaults,
  ...userConfig,
}

export default resolvedUserConfig
