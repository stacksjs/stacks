import type { CLI, DeployOptions } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'
import { intro, outro } from '@stacksjs/cli'
import { Action, ExitCode } from '@stacksjs/types'
import { brian } from '@stacksjs/actions/deploy/domains'

async function deploy(buddy: CLI) {
  const descriptions = {
    deploy: 'Reinstalls your npm dependencies',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('deploy', descriptions.deploy)
    .option('--verbose', descriptions.verbose, { default: false })
    .option('-a, --a', descriptions.verbose)
    .action(async (options: DeployOptions) => {
      // const perf = await intro('buddy deploy')
      // const result = await runAction(Action.Deploy, options)
      // console.log('result', result)
      // console.log(buddy.args)
      // console.log(options.a)
      console.log(brian(options));


      // if (result.isErr()) {
      //   outro('While running the `buddy deploy`, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
      //   process.exit()
      // }

      // outro('Deployment succeeded.', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
  .command('deploy:domains', descriptions.deploy)
  .option('--verbose', descriptions.verbose, { default: false })
  .option('-a, --a', descriptions.verbose)
  .option('--test', descriptions.verbose)
  .action(async (options: DeployOptions) => {
    // const perf = await intro('buddy deploy')
    // const result = await runAction(Action.Deploy, options)
    // console.log('result', result)
    // console.log(buddy.args)
    // console.log(options.a)
    console.log(brian(options));
    console.log


    // if (result.isErr()) {
    //   outro('While running the `buddy deploy`, there was an issue', { startTime: perf, useSeconds: true, isError: true }, result.error)
    //   process.exit()
    // }

    // outro('Deployment succeeded.', { startTime: perf, useSeconds: true })
    process.exit(ExitCode.Success)
  })


}

export { deploy }
