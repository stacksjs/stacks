import type { AddOptions, BuildOptions, CLI } from '@stacksjs/types'
import { ExitCode } from '@stacksjs/types'
import { prompts } from '@stacksjs/cli'
import { invoke } from '@stacksjs/actions/add'

async function add(buddy: CLI) {
  const descriptions = {
    add: 'Add a stack to your project (coming soon)',
    table: 'Add the Table Stack to your project',
    calendar: 'Add the Calendar Stack to your project',
    all: 'Add all stacks',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('add', descriptions.add)
    .option('-t, --table', descriptions.table, { default: false })
    .option('-c, --calendar', descriptions.calendar, { default: false })
    .option('-a, --all', descriptions.all, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
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

      await invoke(options)

      process.exit(ExitCode.Success)
    })

  buddy
    .command('add:table', descriptions.table)
    .option('-t, --table', descriptions.table, { default: true })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: BuildOptions) => {
      await invoke(options)
    })

  buddy
    .command('add:calendar', descriptions.calendar)
    .option('-t, --calendar', descriptions.calendar, { default: true })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: BuildOptions) => {
      await invoke(options)
    })
}

function hasNoOptions(options: AddOptions) {
  return !options.all && !options.table && !options.calendar
}

export { add }
