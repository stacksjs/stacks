import type { UserModel } from '@stacksjs/orm'
import type { RemoteHost } from './remote-commands'
import { randomBytes } from 'node:crypto'
import { RemoteCommandError, resolveHost } from './remote-commands'

/**
 * Interactive terminal sessions into configured hosts (stacksjs/stacks#960).
 *
 * The command runner beside this runs named operations. This is the shell, so
 * every rule the runner has holds here and three more are added:
 *
 * - **A host must opt in** with `terminal: true`. Declaring a host for named
 *   commands does not make it a host anyone may open a shell on.
 * - **Its own gate**, `open-remote-terminal`, receiving the host key. Without
 *   it defined, every session is refused - the same fail-closed default as
 *   `run-remote-command`, and a separate ability because a terminal is every
 *   command at once.
 * - **A session belongs to the user who opened it.** Its id is 128 random
 *   bits, and another user naming it gets the same 404 as an id that never
 *   existed, so neither guessing nor a leaked id reaches someone else's shell.
 *
 * And a session does not outlive its purpose: it ends after `idleTimeoutMs`
 * without input, after `maxDurationMs` in all, and `detachGraceMs` after its
 * last viewer goes away - the remote shell is killed, never left running on
 * the box with nobody attached. Every session is recorded when it opens, what
 * was typed into it line by line, and when and why it closed.
 */

/** A running terminal process, local PTY or test double. */
export interface TerminalProcess {
  write: (data: string) => void
  resize: (cols: number, rows: number) => void
  kill: () => void
  /** Resolves with the exit code once the process has ended, however it ended. */
  exited: Promise<number>
}

/** Starts the session's process. Injected so the rules are testable without a network. */
export type TerminalSpawner = (
  host: RemoteHost,
  size: TerminalSize,
  onOutput: (bytes: Uint8Array) => void,
) => Promise<TerminalProcess> | TerminalProcess

export interface TerminalSize {
  cols: number
  rows: number
}

export type TerminalCloseReason = 'closed' | 'exited' | 'idle' | 'max-duration' | 'detached' | 'shutdown'

/** Where sessions are recorded. Injected for the same reason. */
export interface TerminalAuditSink {
  opened: (entry: { user: string, hostKey: string, session: string, at: string }) => Promise<void> | void
  /** One line of input as typed, or what was pending when the session ended. */
  input: (entry: { user: string, hostKey: string, session: string, at: string, line: string }) => Promise<void> | void
  closed: (entry: {
    user: string
    hostKey: string
    session: string
    at: string
    reason: TerminalCloseReason
    exitCode: number | null
    durationMs: number
    bytesIn: number
    bytesOut: number
  }) => Promise<void> | void
}

/** Whether `user` may open a terminal on the host with this key. */
export type TerminalAuthorizer = (user: UserModel | null, hostKey: string) => Promise<boolean> | boolean

/** What a viewer receives: output in order, then the end. */
export type TerminalEvent =
  | { type: 'output', seq: number, data: Uint8Array }
  | { type: 'exit', reason: TerminalCloseReason, exitCode: number | null }

export interface TerminalSessionOptions {
  spawn: TerminalSpawner
  audit: TerminalAuditSink
  /** End a session after this long without input. Default 15 minutes. */
  idleTimeoutMs?: number
  /** End a session this long after it opened, whatever is happening. Default 2 hours. */
  maxDurationMs?: number
  /** End a session this long after its last viewer left. Default 30 seconds. */
  detachGraceMs?: number
  /** Output kept for a viewer that reconnects. Default 256 KiB. */
  replayBytes?: number
  /** Concurrent sessions one user may hold. Default 4. */
  maxSessionsPerUser?: number
  /** Record what is typed. Default true. */
  recordInput?: boolean
}

/** The largest single input a request may carry: a paste, not a file upload. */
export const MAX_INPUT_CHARS = 64 * 1024

const DEFAULTS = {
  idleTimeoutMs: 15 * 60_000,
  maxDurationMs: 2 * 60 * 60_000,
  detachGraceMs: 30_000,
  replayBytes: 256 * 1024,
  maxSessionsPerUser: 4,
  recordInput: true,
}

interface Session {
  id: string
  owner: string
  identity: string
  host: RemoteHost
  process: TerminalProcess
  openedAt: number
  seq: number
  backlog: Array<{ seq: number, data: Uint8Array }>
  backlogBytes: number
  viewers: Set<(event: TerminalEvent) => void>
  pendingInput: string
  bytesIn: number
  bytesOut: number
  ended: boolean
  idleTimer?: ReturnType<typeof setTimeout>
  maxTimer?: ReturnType<typeof setTimeout>
  detachTimer?: ReturnType<typeof setTimeout>
}

