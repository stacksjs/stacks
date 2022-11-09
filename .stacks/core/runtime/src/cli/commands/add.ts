import type { AddOptions, BuildOptions, CLI } from '@stacksjs/types'
import { ExitCode } from '@stacksjs/types'
import { prompts } from '@stacksjs/cli'
import { add as startAddProcess } from '../actions/add'

const descriptions = {
  add: 'Add a stack to your project (coming soon)',
  table: 'Add the Table Stack to your project',
  calendar: 'Add the Calendar Stack to your project',
  all: 'Add all stacks',
  debug: 'Enable debug mode',
}

async function build(stacks: CLI) {
  stacks
    .command('add', descriptions.add)
    .option('-t, --table', descriptions.table, { default: false })
    .option('-c, --calendar', descriptions.calendar, { default: false })
    .option('-a, --all', descriptions.all, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: BuildOptions) => {
      if (hasNoOptions(options)) {
        const answers = await prompts.multiselect({
          type: 'multiselect',
          name: 'add',
          message: 'Which stack/s are you trying to add?',
          choices: [
            { title: 'Calendar', value: 'calendar' },
            { title: 'Table', value: 'table' },
          ],
        })

        // creates an object out of array and sets answers to true
        options = answers.reduce((a: any, v: any) => ({ ...a, [v]: true }), {})
      }

      await startAddProcess(options)

      process.exit(ExitCode.Success)
    })

  stacks
    .command('add:table', descriptions.table)
    .option('-t, --table', descriptions.table, { default: true })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: BuildOptions) => {
      await startAddProcess(options)
    })

  stacks
    .command('add:calendar', descriptions.calendar)
    .option('-t, --calendar', descriptions.calendar, { default: true })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: BuildOptions) => {
      await startAddProcess(options)
    })
}

function hasNoOptions(options: AddOptions) {
  return !options.all && !options.table && !options.calendar
}

export { build }
