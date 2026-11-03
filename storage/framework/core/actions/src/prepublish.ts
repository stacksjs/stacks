import { log } from '@stacksjs/logging'

log.info('Running prepublish command...')

// Right before we publish, we need to build Stacks: the build/stacks action,
// the one `buddy build:stacks` runs, which builds the CLI and then the core
// packages and exits non-zero if either fails. This used to run a
// `build:stacks` npm script that the framework's package.json does not have,
// so it failed every time without building anything (stacksjs/stacks#3159).
// An action module is a script: runAction runs it as one.
// eslint-disable-next-line ts/no-top-level-await
await import('./build/stacks')

log.success('Prepublishing completed')
