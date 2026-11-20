import type { GenerationTask, ProjectGenerationConfig } from '@stacksjs/actions/daemon/generation-config'
import { generationTasks, readGenerationConfig } from '@stacksjs/actions/daemon/generation-config'
import { prepareCommitApproval, withApprovalLock } from './generation-approval'
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

  if (config.commitApproval)
    await withApprovalLock(root, () => runGeneration(root, tasks, config))
  else
    await runGeneration(root, tasks, config)
}

async function runGeneration(root: string, tasks: GenerationTask[], config: ProjectGenerationConfig): Promise<void> {
  const commit = config.autoCommit ? prepareAutomaticCommit(root, tasks) : undefined
  const failures: string[] = []
  for (const task of tasks) {
    const firstFailure = failures.length
    const approval = config.commitApproval ? prepareCommitApproval(root, task, config.tasks) : undefined
    const guard = approval?.guard
    try {
      if (task === 'imports') {
        const { generateAutoImportFiles } = await import('@stacksjs/server')
        await generateAutoImportFiles({ guard })
      }
      else if (task === 'migrations') {
        const { generateMigrations, siblingMigrationDialects } = await import('@stacksjs/database')
        for (const dialect of [undefined, ...await siblingMigrationDialects()]) {
          const result = await generateMigrations({ dialect, fromDb: false, allowDestructive: false, trackIgnored: false, guard })
          if (resultFailed(result))
            failures.push(`${dialect ?? 'configured dialect'} migrations: ${resultError(result)}`)
        }
      }
      else {
        const { generateRouteNames } = await import('@stacksjs/actions/generate/action-types')
        const { buildDatabaseSchema } = await import('@stacksjs/orm')
        await generateRouteNames({ strict: true, guard })
        const { errors } = await buildDatabaseSchema({ strict: true, guard })
        failures.push(...errors.map(error => `${error.file}: ${error.error}`))
      }
    }
    catch (error) {
      failures.push(`${task}: ${error instanceof Error ? error.message : String(error)}`)
    }
    if (approval) {
      const current = readGenerationConfig(root)
      approval.finish(failures.length === firstFailure && current?.commitApproval === true && current.tasks.includes(task))
    }
  }

  if (failures.length > 0)
    throw new Error(failures.join('\n'))
  if (readGenerationConfig(root)?.autoCommit)
    commit?.()
}
