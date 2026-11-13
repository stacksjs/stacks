import type { DesktopTargetName } from '@stacksjs/types'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

/**
 * `build.json`: what `buddy build:desktop` made, target by target. A release
 * publishes from it, so it is also how a target built on another machine
 * joins a release: its folder and its record are carried over and imported,
 * and every file is checked against the hash its own build wrote down.
 */

export interface WebviewBuildArtifact {
  /** Relative to the target's folder. */
  name: string
  bytes?: number
  sha256?: string
}

export interface WebviewBuildTarget {
  target: DesktopTargetName
  /** The target's folder, relative to the record. */
  directory: string
  artifacts: WebviewBuildArtifact[]
  remaining?: string
  /** The machine that built it, when it was not this one. */
  builtOn?: string
}

export interface WebviewBuildRecord {
  appName: string
  appId: string
  version: string
  sourceRevision: string | null
  builtOn: string
  bun: string
  targets: WebviewBuildTarget[]
}

/** A file's entry in a build record. A `.app` is a folder and is recorded by name alone. */
export function describeBuildArtifact(directory: string, name: string): WebviewBuildArtifact {
  if (name.endsWith('.app')) return { name }
  const contents = readFileSync(join(directory, name))
  return { name, bytes: contents.byteLength, sha256: createHash('sha256').update(contents).digest('hex') }
}

/** The installers a platform's packaging makes, by extension. */
const INSTALLER_EXTENSIONS = ['.msi', '.appimage', '.deb', '.rpm', '.dmg']

/** Installers under a target's `packages` folder, relative to the target's folder. */
export function findPackagedInstallers(directory: string): string[] {
  const packages = join(directory, 'packages')
  if (!existsSync(packages)) return []
  const found: string[] = []
  const walk = (folder: string, depth: number): void => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const file = join(folder, entry.name)
      if (entry.isDirectory() && depth < 2) walk(file, depth + 1)
      else if (entry.isFile() && INSTALLER_EXTENSIONS.some(extension => entry.name.toLowerCase().endsWith(extension))) found.push(relative(directory, file).split(sep).join('/'))
    }
  }
  walk(packages, 0)
  return found.sort()
}

function inside(parent: string, child: string): boolean {
  const path = relative(parent, child)
  return path !== '' && !path.startsWith('..') && !isAbsolute(path)
}

/**
 * The record after targets are added to it: a target already there is
 * replaced, the others stay. A record for another version, app or commit is
 * not added to: its targets are from a different build and are dropped.
 */
export function mergeBuildRecord(local: WebviewBuildRecord | null, incoming: Pick<WebviewBuildRecord, 'appName' | 'appId' | 'version' | 'sourceRevision' | 'builtOn' | 'bun'>, targets: WebviewBuildTarget[]): { record: WebviewBuildRecord, dropped: DesktopTargetName[] } {
  const same = local && local.appId === incoming.appId && local.version === incoming.version && local.sourceRevision === incoming.sourceRevision
  const added = new Set(targets.map(item => item.target))
  const kept = same ? local.targets.filter(item => !added.has(item.target)) : []
  const base = same ? local : { appName: incoming.appName, appId: incoming.appId, version: incoming.version, sourceRevision: incoming.sourceRevision, builtOn: incoming.builtOn, bun: incoming.bun }
  return {
    record: { ...base, targets: [...kept, ...targets].sort((a, b) => a.target.localeCompare(b.target)) },
    dropped: !same && local ? local.targets.map(item => item.target).filter(target => !added.has(target)) : [],
  }
}

export interface ImportWebviewBuildOptions {
  /** Another machine's desktop output folder (the one holding `build.json`), or one target's folder inside it. */
  from: string
  /** This project's desktop output folder. */
  output: string
  /** What the import must be a build of. */
  appId: string
  version: string
  /** The commit this checkout is at. A build from any other commit is refused. */
  sourceRevision: string
  /** Import only these. Default: every target the record lists. */
  targets?: readonly DesktopTargetName[]
  /** This machine, for the record of a build that names none. */
  host: string
}

export interface ImportedWebviewTarget {
  target: DesktopTargetName
  directory: string
  /** Installers found in `packages` that the record did not list: recorded as found, with nothing to check them against. */
  unrecorded: string[]
}

/**
 * Bring targets built on another machine into this project's build record.
 * Refuses anything that is not the same app, version and commit, and any file
 * that is not the one its build recorded. An installer packaged after the
 * record was written (an MSI made from a folder cross-compiled elsewhere) is
 * added as found.
 */
