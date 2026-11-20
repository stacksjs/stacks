import type { FSWatcher } from 'node:fs'
import type { GenerationTask } from './generation-config'
import { accessSync, constants, existsSync, lstatSync, mkdirSync, watch } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import process from 'node:process'
import { listProjects, projectCliEntry, stacksHome } from '@stacksjs/path'
import { machineEnvironment } from './environment'
import { generationConfigPath, generationTasks, readGenerationConfig } from './generation-config'

const DEBOUNCE_MS = 750
const WORKER_TIMEOUT_MS = 120_000

const sourceDirectories = [
  'app', 'config', 'routes', 'database/migrations', 'resources/functions', 'resources/emails',
  'storage/framework/defaults/app', 'storage/framework/defaults/functions',
  'storage/framework/defaults/resources/emails',
] as const

const parentDirectories = [
  '', 'config', 'database', 'resources', 'storage', 'storage/framework', 'storage/framework/defaults',
  'storage/framework/defaults/resources', 'node_modules', 'node_modules/@stacksjs', 'pantry', 'pantry/@stacksjs',
] as const
const directories = new Set<string>([...parentDirectories, ...sourceDirectories])
const projectInputs = /^(?:package\.json|bun\.lockb?|pantry\.lock|\.env(?:\..+)?|storage\/framework\/discovered-packages\.json)$/
const installedInputs = /^(?:node_modules|pantry)\/@stacksjs\/(?:buddy|defaults)$/

export function generationForPath(file: string): readonly GenerationTask[] {
  if (file === generationConfigPath || projectInputs.test(file) || installedInputs.test(file))
    return generationTasks
  if (file === 'database' || /^database\/migrations(?:\/|$)/.test(file))
    return file.endsWith('.sql') || !file.split('/').at(-1)?.includes('.') ? ['types'] : []
  if (file === 'routes' || /^(?:routes\/|app\/Routes\.[jt]s$)/.test(file))
    return ['types']
  if (file === 'resources' || /^(?:resources\/functions|storage\/framework\/defaults\/functions|(?:storage\/framework\/defaults\/)?resources\/emails)(?:\/|$)/.test(file))
    return /\.(?:[cm]?[jt]s|stx|html)$/.test(file) || !file.split('/').at(-1)?.includes('.') ? ['imports'] : []
  if (directories.has(file))
    return sourceDirectories.some(dir => dir === file || dir.startsWith(`${file}/`)) ? generationTasks : []

  if (/^(?:config\/|(?:storage\/framework\/defaults\/)?app\/(?:Models|Enums)(?:\/|$))/.test(file))
    return /\.[cm]?[jt]s$/.test(file) || !file.split('/').at(-1)?.includes('.') ? generationTasks : []
  if (/^(?:storage\/framework\/defaults\/)?app\/(?:Actions|Controllers|Jobs|Listeners|Middleware|Policies)(?:\/|$)/.test(file))
    return ['imports']
  if (/^(?:storage\/framework\/defaults\/)?app\/.*\.[cm]?[jt]s$/.test(file))
    return ['migrations', 'types']
  return []
}

interface ProjectWatch {
  root: string
  entry?: string
  error?: string
  configError?: string
  watchers: Map<string, { identity: string, watcher: FSWatcher }>
  pending: Set<GenerationTask>
  timer?: ReturnType<typeof setTimeout>
}

export interface GenerationStatus {
  watched: number
  queued: number
  running: string | null
  failures: Array<{ path: string, error: string }>
}

