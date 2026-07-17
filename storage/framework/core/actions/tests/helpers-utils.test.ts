import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'bun:test'
import { developmentConditionForProject } from '../src/helpers/utils'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function projectRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'stacks-action-condition-'))
  roots.push(root)
  return root
}

describe('developmentConditionForProject', () => {
  it('enables source exports for a vendored workspace app', () => {
    const root = projectRoot()
    mkdirSync(join(root, 'storage/framework/core'), { recursive: true })
    mkdirSync(join(root, 'node_modules/@stacksjs/env/src'), { recursive: true })
    writeFileSync(join(root, 'node_modules/@stacksjs/env/src/index.ts'), '')

    expect(developmentConditionForProject(root)).toBe('--conditions development')
  })

  it('leaves published dist-only installs unchanged', () => {
    const root = projectRoot()
    mkdirSync(join(root, 'storage/framework/core'), { recursive: true })

    expect(developmentConditionForProject(root)).toBe('')
  })
})
