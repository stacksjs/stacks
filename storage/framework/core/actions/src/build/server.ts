import { $ } from 'bun'
import { log } from '@stacksjs/cli'
import { frameworkPath } from '@stacksjs/path'

log.info('Building Server...')

$.cwd(frameworkPath('cloud'))

await $`bun build.ts`
