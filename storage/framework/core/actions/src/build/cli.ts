import { $ } from 'bun'
import { log } from '@stacksjs/cli'
import { buddyPath } from '@stacksjs/path'

log.info('Building CLI...')

await $`bun ${buddyPath('compile.ts')}`
