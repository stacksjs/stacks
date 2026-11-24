import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, isAbsolute, join, resolve, sep } from 'node:path'
import process from 'node:process'
import { findProjectRoot, isProjectRoot } from './project'

/**
 * The Stacks projects on this machine, and what each of them is running.
 *
 * `buddy` is installed once and serves every project, so "which projects are
 * there" has to have an answer that does not cost a walk of the home
 * directory. That walk was the only answer there was: `buddy cd` and
 * `buddy projects` took seconds, asked for permission to read folders they had
 * no business in, and still missed every app without a vendored
 * `storage/framework/core`, which is every app created since the framework
 * moved into `node_modules`.
 *
 * The list is kept instead. A project joins it the first time `buddy` runs
 * inside it, which costs two small file reads on the runs after that.
 *
 * One file per project, under `~/.stacks/projects/`, rather than one list:
 * several `buddy` processes start at once all the time (a dev server and its
 * children, a shell prompt, an editor task), and a shared file each of them
 * reads, changes and writes back loses whichever entry was written second.
 * Separate files have nothing to lose.
 *
 * Node built-ins only. The CLI reads this before it has loaded anything else.
 */

export interface RegisteredProject {
  /** Stable, filename-safe handle: the directory name, made unique by a path hash only when two projects share one. */
  id: string
  /** The directory name, which is what a developer calls the project. */
  name: string
  /** Absolute path of the project root, symlinks resolved. */
  path: string
  addedAt: string
  lastUsedAt: string
  /**
   * Ports reserved for this project's own servers, by service name. Only one
   * project holds a given port, so each keeps the same address from one day
   * to the next and what a browser stored for it stays with it.
   */
  ports?: Record<string, number>
}

/** A server a project is running right now, as that server itself recorded it. */
export interface ProjectService {
  name: string
  pid: number
  port: number
  /** The address a person opens. */
  url: string
  startedAt: string
  /** The ready instance of a dashboard whose supervisor handles a restart signal. */
  restartInstance?: string
  /** Set when the server stops itself after this long without a request. */
  idleExitMs?: number
  /** Private authorization for an owned development session. */
  controlToken?: string
}

/** How often a run inside a project refreshes its `lastUsedAt`. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000

/**
 * Where Stacks keeps what belongs to the machine rather than to a project:
 * `~/.stacks`, which the local certificates and the rpx proxy already use.
 * `STACKS_HOME` moves it, for a test or a machine with an unusual home.
 */
export function stacksHome(path = ''): string {
  return resolve(process.env.STACKS_HOME || join(homedir(), '.stacks'), path)
}

function registryDir(): string {
  return stacksHome('projects')
}

function entryPath(id: string): string {
  return join(registryDir(), `${id}.json`)
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project'
}

function hashedId(name: string, path: string): string {
  return `${slug(name)}-${createHash('sha256').update(path).digest('hex').slice(0, 8)}`
}

function realPath(path: string): string {
  try {
    return realpathSync(path)
  }
  catch {
    return resolve(path)
  }
}

function readEntry(id: string): RegisteredProject | null {
  try {
    const entry = JSON.parse(readFileSync(entryPath(id), 'utf8')) as Partial<RegisteredProject>
    if (typeof entry.path !== 'string' || !isAbsolute(entry.path))
      return null

    return {
      id,
      name: typeof entry.name === 'string' && entry.name ? entry.name : basename(entry.path),
      path: entry.path,
      addedAt: typeof entry.addedAt === 'string' ? entry.addedAt : new Date(0).toISOString(),
      lastUsedAt: typeof entry.lastUsedAt === 'string' ? entry.lastUsedAt : new Date(0).toISOString(),
      ...(entry.ports && typeof entry.ports === 'object' ? { ports: entry.ports } : {}),
    }
  }
  catch {
    // Missing, half-written by a crashed process, or not ours. Not a project.
    return null
  }
}