function ownerOf(user: UserModel | null): string {
  if (!user)
    throw new RemoteCommandError('Authentication is required.', 401)
  const id = (user as { id?: unknown }).id
  if (id === undefined || id === null)
    throw new RemoteCommandError('Authentication is required.', 401)
  return String(id)
}

/** Columns and rows a real terminal could have; anything else is refused. */
export function normalizeSize(cols: unknown, rows: unknown): TerminalSize {
  const c = Number(cols)
  const r = Number(rows)
  if (!Number.isInteger(c) || !Number.isInteger(r) || c < 2 || r < 2 || c > 1000 || r > 500)
    throw new RemoteCommandError('A terminal size is whole columns and rows, 2 to 1000 by 2 to 500.', 422)
  return { cols: c, rows: r }
}

export class TerminalSessions {
  private readonly sessions = new Map<string, Session>()
  private readonly options: Required<TerminalSessionOptions>

  constructor(options: TerminalSessionOptions) {
    this.options = { ...DEFAULTS, ...options }
  }

  /** Sessions open now, for tests and shutdown. */
  get size(): number {
    return this.sessions.size
  }

  /**
   * Resolve, authorize, record, spawn. The audit entry is written before the
   * process starts, so a session that hangs on connect is still on record.
   */
  async open(input: {
    user: UserModel | null
    hosts: readonly RemoteHost[]
    hostKey: unknown
    authorizer?: TerminalAuthorizer
    cols: unknown
    rows: unknown
  }): Promise<{ id: string, host: string }> {
    const owner = ownerOf(input.user)
    const host = resolveHost(input.hosts, input.hostKey)

    if (!host.terminal)
      throw new RemoteCommandError(`Host "${host.key}" does not allow terminal sessions; set \`terminal: true\` on it in config/remote.ts.`, 403)

    // Fails CLOSED, as `run-remote-command` does.
    if (!input.authorizer)
      throw new RemoteCommandError('Terminal sessions are not authorized on this application.', 403)
    if (!await input.authorizer(input.user, host.key))
      throw new RemoteCommandError(`You are not permitted to open a terminal on "${host.key}".`, 403)

    const size = normalizeSize(input.cols, input.rows)
    const held = [...this.sessions.values()].filter(session => session.owner === owner).length
    if (held >= this.options.maxSessionsPerUser)
      throw new RemoteCommandError(`You already have ${held} terminal sessions open; close one first.`, 429)

    const id = randomBytes(16).toString('hex')
    const identity = String((input.user as { email?: unknown }).email ?? owner)
    await this.options.audit.opened({ user: identity, hostKey: host.key, session: id, at: new Date().toISOString() })

    const session = {
      id,
      owner,
      identity,
      host,
      openedAt: Date.now(),
      seq: 0,
      backlog: [],
      backlogBytes: 0,
      viewers: new Set(),
      pendingInput: '',
      bytesIn: 0,
      bytesOut: 0,
      ended: false,
    } as unknown as Session

    let process: TerminalProcess
    try {
      process = await this.options.spawn(host, size, bytes => this.output(session, bytes))
    }
    catch (error) {
      await this.options.audit.closed({
        user: identity,
        hostKey: host.key,
        session: id,
        at: new Date().toISOString(),
        reason: 'exited',
        exitCode: null,
        durationMs: Date.now() - session.openedAt,
        bytesIn: 0,
        bytesOut: 0,
      })
      throw error
    }

    session.process = process
    this.sessions.set(id, session)

    session.maxTimer = setTimeout(() => void this.end(session, 'max-duration'), this.options.maxDurationMs)
    this.touch(session)
    // Nobody is watching yet: if no viewer attaches, the shell does not stay.
    this.armDetach(session)

    void process.exited.then(code => this.end(session, 'exited', code))

    return { id, host: host.key }
  }

  /** Type into the session. */
  async input(id: string, user: UserModel | null, data: unknown): Promise<void> {
    const session = this.find(id, user)
    if (typeof data !== 'string' || data.length === 0)
      throw new RemoteCommandError('Input is a non-empty string.', 422)
    if (data.length > MAX_INPUT_CHARS)
      throw new RemoteCommandError(`Input is at most ${MAX_INPUT_CHARS} characters at a time.`, 413)

    session.process.write(data)
    session.bytesIn += Buffer.byteLength(data)
    this.touch(session)
    if (this.options.recordInput)
      await this.recordInput(session, data)
  }

  resize(id: string, user: UserModel | null, cols: unknown, rows: unknown): void {
    const session = this.find(id, user)
    const size = normalizeSize(cols, rows)
    session.process.resize(size.cols, size.rows)
  }

