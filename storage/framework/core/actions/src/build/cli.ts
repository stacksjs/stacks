import { $ } from 'bun'
import { log } from '@stacksjs/cli'
import { buddyPath } from '@stacksjs/path'

log.info('Building CLI...')

$.cwd(buddyPath())
await $`bun ${buddyPath('build.ts')}`
