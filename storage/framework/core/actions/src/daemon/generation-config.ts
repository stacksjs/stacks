import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const generationConfigPath = 'config/buddy.json'
export const generationTasks = ['imports', 'migrations', 'types'] as const
export type GenerationTask = typeof generationTasks[number]

export interface ProjectGenerationConfig {
  tasks: GenerationTask[]
  autoCommit: boolean
}

/** Read project policy without loading its Bun config, environment or code. */
export function readGenerationConfig(root: string): ProjectGenerationConfig | null {
  let content: string
  try {
    content = readFileSync(join(root, generationConfigPath), 'utf8')
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return null
    throw error
  }

  const { generation } = JSON.parse(content) as {
    generation?: { enabled?: boolean, autoCommit?: boolean, imports?: boolean, migrations?: boolean, types?: boolean }
  }
  if (generation?.enabled !== true)
    return null

  const tasks = generationTasks.filter(task => generation[task] !== false)
  return tasks.length ? { tasks, autoCommit: generation.autoCommit === true } : null
}