/** Write a file so a reader sees the old content or the new, never half of it. */
function writeAtomic(file: string, content: string, mode?: number): void {
  const temporary = `${file}.${process.pid}.tmp`
  writeFileSync(temporary, content, { mode })
  renameSync(temporary, file)
}

function writeEntry(project: RegisteredProject): void {
  mkdirSync(registryDir(), { recursive: true })
  const { id: _id, ...stored } = project
  writeAtomic(entryPath(project.id), `${JSON.stringify(stored, null, 2)}\n`)
}

/**
 * The entry a project root already has, or the id a new one takes.
 *
 * Two reads at most, because this runs on every `buddy` invocation: the plain
 * directory name first, then the hashed form a second project of the same name
 * was given.
 */
function locate(path: string): { existing: RegisteredProject | null, id: string } {
  const name = basename(path)
  const plain = slug(name)
  const hashed = hashedId(name, path)

  const byName = readEntry(plain)
  if (byName?.path === path)
    return { existing: byName, id: plain }

  const byHash = readEntry(hashed)
  if (byHash?.path === path)
    return { existing: byHash, id: hashed }

  // The plain name is free unless another project holds it. A project that
  // has since been deleted does not: its name goes to the one that is here.
  return { existing: null, id: byName && isProjectRoot(byName.path) ? hashed : plain }
}

/**
 * Add a project to the machine's list, or note that it was just used.
 *
 * Returns null when the directory is not a Stacks project root, so a caller
 * cannot list something `buddy` could not then run in. A write happens for a
 * new project and at most every few minutes after that; in between it is a
 * read.
 */
export function registerProject(root: string, now: Date = new Date()): RegisteredProject | null {
  const path = realPath(root)
  if (!isProjectRoot(path))
    return null

  const { existing, id } = locate(path)
  if (existing && now.getTime() - Date.parse(existing.lastUsedAt) < TOUCH_INTERVAL_MS)
    return existing

  const project: RegisteredProject = {
    ...existing,
    id,
    name: basename(path),
    path,
    addedAt: existing?.addedAt ?? now.toISOString(),
    lastUsedAt: now.toISOString(),
  }

  try {
    writeEntry(project)
  }
  catch {
    // A read-only home (a container, a locked-down CI runner). The project
    // still runs; it is only not remembered.
  }

  return project
}

function isInside(path: string, directory: string): boolean {
  return path === directory || path.startsWith(directory.endsWith(sep) ? directory : `${directory}${sep}`)
}

/**
 * Whether a project root is a copy that comes and goes: a checkout under the
 * system's temporary directory (a CI job, a review bot's clone) or a linked git
 * worktree of a project that is listed in its own right.
 *
 * Running `buddy` in one of those is not a sign that it is a project of its
 * own. Listed, a machine that runs agents or reviews collects dozens of them,
 * and the dashboard's switcher becomes a list of throwaway copies of the five
 * projects that matter, most of them deleted by the time anyone looks.
 */
export function isTransientCheckout(root: string, temporaryDirectories: string[] = [tmpdir(), '/tmp', '/var/folders']): boolean {
  const path = realPath(root)
  if (temporaryDirectories.flatMap(directory => [directory, realPath(directory)]).some(directory => isInside(path, directory)))
    return true

  // A linked worktree's `.git` is a file pointing into the main checkout's
  // `.git/worktrees/`. A submodule's points into `.git/modules/`, and is a
  // project of its own.
  try {
    const git = join(path, '.git')
    return statSync(git).isFile() && /[/\\]worktrees[/\\]/.test(readFileSync(git, 'utf8'))
  }
  catch {
    return false
  }
}

/**
 * Note that `buddy` just ran in a project, which lists it the first time.
 *
 * What the launcher calls on every invocation. Unlike `registerProject`, which
 * is a person asking for a project to be listed, this leaves a transient
 * checkout off the list unless it is already on it (see `isTransientCheckout`).
 */
export function noteProjectUsed(root: string, now: Date = new Date()): RegisteredProject | null {
  const path = realPath(root)
  if (!isProjectRoot(path))
    return null

  if (!locate(path).existing && isTransientCheckout(path))
    return null

  return registerProject(path, now)
}

