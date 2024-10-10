import { log } from '@stacksjs/cli'
import { frameworkPath } from '@stacksjs/path'
import { $ } from 'bun'

log.info('Building Server...')

$.cwd(frameworkPath('cloud'))

await $`bun build.ts`
