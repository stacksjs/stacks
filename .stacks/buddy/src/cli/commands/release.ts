import type { CLI, ReleaseOptions } from '@stacksjs/types'
import { invoke } from '@stacksjs/actions/buddy/release'

const descriptions = {
  release: 'Release a new version of your libraries/packages',
  debug: 'Enable debug mode',
}

async function release(stacks: CLI) {
  stacks
    .command('release', descriptions.release)
    .option('--debug', descriptions.debug, { default: true }) // it's on by default because it requires manual input
    .action(async (options: ReleaseOptions) => {
      await invoke(options)
    })
}

export { release }