/**
 * The port a project's `service` is given, the same one every time.
 *
 * The first project to ask gets `base`, the next `base + 1`, and each keeps
 * what it was given. Without this every dashboard asked for the same default
 * and took whichever port was free in the order they happened to start, so
 * `localhost:3002` was one project on Monday and another on Tuesday, and the
 * browser handed the second one the first one's saved session and settings.
 *
 * A reservation, not a guarantee the port is free: something else on the
 * machine may hold it, and the caller still has to check before it binds.
 * Null when the directory is not a project.
 */
export function reserveProjectPort(root: string, service: string, base: number): number | null {
  const project = registerProject(root)
  if (!project)
    return null

  const held = project.ports?.[service]
  if (held)
    return held

  // Every entry, present or not: a project on a volume that is not mounted
  // keeps its port for when it is.
  const taken = new Set(listProjects({ includeMissing: true }).map(other => other.ports?.[service]).filter(Boolean))
  let port = base
  while (taken.has(port))
    port++

  try {
    writeEntry({ ...project, ports: { ...project.ports, [service]: port } })
  }
  catch {
    // A read-only home: the port still works for this run, it is only not kept.
  }

  return port
}

export interface ListProjectsOptions {
  /**
   * Include projects whose directory is not there right now. Off by default:
   * nothing that lists projects for a person can do anything with one, and a
   * deleted worktree or clone would otherwise stay in every list until someone
   * ran `buddy projects:prune`.
   */
  includeMissing?: boolean
}

/**
 * The projects on the list, most recently used first.
 *
 * One whose directory is missing is left out but not forgotten: a project on a
 * volume that is not mounted comes back the moment it is.
 */
export function listProjects(options: ListProjectsOptions = {}): RegisteredProject[] {
  let files: string[]
  try {
    files = readdirSync(registryDir())
  }
  catch {
    return []
  }

  return files
    .filter(file => file.endsWith('.json'))
    .map(file => readEntry(file.slice(0, -'.json'.length)))
    .filter((project): project is RegisteredProject => project !== null && (options.includeMissing === true || existsSync(project.path)))
    .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt) || a.name.localeCompare(b.name))
}

/** Take a project off the list. The project itself is not touched. */
export function forgetProject(project: Pick<RegisteredProject, 'id'>): boolean {
  const file = entryPath(project.id)
  if (!existsSync(file))
    return false

  rmSync(file, { force: true })
  return true
}

/**
 * Drop every listed project whose directory is gone or is no longer a Stacks
 * project, and return the ones dropped. A project on a volume that is not
 * mounted reads as gone, which is why this is asked for and never automatic.
 */
export function pruneProjects(): RegisteredProject[] {
  const stale = listProjects({ includeMissing: true }).filter(project => !isProjectRoot(project.path))
  for (const project of stale)
    forgetProject(project)

  return stale
}

export interface ProjectMatch {
  /** The one project the query names, when it names exactly one. */
  project: Pick<RegisteredProject, 'name' | 'path'> | null
  /** Every listed project the query could mean, when it is ambiguous. */
  candidates: RegisteredProject[]
}

function looksLikePath(query: string): boolean {
  return isAbsolute(query) || query.startsWith('.') || query.startsWith('~') || query.includes('/') || query.includes(sep)
}

function expandHome(query: string): string {
  return query === '~' || query.startsWith('~/') || query.startsWith(`~${sep}`) ? join(homedir(), query.slice(1)) : query
}

function projectAt(directory: string): ProjectMatch {
  const root = findProjectRoot(directory)
  return { project: root ? { name: basename(root), path: realPath(root) } : null, candidates: [] }
}

/**
 * The project a person means by `query`: a path (to the root or anywhere
 * inside it), or the name of a listed project.
 *
 * A name is matched exactly first, then as the start of a name, then anywhere
 * in one, and each step only answers when it is unambiguous: `shop` picks
 * `shop` even when `shop-admin` exists, and `adm` picks `shop-admin` only
 * while nothing else contains it. A bare word that matches no listed project
 * is tried as a directory, so `buddy --project ../other` and
 * `buddy --project other` both work from a sibling.
 */
