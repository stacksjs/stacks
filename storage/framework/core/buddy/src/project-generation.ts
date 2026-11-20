import { generationTasks, readGenerationConfig } from '@stacksjs/actions/daemon/generation-config'
import { prepareCommitApproval } from './generation-approval'
import { prepareAutomaticCommit } from './generation-changes'
import { resultError, resultFailed } from './result'

/** Run once inside the project, under its installed framework and Bun config. */
export async function generateProject(root: string, selection: string): Promise<void> {
  const config = readGenerationConfig(root)
  if (!config)
    return
  const requested = new Set(selection.split(','))
  const tasks = generationTasks.filter(task => requested.has(task) && config.tasks.includes(task))
  if (tasks.length === 0)
    return

  const commit = config.autoCommit ? prepareAutomaticCommit(root, tasks) : undefined
  const propose = config.commitApproval ? prepareCommitApproval(root, tasks, config.tasks) : undefined
  const failures: string[] = []
  for (const task of tasks) {
    try {
      if (task === 'imports') {
        const { generateAutoImportFiles } = await import('@stacksjs/server')
        await generateAutoImportFiles()
      }
      else if (task === 'migrations') {
        const { generateMigrations, siblingMigrationDialects } = await import('@stacksjs/database')
        for (const dialect of [undefined, ...await siblingMigrationDialects()]) {
          const result = await generateMigrations({ dialect, fromDb: false, allowDestructive: false, trackIgnored: false })
          if (resultFailed(result))
            failures.push(`${dialect ?? 'configured dialect'} migrations: ${resultError(result)}`)
        }
      }
      else {
        const { generateRouteNames } = await import('@stacksjs/actions/generate/action-types')
        const { buildDatabaseSchema } = await import('@stacksjs/orm')
        await generateRouteNames({ strict: true })
        const { errors } = await buildDatabaseSchema({ strict: true })
        failures.push(...errors.map(error => `${error.file}: ${error.error}`))
      }
    }
    catch (error) {
      failures.push(`${task}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (failures.length > 0)
    throw new Error(failures.join('\n'))
  const current = readGenerationConfig(root)
  if (current?.commitApproval && current.tasks.join() === config.tasks.join())
    propose?.()
  if (current?.autoCommit)
    commit?.()
}
