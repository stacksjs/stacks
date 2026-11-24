import { Database } from 'bun:sqlite'
import { accessSync, closeSync, constants, mkdirSync, openSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { isProcessAlive, isProjectRoot, projectCliEntry } from '@stacksjs/path'
import { machineEnvironment } from '../daemon/environment'

export interface SoftwareUpdateProject {
  id: string
  name: string
  version: string
}

export interface SoftwareUpdateTarget extends SoftwareUpdateProject {
  root: string
}

type StepStatus = 'queued' | 'updating' | 'complete' | 'failed' | 'interrupted'

export interface SoftwareUpdateReport {
  id: string
  running: boolean
  projects: Array<SoftwareUpdateProject & { status: StepStatus, message?: string }>
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
  for (const project of job.report.projects) {
    if (project.status === 'queued' || project.status === 'updating')
      project.status = 'interrupted'
  }
  writeJob(db, job)
  return job
}

export function readSoftwareUpdate(file: string): SoftwareUpdateReport | null {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
  const db = openState(file)
  try {
    return db.transaction(() => currentJob(db)?.report ?? null).immediate()
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
      const log = openSync(report.logFile, 'w', 0o600)
      try {
        // This worker lives outside the dashboard supervisor. A project upgrade
        // can replace framework files and restart the window that launched it.
        const worker = Bun.spawn([process.execPath, '--no-env-file', '--no-install', import.meta.path, file, report.id], {
          env: {
            ...machineEnvironment(),
            ...(process.env.STACKS_FRAMEWORK_REGISTRY && { STACKS_FRAMEWORK_REGISTRY: process.env.STACKS_FRAMEWORK_REGISTRY }),
          },
          stdin: 'ignore',
          stdout: log,
          stderr: log,
        })
        writeJob(db, { workerPid: worker.pid, targets, report })
        worker.unref()
      }
      finally {
        closeSync(log)
      }
      return report
    }).immediate()
  }
  finally {
    db.close()
  }
}

async function runSoftwareUpdate(file: string, id: string): Promise<void> {
  const db = openState(file)
  try {
    // Wait for the launching transaction to commit the worker's job.
    const job = db.transaction(() => readJob(db)).immediate()
    if (!job || job.report.id !== id || job.workerPid !== process.pid)
      return

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