function brief(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** An opt-in project must have the generation command in its own CLI. */
function generationEntry(root: string): string | undefined {
  const entry = projectCliEntry(root)
  if (entry && existsSync(join(dirname(entry), `project-generation${extname(entry)}`)))
    return entry
}

function launch(root: string, entry: string, tasks: readonly GenerationTask[]) {
  const args = ['generate:project', '--tasks', tasks.join(',')]
  const shim = join(root, 'buddy')
  let command: string[]
  const env = machineEnvironment()
  try {
    accessSync(shim, constants.X_OK)
    command = [shim, ...args]
  }
  catch {
    // A package-based application can omit the shell shim.
    const conditions = existsSync(join(root, 'node_modules/@stacksjs/env/src/index.ts')) ? ['--conditions', 'development'] : []
    const pantry = join(root, 'pantry')
    if (existsSync(pantry))
      env.NODE_PATH = [join(root, 'node_modules'), pantry].join(process.platform === 'win32' ? ';' : ':')
    command = [process.execPath, '--no-install', ...conditions, entry, ...args]
  }

  return Bun.spawn(command, {
    cwd: root,
    env: { ...env, LOG_LEVEL: 'warn' },
    stdin: 'ignore',
    stdout: 'ignore',
    stderr: 'pipe',
    detached: true,
  })
}

function killWorker(child: ReturnType<typeof launch>): void {
  try {
    if (process.platform === 'win32')
      child.kill('SIGKILL')
    else
      process.kill(-child.pid, 'SIGKILL')
  }
  catch {
    // It can exit before the signal reaches it.
  }
}

async function workerErrors(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let tail = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done)
      return (tail + decoder.decode()).trim()
    tail = (tail + decoder.decode(value, { stream: true })).slice(-12_000)
  }
}

/** One native event loop for the registry. A single short-lived project worker runs at a time. */
export class GenerationSupervisor {
  private projects = new Map<string, ProjectWatch>()
  private ready = new Set<ProjectWatch>()
  private active?: { project: ProjectWatch, child: ReturnType<typeof launch>, done: Promise<void> }
  private registry?: FSWatcher
  private registryTimer?: ReturnType<typeof setTimeout>
  private closed = false
  private watched = 0

  constructor(private log: (line: string) => void, private onChange: () => void) {}

  start(): void {
    const dir = stacksHome('projects')
    mkdirSync(dir, { recursive: true })
    this.registry = watch(dir, (_, file) => {
      if (file && !file.endsWith('.json'))
        return
      clearTimeout(this.registryTimer)
      this.registryTimer = setTimeout(() => this.syncRegistry(), DEBOUNCE_MS)
    })
    this.registry.on('error', error => this.log(`generation registry watcher: ${brief(error)}`))
    this.syncRegistry()
  }

  get size(): number {
    return this.watched
  }

  status(): GenerationStatus {
    return {
      watched: this.watched,
      queued: [...this.projects.values()].filter(project => project.pending.size > 0).length,
      running: this.active?.project.root ?? null,
      failures: [...this.projects.values()].flatMap(project => {
        const error = project.configError ?? project.error
        return error ? [{ path: project.root, error }] : []
      }),
    }
  }

  private syncRegistry(): void {
    if (this.closed)
      return

    const roots = new Set(listProjects().map(project => project.path))
    for (const [root, project] of this.projects) {
      if (!roots.has(root)) {
        this.remove(project)
        this.projects.delete(root)
      }
    }

    for (const root of roots) {
      if (this.projects.has(root))
        continue
      const project: ProjectWatch = { root, watchers: new Map(), pending: new Set() }
      this.projects.set(root, project)
      this.configure(project)
    }

    this.onChange()
  }

  private configure(project: ProjectWatch): void {
    const previous = project.entry
    let optedIn = false
    try {
      optedIn = readGenerationConfig(project.root) !== null
      project.entry = optedIn ? generationEntry(project.root) : undefined
      const error = optedIn && !project.entry ? 'Update the project Stacks runtime to enable background generation.' : undefined
      if (error && error !== project.configError)
        this.log(`generation for ${project.root}: ${error}`)
      project.configError = error
    }
    catch (error) {
      project.entry = undefined
      project.configError = brief(error)
      this.log(`generation config for ${project.root}: ${project.configError}`)
    }

    if (!previous && project.entry)
      this.watched++
    else if (previous && !project.entry) {
      this.watched--
      clearTimeout(project.timer)
      project.pending.clear()
      this.ready.delete(project)
    }

    // Dormant projects need only the root and config directory so adding the
    // policy activates them. Install directories are watched only after opt-in.
    const paths = new Map<string, boolean>([['', false], ['config', Boolean(project.entry)]])
    if (optedIn) {
      for (const dir of parentDirectories)
        if (!paths.has(dir)) paths.set(dir, false)
    }
    if (project.entry) {
      for (const dir of sourceDirectories)
        paths.set(dir, true)
    }

    for (const [dir, entry] of project.watchers) {
      if (paths.has(dir))
        continue
      entry.watcher.close()
      project.watchers.delete(dir)
    }
    for (const [dir, recursive] of paths)
      this.watchDirectory(project, dir, recursive)

    if (project.entry && project.entry !== previous)
      this.enqueue(project, generationTasks)
    this.onChange()
  }

