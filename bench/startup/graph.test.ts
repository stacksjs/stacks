import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readBuiltGraph } from './graph'

const temporaryDirectories: string[] = []

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-startup-graph-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { force: true, recursive: true })
})

describe('built startup graph', () => {
  test('resolves extensionless files and directory indexes', async () => {
    const root = temporaryDirectory()
    mkdirSync(join(root, 'nested'))
    writeFileSync(join(root, 'entry.js'), 'export * from "./helper"; import "./nested"')
    writeFileSync(join(root, 'helper.js'), 'export const helper = true')
    writeFileSync(join(root, 'nested/index.js'), 'export const nested = true')

    const graph = await readBuiltGraph(join(root, 'entry.js'), root)
    expect(graph.files.map(file => file.path)).toEqual(['entry.js', 'helper.js', 'nested/index.js'])
    expect(graph.fileCount).toBe(3)
    expect(graph.totalBytes).toBeGreaterThan(0)
    expect(graph.digest).toHaveLength(64)
  })

  test('rejects unresolved and escaping local imports', async () => {
    const parent = temporaryDirectory()
    const root = join(parent, 'dist')
    mkdirSync(root)
    writeFileSync(join(parent, 'outside.js'), 'export const outside = true')
    writeFileSync(join(root, 'missing.js'), 'import "./absent"')
    writeFileSync(join(root, 'escape.js'), 'import "../outside.js"')

    expect(readBuiltGraph(join(root, 'missing.js'), root)).rejects.toThrow('Cannot resolve local built import')
    expect(readBuiltGraph(join(root, 'escape.js'), root)).rejects.toThrow('escapes its root')
  })
})
