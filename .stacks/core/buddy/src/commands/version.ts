import type { CLI, FreshOptions } from '@stacksjs/types'

// import { bold, dim, green, intro } from '@stacksjs/cli'
// import { filesystem } from '@stacksjs/storage'
// import { log } from '@stacksjs/logging'
// import { frameworkPath } from '@stacksjs/path'

async function version(buddy: CLI) {
  // const { fs } = filesystem

  const descriptions = {
    version: 'Retrieving Stacks build version',
  }

  buddy
    .command('version', descriptions.version)
    .action(async (options: FreshOptions) => {
      // const perf = await intro('buddy version')

      // const depVersions = JSON.parse(fs.readFileSync('./package.json', 'utf8'))
      // const nodeVersion = depVersions.engines.node.replace('>=v', '')
      // const pnpmVersion = depVersions.engines.pnpm.replace('>=', '')
      // const stacksVersion = JSON.parse(fs.readFileSync(frameworkPath('/package.json'), 'utf8'))

      // log.info(green(bold('Stacks: ')) + dim(` ${stacksVersion.version}`))
      // log.info(green(bold('node: ')) + dim(`   ${nodeVersion}`))
      // log.info(green(bold('pnpm: ')) + dim(`   ${pnpmVersion}`))
    })
}

export { version }