  private watchDirectory(project: ProjectWatch, dir: string, recursive: boolean): void {
    const location = join(project.root, dir)
    const previous = project.watchers.get(dir)
    let identity: string | undefined
    try {
      const info = lstatSync(location)
      if (info.isDirectory())
        identity = `${info.dev}:${info.ino}:${recursive}`
    }
    catch {
      // A parent remains watched until this directory exists.
    }
    if (identity === previous?.identity)
      return
    previous?.watcher.close()
    project.watchers.delete(dir)
    if (!identity)
      return

    try {
      const watcher = watch(location, { recursive }, (_, name) => {
        if (this.closed || this.projects.get(project.root) !== project)
          return
        const file = name ? `${dir ? `${dir}/` : ''}${name.replaceAll('\\', '/')}` : dir
        if (!name || directories.has(file) || file === generationConfigPath || installedInputs.test(file) || projectInputs.test(file))
          this.configure(project)
        if (project.entry)
          this.enqueue(project, name ? generationForPath(file) : generationTasks)
      })
      watcher.on('error', (error) => {
        this.log(`generation watcher for ${location}: ${brief(error)}`)
        watcher.close()
        if (project.watchers.get(dir)?.watcher === watcher)
          project.watchers.delete(dir)
      })
      project.watchers.set(dir, { identity, watcher })
    }
    catch (error) {
      this.log(`generation watcher for ${location}: ${brief(error)}`)
    }
  }

  private enqueue(project: ProjectWatch, tasks: readonly GenerationTask[]): void {
    if (tasks.length === 0)
      return
    for (const task of tasks)
      project.pending.add(task)
    this.ready.delete(project)
    clearTimeout(project.timer)
    project.timer = setTimeout(() => {
      project.timer = undefined
      this.ready.add(project)
      this.pump()
    }, DEBOUNCE_MS)
  }

  private pump(): void {
    if (this.active || this.closed)
      return

    for (const project of this.ready) {
      this.ready.delete(project)
      const tasks = [...project.pending]
      project.pending.clear()
      if (!project.entry)
        continue

      try {
        const child = launch(project.root, project.entry, tasks)
        const timeout = setTimeout(() => killWorker(child), WORKER_TIMEOUT_MS)
        const done = Promise.all([child.exited, workerErrors(child.stderr)]).then(([code, stderr]) => {
          project.error = code === 0 ? undefined : stderr.split('\n').at(-1) || `Generator exited with status ${code}.`
          if (code !== 0 && !this.closed)
            this.log(`generation failed for ${project.root}: ${stderr || project.error}`)
        }).catch((error) => {
          project.error = brief(error)
          this.log(`generation failed for ${project.root}: ${project.error}`)
        }).finally(() => {
          clearTimeout(timeout)
          this.active = undefined
          this.pump()
        })
        this.active = { project, child, done }
        return
      }
      catch (error) {
        project.error = brief(error)
        this.log(`generation failed for ${project.root}: ${project.error}`)
      }
    }
  }

  private remove(project: ProjectWatch): void {
    for (const entry of project.watchers.values())
      entry.watcher.close()
    if (project.entry)
      this.watched--
    clearTimeout(project.timer)
    this.ready.delete(project)
  }

  async stop(): Promise<void> {
    this.closed = true
    this.registry?.close()
    clearTimeout(this.registryTimer)
    for (const project of this.projects.values())
      this.remove(project)
    this.projects.clear()
    if (this.active) {
      killWorker(this.active.child)
      await this.active.done
    }
  }
}
