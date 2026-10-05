import type { Hash } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { path as p } from '@stacksjs/path'
import { fs } from './fs'

/**
 * Feed `path` - a file, a directory tree, a symlink, or nothing - into `hash`.
 *
 * What is hashed is the tree's SHAPE as well as its bytes, as length-prefixed
 * records: each entry's kind and its name relative to `path`, then a file's
 * length and contents. It used to be the contents alone, concatenated in
 * whatever order `readdir` returned:
 *
 *   - renaming or moving a file left the hash unchanged, so
 *     `websiteSourceHash()` saw no change in a site whose view had moved;
 *   - `a.txt` = "ab" beside `b.txt` = "c" hashed as `a.txt` = "a" beside
 *     `b.txt` = "bc";
 *   - `readdir` order is the filesystem's - sorted on APFS, hash order on
 *     ext4 - so one tree hashed differently on a laptop and in CI.
 *
 * Names are relative, so the same tree hashes the same wherever it sits.
 * A symlink is hashed as its target rather than followed, which also keeps a
 * link back up the tree from recursing forever. A path that does not exist
 * hashes as missing, so creating it changes the hash.
 */
export function hashFileOrDirectory(path: string, hash: Hash): void {
  hashEntry(path, '.', hash)
}

function record(hash: Hash, ...fields: Array<string | number>): void {
  for (const field of fields) {
    const text = String(field)
    hash.update(`${Buffer.byteLength(text)}:`)
    hash.update(text)
  }
}

function hashEntry(path: string, name: string, hash: Hash): void {
  let stat: ReturnType<typeof fs.lstatSync>
  try {
    stat = fs.lstatSync(path)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      throw error
    record(hash, 'missing', name)
    return
  }

  if (stat.isSymbolicLink()) {
    record(hash, 'link', name, fs.readlinkSync(path))
    return
  }

  if (stat.isDirectory()) {
    record(hash, 'directory', name)
    // Code-point order, the same on every filesystem.
    const entries = fs.readdirSync(path).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    for (const entry of entries)
      hashEntry(p.join(path, entry), name === '.' ? entry : `${name}/${entry}`, hash)
    return
  }

  const contents = fs.readFileSync(path)
  record(hash, 'file', name, contents.length)
  hash.update(contents)
}

export function hashDirectory(directory: string): string {
  return hashPath(directory)
}

export function hashPath(path: string): string {
  const hash = createHash('sha256')
  hashFileOrDirectory(path, hash)
  return hash.digest('hex')
}

/** Hash several paths together. Their order counts, so pass them in a fixed one. */
export function hashPaths(paths: string | string[]): string {
  const hash = createHash('sha256')
  const pathsArray = Array.isArray(paths) ? paths : [paths]

  pathsArray.forEach((path, index) => {
    // Each root is told apart by its position, not its absolute location,
    // which differs between machines.
    record(hash, 'root', index)
    hashFileOrDirectory(path, hash)
  })

  return hash.digest('hex')
}
