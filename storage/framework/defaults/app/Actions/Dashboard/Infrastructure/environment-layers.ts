import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { activeEnvName, declaredEnvPublicKey, encryptValue, environmentFiles, envHasCiphertext, parse, resolvePrivateKey } from '@stacksjs/env'
import { projectPath } from '@stacksjs/path'
import { applyEnvironmentEntries, atomicWrite, environmentBackupPath, parseEnvironmentEntries, validateEnvironmentFile } from './environment-file'
import type { EnvironmentFileIssue } from './environment-file'

/**
 * The env files the app loads, read the way it loads them (stacksjs/stacks#3340).
 *
 * The app reads `.env`, `.env.local`, `.env.<env>` and `.env.<env>.local`
 * (`environmentFiles` in @stacksjs/env), and a later file's value replaces an
 * earlier one's. A page that reads and writes `.env` alone shows values the
 * app is not using as soon as another file sets the same key, and its saves
 * change nothing the app reads.
 *
 * So values are read from every file, each with the loader's own parser and
 * private key, and a write goes to the file a key's value comes from.
 *
 * The parser is the loader's, expansion included: a value written
 * `${OTHER}` or `$(allowed-command)` reads as the app reads it.
 */

export interface EnvironmentLayersOptions {
  /** The project directory. Default: the project root. */
  cwd?: string
  /** The environment whose files are read. Default: the one the app loaded (`activeEnvName`). */
  env?: string
  /** The key encrypted values are decrypted with. Default: the app's (`resolvePrivateKey`); null for none. */
  privateKey?: string | null
  /** Where the content a file had before a save is kept. Default: {@link environmentBackupPath}. */
  backupPathFor?: (file: string) => string
}

export interface EnvironmentLayer {
  /** The file's name in the project directory, e.g. `.env.development`. */
  file: string
  content: string
  /** Its entries as written, ciphertext and all. */
  raw: Record<string, string>
}

export interface EnvironmentLayers {
  /** A hash of every file's name and content; a write is refused when it changed. */
  revision: string
  /** The files that exist, in the order the app loads them. */
  layers: EnvironmentLayer[]
  /** The values the app reads, decrypted. */
  entries: Record<string, string>
  /** For each key, the file its value comes from. */
  sources: Record<string, string>
  /**
   * Keys a file loaded after the winning one sets with ciphertext this process
   * cannot decrypt. The loader skips such an entry, so it does not win here;
   * wherever its key is present, it does, and replaces what was saved.
   */
  unreadable: Record<string, string>
}

export interface EnvironmentLayersIssue {
  /** The env key the issue is about, or the file for a whole-file problem. */
  key: string
  message: string
}

function resolved(options: EnvironmentLayersOptions): { cwd: string, privateKey: string | undefined, backupPathFor: (file: string) => string, env: string } {
  const cwd = options.cwd ?? projectPath()
  const env = options.env ?? activeEnvName()
  return {
    cwd,
    env,
    privateKey: options.privateKey === null ? undefined : (options.privateKey ?? resolvePrivateKey({ env, cwd })),
    backupPathFor: options.backupPathFor ?? environmentBackupPath,
  }
}

function isCiphertext(value: string | undefined): boolean {
  return Boolean(value && (value.startsWith('encrypted:') || value.startsWith('enc:')))
}

function revisionOf(layers: EnvironmentLayer[]): string {
  const hash = createHash('sha256')
  for (const layer of layers)
    hash.update(layer.file).update('\0').update(layer.content).update('\0')
  return hash.digest('hex')
}

/** Every env file the app loads, and the value it reads for each key. */
export async function readEnvironmentLayers(options: EnvironmentLayersOptions = {}): Promise<EnvironmentLayers> {
  const { cwd, env, privateKey } = resolved(options)
  const layers: EnvironmentLayer[] = []
  for (const file of environmentFiles(env, cwd)) {
    const content = await readFile(join(cwd, file), 'utf8')
    layers.push({ file, content, raw: parseEnvironmentEntries(content) })
  }

  const entries: Record<string, string> = {}
  const sources: Record<string, string> = {}
  const unreadable: Record<string, string> = {}
  for (const layer of layers) {
    const { parsed, skippedEncrypted } = parse(layer.content, {
      privateKey,
      processEnv: process.env as Record<string, string>,
    })
    for (const [key, value] of Object.entries(parsed)) {
      entries[key] = value
      sources[key] = layer.file
      delete unreadable[key]
    }
    for (const key of skippedEncrypted)
      unreadable[key] = layer.file
  }

  return { revision: revisionOf(layers), layers, entries, sources, unreadable }
}

