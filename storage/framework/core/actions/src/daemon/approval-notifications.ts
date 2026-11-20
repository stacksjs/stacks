import type { FSWatcher } from 'node:fs'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, watch } from 'node:fs'
import { basename, join } from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { approvalDirectory, approvalFileName, readApproval, writeApprovalState } from './approval-state'

type Notify = (root: string, files: number, signal: AbortSignal) => Promise<void>

interface Delivery {
  id: string
  attempts: number
  retryAt?: number
}

interface PendingApproval {
  path: string
  files: number
  delivery?: Delivery
}

const execute = promisify(execFile)

async function notifyMac(root: string, files: number, signal: AbortSignal): Promise<void> {
  const script = 'on run argv\ndisplay notification (item 1 of argv) with title "Buddy · Generated changes"\nend run'
  const message = `${basename(root)} has ${files} generated ${files === 1 ? 'file' : 'files'} ready for review. Run ./buddy generate:review in the project.`
  await execute('/usr/bin/osascript', ['-e', script, '--', message], { timeout: 15_000, signal })
}

function readDelivery(path: string, id: string): Delivery {
  try {
    const delivery = JSON.parse(readFileSync(path, 'utf8')) as Delivery
    if (delivery.id === id && Number.isSafeInteger(delivery.attempts) && delivery.attempts > 0
      && (delivery.retryAt === undefined || Number.isFinite(delivery.retryAt)))
      return delivery
  }
  catch (error) {
    if (!(error instanceof SyntaxError) && (error as NodeJS.ErrnoException).code !== 'ENOENT')
      throw error
  }
  return { id, attempts: 0, retryAt: 0 }
}

/** The daemon owns delivery. The proposal itself stays reviewable with or without it. */
export class ApprovalNotifications {
  private projects = new Map<string, string>()
  private names = new Map<string, string>()
  private pending = new Map<string, PendingApproval>()
  private watcher?: FSWatcher
  private timer?: ReturnType<typeof setTimeout>
  private active?: { controller: AbortController, done: Promise<void> }
  private generating?: string
  private closed = false

  constructor(
    private log: (message: string) => void,
    private notify: Notify | undefined = process.platform === 'darwin' ? notifyMac : undefined,
    private retryDelay = (attempts: number) => Math.min(300_000, 5_000 * 4 ** (attempts - 1)),
  ) {}

  start(): void {
    const dir = approvalDirectory()
    try {
      mkdirSync(dir, { recursive: true, mode: 0o700 })
      this.watcher = watch(dir, (_, filename) => {
        if (filename && this.projects.has(filename))
          this.refresh(filename)
        else if (!filename)
          for (const name of this.projects.keys())
            this.refresh(name)
      })
      this.watcher.on('error', error => this.log(`approval watcher: ${error.message}`))
    }
    catch (error) {
      this.log(`Could not watch approval state: ${error instanceof Error ? error.message : error}`)
    }
  }

  setProject(root: string, enabled: boolean): void {
    const previous = this.names.get(root)
    if (enabled && !previous) {
      let name: string
      try {
        name = approvalFileName(root)
      }
      catch (error) {
        this.log(`Could not watch approvals for ${root}: ${error instanceof Error ? error.message : error}`)
        return
      }
      this.projects.set(name, root)
      this.names.set(root, name)
      this.refresh(name)
    }
    else if (!enabled && previous) {
      this.names.delete(root)
      this.projects.delete(previous)
      this.pending.delete(previous)
      this.pump()
    }
  }

  status(): Array<{ path: string, files: number }> {
    return [...this.pending.values()].map(({ path, files }) => ({ path, files }))
  }

  setGenerating(root?: string): void {
    const previous = this.generating
    this.generating = root
    const name = previous && this.names.get(previous)
    if (name)
      this.refresh(name)
    else
      this.pump()
  }

  private refresh(name: string): void {
    const path = this.projects.get(name)
    if (this.closed || !path)
      return

    const file = join(approvalDirectory(), name)
    try {
      const proposal = readApproval(file)
      const files = proposal && Object.keys(proposal.files).length
      if (!proposal || !files) {
        this.pending.delete(name)
        rmSync(`${file}.delivery`, { force: true })
      }
      else {
        const id = createHash('sha256').update(JSON.stringify({ revision: proposal.revision, files: proposal.files })).digest('hex')
        const prior = this.pending.get(name)?.delivery
        const delivery = proposal.notify && this.notify
          ? prior?.id === id ? prior : readDelivery(`${file}.delivery`, id)
          : undefined
        this.pending.set(name, { path, files, delivery })
      }
    }
    catch (error) {
      this.pending.delete(name)
      this.log(`Could not read approval state for ${path}: ${error instanceof Error ? error.message : error}`)
    }
    this.pump()
  }

  private pump(): void {
    clearTimeout(this.timer)
    if (this.closed || this.active || !this.notify)
      return

    const next = [...this.pending].filter(([, entry]) => entry.path !== this.generating && entry.delivery?.retryAt !== undefined)
      .sort(([, a], [, b]) => a.delivery!.retryAt! - b.delivery!.retryAt!)[0]
    if (!next)
      return

    const [name, entry] = next
    const delay = entry.delivery!.retryAt! - Date.now()
    if (delay > 0) {
      this.timer = setTimeout(() => this.pump(), delay)
      return
    }

    const controller = new AbortController()
    this.active = {
      controller,
      done: this.send(name, entry, controller.signal).finally(() => {
        this.active = undefined
        this.pump()
      }),
    }
  }

  private async send(name: string, entry: PendingApproval, signal: AbortSignal): Promise<void> {
    const { id, attempts } = entry.delivery!
    const delivery: Delivery = { id, attempts: attempts + 1 }
    try {
      await this.notify!(entry.path, entry.files, signal)
    }
    catch (error) {
      if (signal.aborted)
        return
      this.log(`Desktop alert for ${entry.path} failed. Buddy will retry: ${error instanceof Error ? error.message : error}`)
      delivery.retryAt = Date.now() + this.retryDelay(delivery.attempts)
    }

    const current = this.pending.get(name)
    if (this.closed || current?.delivery?.id !== id)
      return
    current.delivery = delivery
    try {
      writeApprovalState(join(approvalDirectory(), `${name}.delivery`), delivery)
    }
    catch (error) {
      this.log(`Could not record notification delivery for ${entry.path}: ${error instanceof Error ? error.message : error}`)
    }
  }

  async stop(): Promise<void> {
    this.closed = true
    clearTimeout(this.timer)
    this.watcher?.close()
    const active = this.active
    active?.controller.abort()
    await active?.done
  }
}