export function findProject(query: string, cwd: string = process.cwd()): ProjectMatch {
  const wanted = query.trim()
  if (!wanted)
    return { project: null, candidates: [] }

  if (looksLikePath(wanted))
    return projectAt(resolve(cwd, expandHome(wanted)))

  const needle = wanted.toLowerCase()
  const projects = listProjects()
  const tiers = [
    projects.filter(project => project.id === needle || project.name.toLowerCase() === needle),
    projects.filter(project => project.id.startsWith(needle) || project.name.toLowerCase().startsWith(needle)),
    projects.filter(project => project.id.includes(needle) || project.name.toLowerCase().includes(needle)),
  ]

  for (const matches of tiers) {
    if (matches.length === 1)
      return { project: matches[0]!, candidates: [] }
    if (matches.length > 1)
      return { project: null, candidates: matches }
  }

  const directory = resolve(cwd, wanted)
  try {
    if (statSync(directory).isDirectory())
      return projectAt(directory)
  }
  catch {
    // Not a directory either.
  }

  return { project: null, candidates: [] }
}

/** Whether a process is still running. A process we may not signal is running. */
export function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0)
    return false

  try {
    process.kill(pid, 0)
    return true
  }
  catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

function servicesDir(root: string): string {
  // Under `framework/runtime`, the project's machine-local state: gitignored,
  // and safe to delete.
  return join(root, 'storage', 'framework', 'runtime', 'services')
}

function servicePath(root: string, name: string): string {
  return join(servicesDir(root), `${slug(name)}.json`)
}

/**
 * Record that this process serves `service.name` for the project.
 *
 * A server writes its own record, so the record is true however the server
 * was started: by `buddy dev` in a terminal, by `buddy dashboard`, or by the
 * background daemon. Anything asking "is this project's dashboard up, and
 * where" reads it and does not have to have been the one that started it.
 */
export function recordProjectService(root: string, service: ProjectService): void {
  mkdirSync(servicesDir(root), { recursive: true })
  writeAtomic(servicePath(root, service.name), `${JSON.stringify(service, null, 2)}\n`, service.controlToken ? 0o600 : undefined)
}

/**
 * The service a project is running under `name`, or null.
 *
 * A record whose process has died is removed and reads as null: a server that
 * was killed never got to take its own record down.
 */
export function readProjectService(root: string, name: string): ProjectService | null {
  const file = servicePath(root, name)

  let service: ProjectService
  try {
    service = JSON.parse(readFileSync(file, 'utf8')) as ProjectService
  }
  catch {
    return null
  }

  if (typeof service.pid !== 'number' || typeof service.port !== 'number' || typeof service.url !== 'string')
    return null

  if (!isProcessAlive(service.pid)) {
    rmSync(file, { force: true })
    return null
  }

  return { ...service, name }
}

/** Find currently running instances of an owned project service. */
export function listProjectServiceInstances(root: string, name: string): ProjectService[] {
  let files: string[]
  try {
    files = readdirSync(servicesDir(root))
  }
  catch {
    return []
  }
  const prefix = `${slug(name)}-`
  return files.flatMap((file) => {
    if (!file.startsWith(prefix) || !/^\d+\.json$/.test(file.slice(prefix.length)))
      return []
    const service = readProjectService(root, file.slice(0, -5))
    return service && file === `${prefix}${service.pid}.json` ? [service] : []
  })
}

/**
 * Take a service record down. Only the process that wrote it may: a server
 * shutting down late must not remove the record of the one that replaced it.
 */
export function clearProjectService(root: string, name: string, pid: number = process.pid): void {
  const file = servicePath(root, name)
  try {
    if ((JSON.parse(readFileSync(file, 'utf8')) as ProjectService).pid === pid)
      rmSync(file, { force: true })
  }
  catch {
    // Already gone.
  }
}
