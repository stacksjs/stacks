import type { UserModel } from '@stacksjs/orm'
import type { ResponseStatus } from '@stacksjs/bun-router'

/**
 * Running a known operation on a configured host, from the dashboard
 * (stacksjs/stacks#960).
 *
 * ## Why this is not a terminal
 *
 * The request asked for SSH in the dashboard, and named Termius. A browser
 * terminal into a production box is remote code execution as a feature - the
 * highest-privilege surface a dashboard can have - so what ships first is the
 * part that carries most of the value and cannot become an arbitrary shell:
 * run *this named operation* on *that host* and show me the output. Restart a
 * service, tail a log, check disk.
 *
 * The command is chosen from a registry the config declares. The request names
 * a KEY; it never carries a command, so there is no argument to escape and no
 * shell to reach. An interactive session is a strictly larger problem and is
 * tracked separately - `Bun.spawn` has no PTY, and `ssh -tt` gives a remote one
 * but cannot propagate a window resize without a local TTY.
 *
 * ## What makes it safe to expose at all
 *
 * Four things, none of which the existing infrastructure gave for free:
 *
 * 1. **Host keys are verified.** `sshExec` in `@stacksjs/ts-cloud` disables host
 *    key checking on purpose - it targets boxes created a minute ago whose keys
 *    cannot be known. For a long-lived production host that is MITM-open, so
 *    this does not reuse it. `StrictHostKeyChecking=yes` against a configured
 *    known-hosts file, and a host with no pinned key is refused rather than
 *    trusted on first contact.
 * 2. **Hosts come from config, never the request.** The request names a key in
 *    the registry. An unknown key is a 404, so no request can reach a host the
 *    operator did not declare.
 * 3. **Authorization is per host, and has no local bypass.** The dashboard's
 *    `guard()` helper drops auth entirely when `APP_ENV` is local or test,
 *    which for this surface would be an unauthenticated shell on every
 *    developer machine reachable on the network. This checks a gate instead.
 * 4. **Every run is recorded** - who, which host, which command, when, exit
 *    code - before it starts and again when it ends.
 */

/** A host the dashboard may reach, as `config/cloud.ts` declares it. */
export interface RemoteHost {
  /** Stable key the request names. Never a hostname. */
  key: string
  /** Hostname or IP. */
  host: string
  /** SSH user. */
  user: string
  /** SSH port. Omit for 22. */
  port?: number
  /** Private key passed as `ssh -i`. Omit to use the ambient agent. */
  identityFile?: string
  /**
   * Pinned host keys for this host, in `known_hosts` format.
   *
   * Required. A host without one cannot be reached: accepting a key on first
   * contact is what makes an interactive session into a production box
   * MITM-open, and there is no reason to do it here - the operator declaring
   * the host can declare its fingerprint at the same time.
   */
  knownHosts: string
}

/** An operation that may be run, as config declares it. */
export interface RemoteCommand {
  /** Stable key the request names. */
  key: string
  /** What it does, shown in the dashboard. */
  description: string
  /**
   * The argv to run on the host.
   *
   * An ARRAY, and never interpolated. A string would be a shell command, and a
   * shell command with any caller-supplied part in it is an injection - which
   * is the whole reason the request cannot carry one.
   */
  argv: readonly string[]
  /** Host keys this command may run on. Omit for every host. */
  hosts?: readonly string[]
}

export class RemoteCommandError extends Error {
  readonly status: ResponseStatus

  constructor(message: string, status: ResponseStatus = 422) {
    super(message)
    this.name = 'RemoteCommandError'
    this.status = status
  }
}

/** What a completed run produced. */
export interface RemoteCommandResult {
  host: string
  command: string
  exitCode: number
  stdout: string
  stderr: string
  /** Milliseconds from spawn to exit. */
  durationMs: number
  /** Whether the run was cut short by {@link RemoteRunOptions.timeoutMs}. */
  timedOut: boolean
}

/** How a run reaches the host. Injected so the rules can be tested without a network. */
export type RemoteRunner = (
  argv: readonly string[],
  options: { timeoutMs: number },
) => Promise<{ exitCode: number, stdout: string, stderr: string, timedOut: boolean }>

/** Where a run is recorded. Injected for the same reason. */
export interface RemoteAuditSink {
  started: (entry: { user: string, hostKey: string, commandKey: string, at: string }) => Promise<void>
  finished: (entry: { user: string, hostKey: string, commandKey: string, at: string, exitCode: number, durationMs: number, timedOut: boolean }) => Promise<void>
}

export interface RemoteRunOptions {
  /** Give up after this long and report `timedOut`. */
  timeoutMs?: number
  /** Trim output beyond this many characters, so one run cannot fill a response. */
  maxOutputChars?: number
}

/** A run that has not finished in this long is not going to be useful in a dashboard. */
const DEFAULT_TIMEOUT_MS = 30_000
const MAX_TIMEOUT_MS = 300_000
const DEFAULT_MAX_OUTPUT = 64 * 1024

/**
 * The `ssh` argv for a command on a host.
 *
 * Every option here is load bearing:
 *
 * - `StrictHostKeyChecking=yes` and a per-host `UserKnownHostsFile` are what
 *   distinguish this from `sshExec`. Without them a changed host key is
 *   accepted silently, which is the entire attack.
 * - `BatchMode=yes` means a host that wants a password fails instead of hanging
 *   on a prompt no one can answer.
 * - `--` separates the ssh options from the remote argv, and the remote argv is
 *   passed as separate arguments rather than joined, so nothing in it is
 *   interpreted by a local shell.
 */
