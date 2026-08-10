import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

function actionSources(directory: string): Array<{ file: string, source: string }> {
  const sources: Array<{ file: string, source: string }> = []

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      sources.push(...actionSources(path))
      continue
    }
    if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts'))
      continue

    const source = readFileSync(path, 'utf8')
    if (source.includes('new Action({'))
      sources.push({ file: path, source })
  }

  return sources
}

describe('dashboard request contract', () => {
  const actions = actionSources(resolve('storage/framework/defaults/app/Actions/Dashboard'))

  test('types every action request through RequestInstance', () => {
    for (const { file, source } of actions) {
      const signature = source.match(/async handle\(([^)]*)\)/)?.[1]?.trim() ?? ''
      if (!signature)
        continue

      expect(signature, file).toMatch(/^\w+: RequestInstance(?:<[^>]+>)?$/)
      expect(source, file).toContain("import type { RequestInstance } from '@stacksjs/types'")
    }
  })

  test('does not fall back to ambient or untyped request state', () => {
    for (const { file, source } of actions) {
      expect(source, file).not.toContain('request as any')
      expect(source, file).not.toContain('routerRequest as any')
      expect(source, file).not.toContain('routerRequest')
      expect(source, file).not.toMatch(/import \{[^}]*\brequest\b[^}]*\} from '@stacksjs\/router'/)
      expect(source, file).not.toContain('_authenticatedUser')
    }
  })
})
