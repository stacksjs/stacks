import { setTimeout } from 'node:timers/promises'
import * as p from '@clack/prompts'
import color from 'picocolors'
import { runCommand } from '@stacksjs/cli'
import { path } from '@stacksjs/path'

async function main() {
  console.clear()

  await setTimeout(1000)

  p.intro(`Stacks ${color.bgCyan(color.black(' create-app '))}`)

  const defaultFolderPath = './stacks'

  const project = await p.group(
    {
      path: () =>
        p.text({
          message: 'Where should we create your project?',
          initialValue: defaultFolderPath,
          placeholder: defaultFolderPath,
          validate: (value) => {
            if (!value)
              return 'Please enter a path.'
            if (value[0] !== '.')
              return 'Please enter a relative path.'
          },
        }),
      type: ({ results }) =>
        p.select({
          message: `Pick your flavor ("${results.path}")`,
          initialValue: 'default',
          maxItems: 3,
          options: [
            { value: 'default', label: 'Default (UI with API)' },
            { value: 'ui', label: 'UI' },
            { value: 'api', label: 'API' },
          ],
        }),
      modules: () =>
        p.multiselect({
          message: 'Select additional modules.',
          initialValues: ['prettier', 'eslint'],
          options: [
            { value: 'database', label: 'Database', hint: 'recommended' },
            { value: 'search', label: 'Search', hint: 'recommended' },
            {
              value: 'notifications',
              label: 'Notifications (email, sms, chat)',
            },
            { value: 'cache', label: 'Cache' },
          ],
        }),
    },
    {
      onCancel: () => {
        p.cancel('Operation cancelled.')
        process.exit(0)
      },
    },
  )

  const s = p.spinner()

  s.start('Creating new project')
  await runCommand(`${path.projectPath('buddy')} new ${project.path}`)
  s.stop('Created new project')

  const nextSteps = `cd ${project.path}        \nbun run dev`

  p.note(nextSteps, 'Next steps.')

  p.outro(
    `Problems? ${color.underline(color.cyan('https://github.com/stacksjs/stacks/issues'))}`,
  )
}

main().catch(console.error)
