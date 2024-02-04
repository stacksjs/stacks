import { log } from '@stacksjs/cli'
import { buddyPath, frameworkPath } from '@stacksjs/path'
import { $ } from 'bun'

log.info('Building Server...')

$.cwd(frameworkPath('server'))

await $`bun build.ts`
