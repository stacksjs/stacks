import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readBuiltGraph, summarizeBuiltGraph, validateBuiltGraph } from './graph'

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

  test('derives and validates graph summaries from retained file manifests', () => {
    const files = [
      { path: 'index.js', bytes: 100, sha256: 'a'.repeat(64) },
      { path: 'chunks/runtime.js', bytes: 50, sha256: 'b'.repeat(64) },
      { path: 'empty.js', bytes: 0, sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
    ]
    const graph = summarizeBuiltGraph(files)
    expect(graph.fileCount).toBe(3)
    expect(graph.totalBytes).toBe(150)
    expect(graph.files.map(file => file.path)).toEqual(['chunks/runtime.js', 'empty.js', 'index.js'])
    expect(() => validateBuiltGraph(graph, 'Runtime graph')).not.toThrow()

    expect(() => validateBuiltGraph({ ...graph, totalBytes: 151 }, 'Runtime graph')).toThrow('summary does not match')
    expect(() => validateBuiltGraph({ ...graph, files: [...graph.files, graph.files[0]!] }, 'Runtime graph')).toThrow('duplicate')
    expect(() => validateBuiltGraph({ ...graph, files: [{ ...graph.files[0]!, path: '../escape.js' }] }, 'Runtime graph')).toThrow('invalid built-file path')
    expect(() => validateBuiltGraph({ ...graph, files: [{ ...graph.files[0]!, sha256: 'nope' }] }, 'Runtime graph')).toThrow('invalid built-file SHA-256')
  })
})
