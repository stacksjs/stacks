import { Database } from 'bun:sqlite'
import { accessSync, closeSync, constants, mkdirSync, openSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { isProcessAlive, isProjectRoot, projectCliEntry } from '@stacksjs/path'
import { machineEnvironment } from '../daemon/environment'
import { canRestartUpdatedProject, restartUpdatedProject } from './dashboard-restart'

export interface SoftwareUpdateProject {
  id: string
  name: string
  version: string
}

export interface SoftwareUpdateTarget extends SoftwareUpdateProject {
  root: string
}

type StepStatus = 'queued' | 'updating' | 'complete' | 'failed' | 'interrupted'
type RestartStatus = 'queued' | 'restarting' | 'complete' | 'failed' | 'interrupted'

export interface SoftwareUpdateReport {
  id: string
  running: boolean
  restarting?: boolean
  restartAvailable?: boolean
  projects: Array<SoftwareUpdateProject & {
    status: StepStatus
    message?: string
    restartStatus?: RestartStatus
    restartMessage?: string
  }>
  logFile: string
}

interface Job {
  workerPid: number
  buddyPid?: number
  targets: SoftwareUpdateTarget[]
  report: SoftwareUpdateReport
}

export function projectUpdateCommand(root: string, version: string): string[] | undefined {
  if (!/^\d+\.\d+\.\d+$/.test(version) || !isProjectRoot(root))
    return
  const args = ['upgrade', '--version', version, '--no-interaction']
  const shim = join(root, 'buddy')
  try {
    accessSync(shim, constants.X_OK)
    return [shim, ...args]
  }
  catch {
    const entry = projectCliEntry(root)
    if (entry)
      return [process.execPath, '--no-install', ...(entry.endsWith('.ts') ? ['--conditions=development'] : []), entry, ...args]
  }
}

function openState(file: string): Database {
  const db = new Database(file)
  db.run('PRAGMA busy_timeout = 5000')
  db.run('CREATE TABLE IF NOT EXISTS software_update (id INTEGER PRIMARY KEY CHECK (id = 1), body TEXT NOT NULL)')
  return db
}

function readJob(db: Database): Job | null {
  const row = db.query<{ body: string }, []>('SELECT body FROM software_update WHERE id = 1').get()
  return row ? JSON.parse(row.body) as Job : null
}

function writeJob(db: Database, job: Job): void {
  db.run('INSERT OR REPLACE INTO software_update (id, body) VALUES (1, ?)', [JSON.stringify(job)])
}

function currentJob(db: Database): Job | null {
  const job = readJob(db)
  if (!job?.report.running || isProcessAlive(job.workerPid) || (job.buddyPid && isProcessAlive(job.buddyPid)))
    return job

  job.report.running = false
  job.report.restarting = false
  for (const project of job.report.projects) {
    if (project.status === 'queued' || project.status === 'updating')
      project.status = 'interrupted'
    if (project.restartStatus === 'queued' || project.restartStatus === 'restarting')
      project.restartStatus = 'interrupted'
  }
  writeJob(db, job)
  return job
}

function restartTargets(job: Job): SoftwareUpdateReport['projects'] {
  return job.report.projects.filter((project, index) =>
    project.status === 'complete' && project.restartStatus !== 'complete' && canRestartUpdatedProject(job.targets[index]!.root),
  )
}

export function readSoftwareUpdate(file: string): SoftwareUpdateReport | null {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
  const db = openState(file)
  try {
    return db.transaction(() => {
      const job = currentJob(db)
      if (!job)
        return null
      return { ...job.report, restartAvailable: !job.report.running && restartTargets(job).length > 0 }
    }).immediate()
  }
  finally {
    db.close()
  }
}

export function startSoftwareUpdate(file: string, targets: SoftwareUpdateTarget[]): SoftwareUpdateReport | null {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
  const db = openState(file)
  try {
    return db.transaction(() => {
      if (currentJob(db)?.report.running)
        return null

      const report: SoftwareUpdateReport = {
        id: crypto.randomUUID(),
        running: true,
        projects: targets.map(({ id, name, version }) => ({ id, name, version, status: 'queued' })),
        logFile: join(dirname(file), 'buddy-upgrade.log'),
      }
      launchWorker(file, db, { workerPid: 0, targets, report }, 'w')
      return report
    }).immediate()
  }
  finally {
    db.close()
  }
}

export function startSoftwareRestart(file: string, id: string): SoftwareUpdateReport | null {
  const db = openState(file)
  try {
    return db.transaction(() => {
      const job = currentJob(db)
      if (!job || job.report.id !== id || job.report.running)
        return null
      const targets = restartTargets(job)
      if (!targets.length)
        return null

      for (const project of targets) {
        project.restartStatus = 'queued'
        delete project.restartMessage
      }
      job.report.running = true
      job.report.restarting = true
      launchWorker(file, db, job, 'a')
      return job.report
    }).immediate()
  }
  finally {
    db.close()
  }
}

function launchWorker(file: string, db: Database, job: Job, mode: 'a' | 'w'): void {
  const log = openSync(job.report.logFile, mode, 0o600)
  try {
    // Keep the worker alive when an upgrade or restart closes the dashboard.
    const worker = Bun.spawn([process.execPath, '--no-env-file', '--no-install', import.meta.path, file, job.report.id], {
      env: {
        ...machineEnvironment(),
        ...(process.env.STACKS_FRAMEWORK_REGISTRY && { STACKS_FRAMEWORK_REGISTRY: process.env.STACKS_FRAMEWORK_REGISTRY }),
      },
      stdin: 'ignore',
      stdout: log,
      stderr: log,
      detached: true,
    })
    job.workerPid = worker.pid
    writeJob(db, job)
    worker.unref()
  }
  finally {
    closeSync(log)
  }
}

async function runSoftwareRestart(db: Database, job: Job): Promise<void> {
  for (const [index, target] of job.targets.entries()) {
    const project = job.report.projects[index]!
    if (project.restartStatus !== 'queued')
      continue
    project.restartStatus = 'restarting'
    writeJob(db, job)
    console.log(`\n${target.name}: restarting running app services and dashboard\n`)
    try {
      await restartUpdatedProject(target.root)
      project.restartStatus = 'complete'
    }
    catch (error) {
      project.restartStatus = 'failed'
      project.restartMessage = error instanceof Error ? error.message : 'Buddy could not restart this project.'
      console.error(project.restartMessage)
    }
    writeJob(db, job)
  }
  job.report.running = false
  job.report.restarting = false
  writeJob(db, job)
}

async function runSoftwareUpdate(file: string, id: string): Promise<void> {
  const db = openState(file)
  try {
    // Wait for the launching transaction to commit the worker's job.
    const job = db.transaction(() => readJob(db)).immediate()
    if (!job || job.report.id !== id || job.workerPid !== process.pid)
      return

    if (job.report.restarting)
      return await runSoftwareRestart(db, job)

    const { report } = job
    for (const [index, target] of job.targets.entries()) {
      const project = report.projects[index]!
      project.status = 'updating'
      writeJob(db, job)
      console.log(`\n${target.name}: buddy upgrade --version ${target.version}\n`)
      try {
        const command = projectUpdateCommand(target.root, target.version)
        if (!command)
          throw new Error('Buddy is no longer available for this project.')
        const buddy = Bun.spawn(command, { cwd: target.root, stdin: 'ignore', stdout: 'inherit', stderr: 'inherit' })
        job.buddyPid = buddy.pid
        writeJob(db, job)
        const exit = await buddy.exited
        if (exit !== 0)
          throw new Error(`Buddy exited with status ${exit}.`)
        project.status = 'complete'
      }
      catch (error) {
        project.status = 'failed'
        project.message = error instanceof Error ? error.message : 'Buddy could not update this project.'
      }
      delete job.buddyPid
      writeJob(db, job)
    }
    report.running = false
    writeJob(db, job)
  }
  finally {
    db.close()
  }
}

if (import.meta.main)
  await runSoftwareUpdate(process.argv[2]!, process.argv[3]!)
