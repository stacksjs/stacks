import { closeSync, constants, lstatSync, openSync, readFileSync, readdirSync, readlinkSync, realpathSync, statfsSync } from 'node:fs'
import { dirname, join } from 'node:path'

const releaseId = /^[0-9a-f]{7,40}$/
export const day = 86_400_000

export function diskUsage(path: string): number {
  const stats = statfsSync(path)
  const used = stats.blocks - stats.bfree
  return Math.ceil(100 * used / (used + stats.bavail))
}

export function isReferenced(path: string, references: ReadonlySet<string>): boolean {
  for (const reference of references) {
    if (reference === path || reference.startsWith(`${path}/`))
      return true
  }
  return false
}

function whenPresent<T>(read: () => T): T | undefined {
  try {
    return read()
  }
  catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== 'ENOENT' && code !== 'ESRCH')
      throw error
  }
}

export function processReferences(proc = '/proc'): Set<string> {
  const references = new Set<string>()
  // A bind mount can have the same device ID as the releases directory.
  for (const row of readFileSync(join(proc, 'self/mountinfo'), 'utf8').trimEnd().split('\n')) {
    const path = row.split(' ')[4]
    if (!path)
      throw new Error('Cannot read mounted paths for host maintenance')
    references.add(path.replace(/\\([0-7]{3})/g, (_, octal) => String.fromCharCode(Number.parseInt(octal, 8))))
  }
  for (const pid of readdirSync(proc)) {
    if (!/^\d+$/.test(pid))
      continue
    const process = join(proc, pid)
    const descriptors = whenPresent(() => readdirSync(join(process, 'fd')))
    if (!descriptors)
      continue
    for (const entry of ['cwd', 'exe', ...descriptors.map(name => `fd/${name}`)]) {
      const path = whenPresent(() => readlinkSync(join(process, entry)))
      if (path?.startsWith('/'))
        references.add(path.replace(/ \(deleted\)$/, ''))
    }
    const argv = whenPresent(() => readFileSync(join(process, 'cmdline'), 'utf8'))
    for (const arg of argv?.split('\0') ?? []) {
      if (arg.startsWith('/'))
        references.add(arg)
    }
  }
  return references
}

type FileLock = () => void

export async function tryFileLock(path: string, create = false): Promise<FileLock | undefined> {
  const flags = constants.O_RDWR | constants.O_NOFOLLOW | (create ? constants.O_CREAT : 0)
  const fd = whenPresent(() => openSync(path, flags, 0o600))
  if (fd === undefined)
    return
  let held = false
  try {
    // The child acquires the lock on the same open file description. It stays
    // held by this descriptor until the callback finishes and it is closed.
    const child = Bun.spawn(['flock', '-n', '-E', '75', '3'], { stdio: ['ignore', 'ignore', 'ignore', fd] })
    const code = await child.exited
    if (code === 75)
      return
    if (code !== 0)
      throw new Error('Unable to acquire the host maintenance lock')
    held = true
    return () => closeSync(fd)
  }
  finally {
    if (!held)
      closeSync(fd)
  }
}

export async function withSiteLocks(sites: string[], operation: () => Promise<void>): Promise<boolean> {
  const releases: FileLock[] = []
  try {
    for (const site of sites.sort()) {
      const release = await tryFileLock(join(site, '.ts-cloud/deploy.lock'))
      if (!release)
        return false
      releases.push(release)
    }
    await operation()
    return true
  }
  finally {
    for (const release of releases.reverse())
      release()
  }
}

export function managedSites(webRoot: string): Array<{ site: string, project: string }> {
  const sites: Array<{ site: string, project: string }> = []
  for (const entry of readdirSync(webRoot, { withFileTypes: true })) {
    if (!entry.isDirectory())
      continue
    const site = join(webRoot, entry.name)
    const owner = join(site, '.ts-cloud/owner')
    if (!lstatSync(owner, { throwIfNoEntry: false })?.isFile())
      continue
    const project = readFileSync(owner, 'utf8').trim()
    if (/^[a-z0-9_-]+$/i.test(project))
      sites.push({ site, project })
  }
  return sites.sort((a, b) => a.site.localeCompare(b.site))
}

export function releaseCandidates(site: string, references: ReadonlySet<string>, now = Date.now()): string[] {
  site = realpathSync(site)
  const releases = join(site, 'releases')
  const current = join(site, 'current')
  if (!lstatSync(releases, { throwIfNoEntry: false })?.isDirectory()
    || !lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink())
    return []
  const active = whenPresent(() => realpathSync(current))
  if (!active || dirname(active) !== releases || !lstatSync(active, { throwIfNoEntry: false })?.isDirectory())
    return []
  const siteDev = lstatSync(site).dev
  const candidates = readdirSync(releases)
    .filter(name => releaseId.test(name))
    .map(name => ({ path: join(releases, name), stats: lstatSync(join(releases, name), { throwIfNoEntry: false }) }))
    .filter(({ stats }) => stats?.isDirectory() && stats.dev === siteDev)
    .sort((a, b) => b.stats!.mtimeMs - a.stats!.mtimeMs)
  const rollback = join(site, '.ts-cloud/previous-release')
  const previous = lstatSync(rollback, { throwIfNoEntry: false })?.isFile()
    ? readFileSync(rollback, 'utf8').trim()
    : ''
  const keep = new Set([active, ...candidates.slice(0, 2).map(({ path }) => path)])
  if (releaseId.test(previous))
    keep.add(join(releases, previous))
  return candidates.filter(({ path, stats }) => !keep.has(path) && now - stats!.mtimeMs >= day
    && !isReferenced(path, references)).map(({ path }) => path)
}