/** Each layer checked as a file: a malformed one is named, with its line. */
export function environmentLayerIssues(layers: EnvironmentLayers): Array<EnvironmentFileIssue & { file: string }> {
  return layers.layers.flatMap(layer => validateEnvironmentFile(layer.content).map(issue => ({ ...issue, file: layer.file })))
}

/**
 * Write each key to the file the app reads it from, or to `.env` when no file
 * sets it.
 *
 * A value that is encrypted in that file stays encrypted, under the file's own
 * public key, and so does a key named in `secrets` in a file that holds any
 * ciphertext. An empty value is written as it is. Each changed file is
 * replaced atomically, after its old content is kept as its backup.
 */
export async function updateEnvironmentLayers(
  updates: Record<string, string>,
  revision: string,
  options: EnvironmentLayersOptions & { secrets?: readonly string[] } = {},
): Promise<{ layers?: EnvironmentLayers, conflict?: true, issues?: EnvironmentLayersIssue[] }> {
  const current = await readEnvironmentLayers(options)
  if (current.revision !== revision)
    return { conflict: true }

  const { cwd, backupPathFor } = resolved(options)
  const secrets = new Set(options.secrets ?? [])
  const byFile = new Map<string, Record<string, string>>()
  const issues: EnvironmentLayersIssue[] = []

  for (const [key, value] of Object.entries(updates)) {
    const file = current.sources[key] ?? '.env'
    const layer = current.layers.find(candidate => candidate.file === file)
    const content = layer?.content ?? ''
    const encrypt = value !== '' && (isCiphertext(layer?.raw[key]) || (secrets.has(key) && envHasCiphertext(content)))

    let written = value
    if (encrypt) {
      const publicKey = declaredEnvPublicKey(content, file)?.key
      if (!publicKey) {
        issues.push({ key, message: `${file} holds encrypted values but declares no public key. Repair it before changing ${key}.` })
        continue
      }
      try {
        written = encryptValue(value, publicKey)
      }
      catch {
        issues.push({ key, message: `${key} could not be encrypted with the public key ${file} declares.` })
        continue
      }
    }

    byFile.set(file, { ...byFile.get(file), [key]: written })
  }

  if (issues.length)
    return { issues }

  const rewritten = [...byFile].map(([file, fileUpdates]) => {
    const layer = current.layers.find(candidate => candidate.file === file)
    return { file, before: layer?.content, after: applyEnvironmentEntries(layer?.content ?? '', fileUpdates) }
  })
  for (const { file, after } of rewritten) {
    for (const issue of validateEnvironmentFile(after))
      issues.push({ key: file, message: issue.line ? `${file} line ${issue.line}: ${issue.message}` : `${file}: ${issue.message}` })
  }
  if (issues.length)
    return { issues }

  for (const { file, before, after } of rewritten) {
    if (before !== undefined)
      await atomicWrite(backupPathFor(file), before)
    await atomicWrite(join(cwd, file), after)
  }

  return { layers: await readEnvironmentLayers(options) }
}

/**
 * The env files a person can open on the Environment page: `.env`, which a
 * project always has a place for, and every other file the app loads. A file
 * name from a request is only ever one of these, so it cannot name a path.
 */
export function editableEnvironmentFiles(layers: EnvironmentLayers): string[] {
  return ['.env', ...layers.layers.map(layer => layer.file).filter(file => file !== '.env')]
}

export interface KeyReadElsewhere {
  key: string
  /** The later file the app reads the key from instead. */
  file: string
  /**
   * False when that file holds it encrypted and this server cannot decrypt it:
   * the app here still reads this file's value, but wherever that file's key
   * is present, it reads the later one.
   */
  readable: boolean
}

/**
 * The keys a file sets whose value the app takes from a file it loads later,
 * so editing them in this one changes nothing it reads.
 */
export function keysReadElsewhere(layers: EnvironmentLayers, file: string): KeyReadElsewhere[] {
  const order = layers.layers.map(layer => layer.file)
  const position = order.indexOf(file)
  const layer = layers.layers[position]
  if (!layer)
    return []

  return Object.keys(layer.raw).flatMap((key): KeyReadElsewhere[] => {
    const source = layers.sources[key]
    if (source && order.indexOf(source) > position)
      return [{ key, file: source, readable: true }]
    const unreadable = layers.unreadable[key]
    if (unreadable && order.indexOf(unreadable) > position)
      return [{ key, file: unreadable, readable: false }]
    return []
  })
}
