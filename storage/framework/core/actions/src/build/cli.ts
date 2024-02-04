import { log } from '@stacksjs/cli'
import { buddyPath } from '@stacksjs/path'
import { $ } from 'bun'

log.info('Building CLI...')

await $`bun ${buddyPath('compile.ts')}`
