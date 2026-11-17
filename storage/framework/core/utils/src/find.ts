/* eslint no-console: 0 */
import type { Dirent } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { italic } from '@stacksjs/cli'
import { log } from '@stacksjs/logging'
import { isProjectRoot } from '@stacksjs/path'

/**
 * Directory names never worth entering: dependency and build output, and
 * anything hidden. Matched against the directory's own NAME.
 *
 * These used to be tested against the whole absolute path, and one of them
 * matched the letters "out" anywhere in it: a home directory called `scout`,
 * or a parent folder called `layouts`, silently excluded everything beneath
 * it, and the scan came back empty with no word of why.
 */
const skippedNames = new Set(['node_modules', 'dist', 'out', 'vendor', 'pantry'])

// Home-dir noise, only skipped when the search defaults to `os.homedir()`.
// If the caller passes an explicit `dir`, they've opted in to searching it
// even when it lives under one of these paths (e.g. `~/Documents/Projects`).
const homeOnlyExcludes = ['Documents', 'Pictures', 'Library', 'Movies', 'Music', 'Applications']

/** How far below the search root a project may sit. `~/Code/clients/acme/app` is four. */
const DEFAULT_MAX_DEPTH = 6

interface FindStacksProjectsOptions {
  quiet?: boolean
  /** Levels below the search root to look at. */
  maxDepth?: number
}

const MAX_CONCURRENT_FS_READS = 32
let activeFsReads = 0
const fsReadQueue: Array<() => void> = []

async function withFsReadSlot<T>(operation: () => Promise<T>): Promise<T> {
  if (activeFsReads >= MAX_CONCURRENT_FS_READS)
    await new Promise<void>(resolve => fsReadQueue.push(resolve))

  activeFsReads++
  try {
    return await operation()
  }
  finally {
    activeFsReads--
    fsReadQueue.shift()?.()
  }
}

/**
 * Walk a directory tree for Stacks projects.
 *
 * This is the slow way to learn what is on a machine, kept for the one moment
 * it is needed: `buddy projects:scan`, which adds what it finds to the
 * machine's project list. Everything else reads that list (`listProjects` in
 * `@stacksjs/path`), which a project joins the first time `buddy` runs in it.
 *
 * A project is whatever `isProjectRoot` says it is, the same test `buddy` uses
 * to find the project it was run in. The scan used to have its own: a `buddy`
 * file beside a vendored `storage/framework/core/buddy`, which no app created
 * since the framework moved into `node_modules` has.
 */
export async function findStacksProjects(dir?: string, options?: FindStacksProjectsOptions): Promise<string[]> {
  const root = path.resolve(dir || os.homedir())
  const excluded = new Set(dir ? [] : homeOnlyExcludes.map(name => path.join(root, name)))

  if (!options?.quiet) {
    log.info(`Searching for Stacks projects in: ${italic(root)}`)
    console.log('')
    console.log(italic('  Please note, while Stacks is searching for projects on your machine,'))
    console.log(italic('  you may be asked for permissions to scan certain directories.'))
    console.log('')
  }

  const found = await searchDirectory(root, excluded, options?.maxDepth ?? DEFAULT_MAX_DEPTH)
  return found.sort()
}

async function searchDirectory(directory: string, excluded: ReadonlySet<string>, depth: number): Promise<string[]> {
  // A project's own subdirectories are not searched: what sits inside one is
  // its source, its dependencies and its build output, and that pruning is
  // what keeps a scan of a code folder to a fraction of a second.
  if (isProjectRoot(directory))
    return [directory]

  if (depth <= 0)
    return []

  let items: Dirent[]
  try {
    items = await withFsReadSlot(() => fs.readdir(directory, { withFileTypes: true }))
  }
  catch {
    // Unreadable (a protected folder, a volume that went away): nothing to find.
    return []
  }

  const children = items
    .filter(item => item.isDirectory() && !item.name.startsWith('.') && !skippedNames.has(item.name))
    .map(item => path.join(directory, item.name))
    .filter(child => !excluded.has(child))
    .map(child => searchDirectory(child, excluded, depth - 1))

  return (await Promise.all(children)).flat()
}
