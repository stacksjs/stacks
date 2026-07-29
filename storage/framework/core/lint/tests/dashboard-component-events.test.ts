import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOTS = [
  join(import.meta.dir, '../../../defaults/views/dashboard'),
  join(import.meta.dir, '../../../defaults/resources/components/Dashboard'),
]

function walkStxFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory())
      files.push(...walkStxFiles(path))
    else if (entry.endsWith('.stx'))
      files.push(path)
  }
  return files
}

describe('dashboard component event handlers', () => {
  test('consume forwarded component payloads directly', () => {
    const offenders = ROOTS
      .flatMap(walkStxFiles)
      .filter(file => /\s@[a-z][\w:-]*="[^"]*\$event\.detail/.test(readFileSync(file, 'utf8')))
      .map(file => file.replace(`${join(import.meta.dir, '../../../defaults')}/`, ''))

    expect(offenders).toEqual([])
  })

  test('do not pass auto-unwrapped signals to helpers expecting signal wrappers', () => {
    const offenders = ROOTS
      .flatMap(walkStxFiles)
      .filter(file => /function\s+\w+\(\s*\w+\s*:\s*\{\s*set\s*:/.test(readFileSync(file, 'utf8')))
      .map(file => file.replace(`${join(import.meta.dir, '../../../defaults')}/`, ''))

    expect(offenders).toEqual([])
  })
})
