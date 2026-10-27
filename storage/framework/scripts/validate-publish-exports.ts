#!/usr/bin/env bun
import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { copyFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, posix, resolve } from 'node:path'

const manifestPath = process.argv[2]
const outputPath = process.argv[3]
if (!manifestPath)
  throw new Error('Usage: validate-publish-exports <package.json> [output.tgz]')

const directory = dirname(resolve(manifestPath))
const temporary = await mkdtemp(join(tmpdir(), 'stacks-publish-exports-'))

function run(command: string[], cwd: string): string {
  const result = Bun.spawnSync(command, { cwd, stdout: 'pipe', stderr: 'pipe' })
  if (result.exitCode !== 0)
    throw new Error(`Package payload check failed: ${new TextDecoder().decode(result.stderr).trim()}`)
  return new TextDecoder().decode(result.stdout)
}

function targets(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (!value || typeof value !== 'object') return []
  return Object.values(value).flatMap(targets)
}

try {
  const archive = join(temporary, 'package.tgz')
  run([process.execPath, 'pm', 'pack', '--ignore-scripts', '--filename', archive, '--quiet'], directory)
  const members = new Set(run(['tar', '-tzf', archive], directory).split('\n').filter(name => name && !name.endsWith('/')))
  const manifest = JSON.parse(run(['tar', '-xOzf', archive, 'package/package.json'], directory)) as {
    name?: string
    version?: string
    exports?: unknown
    bin?: unknown
    main?: unknown
    module?: unknown
    types?: unknown
    typings?: unknown
  }
  const entries = [...new Set([
    ...targets(manifest.exports), ...targets(manifest.bin),
    ...[manifest.main, manifest.module, manifest.types, manifest.typings].filter((value): value is string => typeof value === 'string'),
  ])]
  if (!entries.length)
    throw new Error(`${manifest.name} declares no public entrypoints`)
  for (const entry of entries) {
    const normalized = posix.normalize(entry)
    if (posix.isAbsolute(normalized) || normalized === '..' || normalized.startsWith('../'))
      throw new Error(`${manifest.name} exports a path outside its package: ${entry}`)
    const member = `package/${normalized.replace(/^\.\//, '')}`
    const pattern = new RegExp(`^${member.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`)
    if (![...members].some(name => pattern.test(name)))
      throw new Error(`${manifest.name} exports ${entry}, but that file is absent from its package payload`)
  }
  if (outputPath)
    await copyFile(archive, resolve(outputPath), constants.COPYFILE_EXCL)
  const bytes = await Bun.file(archive).arrayBuffer()
  console.log(`Verified ${entries.length} public export targets in ${manifest.name}'s package payload`)
  console.log(`Prepared ${manifest.name}@${manifest.version}`)
  console.log(`Payload SHA512: sha512-${createHash('sha512').update(new Uint8Array(bytes)).digest('base64')}`)
  console.log(`Payload SHA1: ${createHash('sha1').update(new Uint8Array(bytes)).digest('hex')}`)
}
finally { await rm(temporary, { recursive: true, force: true }) }