export function sshArgv(host: RemoteHost, command: RemoteCommand, knownHostsPath: string): string[] {
  const argv = [
    'ssh',
    '-o', 'StrictHostKeyChecking=yes',
    '-o', `UserKnownHostsFile=${knownHostsPath}`,
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=10',
  ]

  if (host.port !== undefined)
    argv.push('-p', String(host.port))
  if (host.identityFile)
    argv.push('-i', host.identityFile, '-o', 'IdentitiesOnly=yes')

  argv.push(`${host.user}@${host.host}`, '--', ...command.argv)
  return argv
}

/** The host with this key, or a 404. Hosts never come from the request itself. */
export function resolveHost(hosts: readonly RemoteHost[], key: unknown): RemoteHost {
  if (typeof key !== 'string' || !key.trim())
    throw new RemoteCommandError('A host key is required.', 422)

  const host = hosts.find(entry => entry.key === key)
  if (!host)
    throw new RemoteCommandError(`No configured host named "${key}".`, 404)

  // Refused rather than trusted on first contact. A host declared without its
  // fingerprint is a configuration mistake, and the failure mode of guessing is
  // silent.
  if (!host.knownHosts.trim())
    throw new RemoteCommandError(`Host "${key}" has no pinned host key; add one to its \`knownHosts\` before it can be reached.`, 422)

  return host
}

/** The command with this key, if it may run on this host. */
export function resolveCommand(commands: readonly RemoteCommand[], key: unknown, host: RemoteHost): RemoteCommand {
  if (typeof key !== 'string' || !key.trim())
    throw new RemoteCommandError('A command key is required.', 422)

  const command = commands.find(entry => entry.key === key)
  if (!command)
    throw new RemoteCommandError(`No configured command named "${key}".`, 404)

  // A command scoped to some hosts is a deliberate restriction - `deploy` on
  // the app box and not on the database box - so an unscoped run of it is a 403
  // rather than a 404: the command exists, this host is not one of its targets.
  if (command.hosts && !command.hosts.includes(host.key))
    throw new RemoteCommandError(`Command "${command.key}" is not permitted on host "${host.key}".`, 403)

  return command
}

/**
 * Whether `user` may run `command` on `host`.
 *
 * A gate rather than a role, because the request was for "certain users" and
 * `role:admin` is one bit. The gate receives both keys, so an application can
 * scope by host, by command, or by both without this file knowing how.
 */
export type RemoteAuthorizer = (user: UserModel | null, hostKey: string, commandKey: string) => Promise<boolean> | boolean

/** Refuses when no authorizer is configured. */
export async function authorize(
  authorizer: RemoteAuthorizer | undefined,
  user: UserModel | null,
  host: RemoteHost,
  command: RemoteCommand,
): Promise<void> {
  if (!user)
    throw new RemoteCommandError('Authentication is required.', 401)

  // Fails CLOSED. An app that has not defined the gate gets a refusal, not a
  // shell - the opposite of the websocket authenticator next door, which
  // proceeds when none is installed for backwards-compatibility.
  if (!authorizer)
    throw new RemoteCommandError('Remote commands are not authorized on this application.', 403)

  if (!await authorizer(user, host.key, command.key))
    throw new RemoteCommandError(`You are not permitted to run "${command.key}" on "${host.key}".`, 403)
}

/** Output beyond `limit`, with a marker rather than a silent cut. */
export function clampOutput(value: string, limit: number = DEFAULT_MAX_OUTPUT): string {
  if (value.length <= limit)
    return value
  return `${value.slice(0, limit)}\n… output truncated at ${limit} characters`
}

/** A timeout inside the bounds a dashboard request can wait for. */
export function normalizeTimeout(value: number | undefined): number {
  if (value === undefined)
    return DEFAULT_TIMEOUT_MS
  if (!Number.isFinite(value) || value <= 0)
    throw new RemoteCommandError('The timeout must be a positive number of milliseconds.', 422)
  return Math.min(value, MAX_TIMEOUT_MS)
}

/**
 * Resolve, authorize, record, run, record.
 *
 * The audit entry is written BEFORE the command runs and again after. A run
 * recorded only on completion loses exactly the ones worth having: the command
 * that hung, and the one whose process died with the box.
 */
export async function runRemoteCommand(
  input: { hostKey: unknown, commandKey: unknown },
  context: {
    user: UserModel | null
    hosts: readonly RemoteHost[]
    commands: readonly RemoteCommand[]
    authorizer?: RemoteAuthorizer
    run: RemoteRunner
    audit: RemoteAuditSink
  },
  options: RemoteRunOptions = {},
): Promise<RemoteCommandResult> {
  const host = resolveHost(context.hosts, input.hostKey)
  const command = resolveCommand(context.commands, input.commandKey, host)
  await authorize(context.authorizer, context.user, host, command)

  const timeoutMs = normalizeTimeout(options.timeoutMs)
  const identity = String(context.user?.email ?? context.user?.id ?? 'unknown')
  const startedAt = new Date().toISOString()

  await context.audit.started({ user: identity, hostKey: host.key, commandKey: command.key, at: startedAt })

  const began = Date.now()
  const outcome = await context.run(command.argv, { timeoutMs })
  const durationMs = Date.now() - began

  await context.audit.finished({
    user: identity,
    hostKey: host.key,
    commandKey: command.key,
    at: new Date().toISOString(),
    exitCode: outcome.exitCode,
    durationMs,
    timedOut: outcome.timedOut,
  })

  return {
    host: host.key,
    command: command.key,
    exitCode: outcome.exitCode,
    stdout: clampOutput(outcome.stdout, options.maxOutputChars),
    stderr: clampOutput(outcome.stderr, options.maxOutputChars),
    durationMs,
    timedOut: outcome.timedOut,
  }
}