  async close(id: string, user: UserModel | null): Promise<void> {
    await this.end(this.find(id, user), 'closed')
  }

  /** End every session, for a server shutting down. */
  async closeAll(): Promise<void> {
    await Promise.all([...this.sessions.values()].map(session => this.end(session, 'shutdown')))
  }

  /**
   * Output from `afterSeq` on, then live output until the session ends or the
   * viewer stops reading. A viewer that reconnects passes the last sequence it
   * saw and misses nothing still in the replay buffer.
   */
  watch(id: string, user: UserModel | null, afterSeq = 0): AsyncIterable<TerminalEvent> {
    const session = this.find(id, user)
    const queue: TerminalEvent[] = session.backlog
      .filter(chunk => chunk.seq > afterSeq)
      .map(chunk => ({ type: 'output' as const, seq: chunk.seq, data: chunk.data }))
    let wake: (() => void) | undefined
    let done = false

    const viewer = (event: TerminalEvent): void => {
      queue.push(event)
      wake?.()
    }
    session.viewers.add(viewer)
    if (session.detachTimer) {
      clearTimeout(session.detachTimer)
      session.detachTimer = undefined
    }

    const detach = (): void => {
      if (done)
        return
      done = true
      session.viewers.delete(viewer)
      this.armDetach(session)
    }

    return {
      [Symbol.asyncIterator]: () => ({
        next: async (): Promise<IteratorResult<TerminalEvent>> => {
          while (queue.length === 0) {
            if (done)
              return { value: undefined, done: true }
            await new Promise<void>((resolve) => { wake = resolve })
            wake = undefined
          }
          const event = queue.shift()!
          if (event.type === 'exit')
            detach()
          return { value: event, done: false }
        },
        return: async (): Promise<IteratorResult<TerminalEvent>> => {
          detach()
          wake?.()
          return { value: undefined, done: true }
        },
      }),
    }
  }

  /** The session with this id, if this user owns it. Anyone else gets the 404 a missing id gets. */
  private find(id: unknown, user: UserModel | null): Session {
    const owner = ownerOf(user)
    const session = typeof id === 'string' ? this.sessions.get(id) : undefined
    if (!session || session.owner !== owner || session.ended)
      throw new RemoteCommandError('No such terminal session.', 404)
    return session
  }

  private output(session: Session, data: Uint8Array): void {
    if (session.ended)
      return
    const seq = ++session.seq
    session.bytesOut += data.byteLength
    session.backlog.push({ seq, data })
    session.backlogBytes += data.byteLength
    while (session.backlogBytes > this.options.replayBytes && session.backlog.length > 1)
      session.backlogBytes -= session.backlog.shift()!.data.byteLength
    for (const viewer of session.viewers)
      viewer({ type: 'output', seq, data })
  }

  private touch(session: Session): void {
    if (session.idleTimer)
      clearTimeout(session.idleTimer)
    session.idleTimer = setTimeout(() => void this.end(session, 'idle'), this.options.idleTimeoutMs)
  }

  private armDetach(session: Session): void {
    if (session.ended || session.viewers.size > 0 || session.detachTimer)
      return
    session.detachTimer = setTimeout(() => void this.end(session, 'detached'), this.options.detachGraceMs)
  }

  /** Lines are recorded as they are completed; a partial line waits for its end. */
  private async recordInput(session: Session, data: string): Promise<void> {
    session.pendingInput += data
    const lines = session.pendingInput.split(/\r\n|\r|\n/)
    session.pendingInput = lines.pop() ?? ''
    for (const line of lines)
      await this.options.audit.input({ user: session.identity, hostKey: session.host.key, session: session.id, at: new Date().toISOString(), line })
  }

  private async end(session: Session, reason: TerminalCloseReason, exitCode: number | null = null): Promise<void> {
    if (session.ended)
      return
    session.ended = true
    this.sessions.delete(session.id)
    for (const timer of [session.idleTimer, session.maxTimer, session.detachTimer]) {
      if (timer)
        clearTimeout(timer)
    }

    if (reason !== 'exited')
      session.process.kill()

    if (this.options.recordInput && session.pendingInput) {
      await this.options.audit.input({ user: session.identity, hostKey: session.host.key, session: session.id, at: new Date().toISOString(), line: session.pendingInput })
      session.pendingInput = ''
    }

    for (const viewer of session.viewers)
      viewer({ type: 'exit', reason, exitCode })

    await this.options.audit.closed({
      user: session.identity,
      hostKey: session.host.key,
      session: session.id,
      at: new Date().toISOString(),
      reason,
      exitCode,
      durationMs: Date.now() - session.openedAt,
      bytesIn: session.bytesIn,
      bytesOut: session.bytesOut,
    })
  }
}