export function importWebviewBuild(options: ImportWebviewBuildOptions): { imported: ImportedWebviewTarget[], record: WebviewBuildRecord, dropped: DesktopTargetName[], skipped: DesktopTargetName[] } {
  const from = resolve(options.from)
  let recordFile = join(from, 'build.json')
  let only: string | undefined
  if (!existsSync(recordFile)) {
    // One target's folder, with the record beside it.
    recordFile = join(dirname(from), 'build.json')
    only = basename(from)
    if (!existsSync(recordFile)) throw new Error(`${from} has no build.json, and neither does the folder above it. Import the folder \`buddy build:desktop\` wrote on the other machine, with its build.json.`)
  }
  const recordDir = dirname(recordFile)
  let foreign: WebviewBuildRecord
  try {
    foreign = JSON.parse(readFileSync(recordFile, 'utf8')) as WebviewBuildRecord
  }
  catch {
    throw new Error(`${recordFile} is not a build record.`)
  }
  if (!foreign || !Array.isArray(foreign.targets)) throw new Error(`${recordFile} is not a build record.`)
  if (foreign.appId !== options.appId) throw new Error(`${recordFile} is a build of ${foreign.appId}, not ${options.appId}.`)
  if (foreign.version !== options.version) throw new Error(`${recordFile} is version ${foreign.version}, but this project is at ${options.version}.`)
  if (foreign.sourceRevision !== options.sourceRevision)
    throw new Error(`${recordFile} was built from ${String(foreign.sourceRevision).slice(0, 12)}, but this checkout is at ${options.sourceRevision.slice(0, 12)}. A release is one commit: check out the commit it was built from, or build it again from this one.`)

  const asked = foreign.targets.filter(item => (!only || item.directory === only || item.target === only) && (!options.targets?.length || options.targets.includes(item.target)))
  // A record often lists more than was carried over (the Mac's own target, in a folder that holds only the Linux
  // one). A target whose folder is not here is left out, unless it was asked for by name.
  const explicit = Boolean(only || options.targets?.length)
  const present = (item: WebviewBuildTarget): boolean => typeof item.directory === 'string' && inside(recordDir, resolve(recordDir, item.directory)) && existsSync(resolve(recordDir, item.directory))
  const wanted = explicit ? asked : asked.filter(present)
  const skipped = explicit ? [] : asked.filter(item => !present(item)).map(item => item.target)
  if (!wanted.length) throw new Error(`${recordFile} lists none of the targets asked for (it has: ${foreign.targets.map(item => item.target).join(', ') || 'none'}).`)

  // Everything is checked before anything is copied.
  const checked = wanted.map((item) => {
    if (!/^[a-z0-9]+-[a-z0-9_]+$/.test(item.target)) throw new Error(`${recordFile}: ${String(item.target)} is not a target.`)
    const source = resolve(recordDir, item.directory)
    if (!inside(recordDir, source) || !existsSync(source)) throw new Error(`${item.target}: its folder ${item.directory} is not beside ${recordFile}.`)
    for (const artifact of item.artifacts) {
      const file = resolve(source, artifact.name)
      if (!inside(source, file)) throw new Error(`${item.target}: ${artifact.name} is not inside its folder.`)
      if (!existsSync(file)) throw new Error(`${item.target}: ${artifact.name} is in the record but not in ${source}.`)
      if (!artifact.sha256) continue
      const actual = describeBuildArtifact(source, artifact.name)
      if (actual.sha256 !== artifact.sha256 || actual.bytes !== artifact.bytes)
        throw new Error(`${item.target}: ${artifact.name} is not the file that was built (sha256 ${actual.sha256}, the record says ${artifact.sha256}).`)
    }
    const listed = new Set(item.artifacts.map(artifact => artifact.name))
    const unrecorded = findPackagedInstallers(source).filter(name => !listed.has(name))
    return { item, source, unrecorded }
  })

  const output = resolve(options.output)
  mkdirSync(output, { recursive: true })
  const imported: ImportedWebviewTarget[] = []
  const targets: WebviewBuildTarget[] = []
  for (const { item, source, unrecorded } of checked) {
    const directory = join(output, item.target)
    if (resolve(source) !== directory) {
      rmSync(directory, { recursive: true, force: true })
      cpSync(source, directory, { recursive: true, verbatimSymlinks: true })
    }
    targets.push({
      target: item.target,
      directory: item.target,
      artifacts: [...item.artifacts, ...unrecorded.map(name => describeBuildArtifact(directory, name))],
      ...(item.remaining && !unrecorded.length ? { remaining: item.remaining } : {}),
      builtOn: item.builtOn ?? foreign.builtOn,
    })
    imported.push({ target: item.target, directory, unrecorded })
  }

  const localFile = join(output, 'build.json')
  let local: WebviewBuildRecord | null = null
  if (existsSync(localFile) && resolve(localFile) !== resolve(recordFile)) {
    try {
      local = JSON.parse(readFileSync(localFile, 'utf8')) as WebviewBuildRecord
    }
    catch {
      local = null
    }
  }
  else if (resolve(localFile) === resolve(recordFile)) {
    // Imported in place: the record is this project's own, with installers added to it.
    local = foreign
  }
  const merged = mergeBuildRecord(local && Array.isArray(local.targets) ? local : null, { appName: foreign.appName, appId: foreign.appId, version: foreign.version, sourceRevision: foreign.sourceRevision, builtOn: options.host, bun: foreign.bun }, targets)
  writeFileSync(localFile, `${JSON.stringify(merged.record, null, 2)}\n`)
  return { imported, record: merged.record, dropped: merged.dropped, skipped }
}

/** Add what a packaging step made to a target's entry, and write the record. */
export function recordPackagedInstallers(output: string, target: DesktopTargetName): string[] {
  const file = join(output, 'build.json')
  const record = JSON.parse(readFileSync(file, 'utf8')) as WebviewBuildRecord
  const entry = record.targets.find(item => item.target === target)
  if (!entry) throw new Error(`${file} has no ${target}.`)
  const directory = join(output, entry.directory)
  const found = findPackagedInstallers(directory)
  const others = entry.artifacts.filter(artifact => !found.includes(artifact.name))
  const added = found.filter(name => !entry.artifacts.some(artifact => artifact.name === name))
  entry.artifacts = [...others, ...found.map(name => describeBuildArtifact(directory, name))]
  if (found.length) delete entry.remaining
  writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`)
  return added
}
