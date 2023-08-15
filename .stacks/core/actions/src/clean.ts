import { log } from '@stacksjs/logging'
import { projectPath } from '@stacksjs/path'
import { rimraf as del } from '@stacksjs/utils'

log.info('Running clean command...')

await del([
  projectPath('bun.lockb'),
  projectPath('yarn.lock'),
  projectPath('node_modules/'),
  projectPath('.stacks/dist'),
  projectPath('.stacks/**/dist'),
])
