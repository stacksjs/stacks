import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildProjectContext } from '../src/context'
import { getRepoContext } from '../src/buddy'

const temporaryRoots: string[] = []

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'stacks-ai-context-'))
  temporaryRoots.push(root)
  for (const directory of ['app/Actions', 'app/Models', 'config', 'node_modules/noisy', 'routes', 'tests'])
    mkdirSync(join(root, directory), { recursive: true })

  writeFileSync(join(root, 'package.json'), JSON.stringify({
    name: 'example-stacks-app',
    version: '1.2.3',
    scripts: { build: 'SECRET_TOKEN=do-not-copy bun build', test: 'bun test' },
    dependencies: { '@stacksjs/actions': '1.0.0', '@stacksjs/orm': '1.0.0' },
  }, null, 2))
  writeFileSync(join(root, 'AGENTS.md'), 'Use the Stacks conventions.')
  writeFileSync(join(root, '.env'), 'SECRET_TOKEN=visible-nowhere')
  writeFileSync(join(root, 'bun.lock'), 'large lock')
  writeFileSync(join(root, 'node_modules/noisy/index.ts'), 'ignore me')
  writeFileSync(join(root, 'app/Actions/CreatePost.ts'), 'export default {}')
  writeFileSync(join(root, 'app/Models/Post.ts'), 'export default {}')
  writeFileSync(join(root, 'config/app.ts'), 'export default {}')
  writeFileSync(join(root, 'routes/api.ts'), 'export default {}')
  writeFileSync(join(root, 'tests/post.test.ts'), 'export default {}')
  writeFileSync(join(root, 'README.md'), 'A'.repeat(2000))
  return root
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('Stacks AI project context', () => {
  it('builds deterministic high-signal context without secret or dependency paths', () => {
    const root = fixture()
    const first = buildProjectContext(root)
    const second = buildProjectContext(root)

    expect(first).toEqual(second)
    expect(first.context.schemaVersion).toBe('1.0.0')
    expect(first.context.architecture.pattern).toBe('Model-View-Action')
    expect(first.context.instructionFiles).toEqual(['AGENTS.md'])
    expect(first.context.project.scripts).toEqual(['build', 'test'])
    expect(first.context.project.dependencies).toEqual(['@stacksjs/actions', '@stacksjs/orm'])
    expect(first.text).toContain('app/Models/Post.ts')
    expect(first.text).not.toContain('SECRET_TOKEN')
    expect(first.text).not.toContain('.env')
    expect(first.text).not.toContain('node_modules')
    expect(first.text).not.toContain('bun.lock')
  })

  it('enforces the prompt character budget and reports heuristic savings', () => {
    const result = buildProjectContext(fixture(), { maxChars: 512, model: 'claude-sonnet-4' })

    expect(result.text.length).toBeLessThanOrEqual(512)
    expect(result.metrics.outputCharacters).toBe(result.text.length)
    expect(result.metrics.truncated).toBeTrue()
    expect(result.metrics.estimatedTokens).toBeGreaterThan(0)
    expect(result.metrics.baselineEstimatedTokens).toBeGreaterThan(result.metrics.estimatedTokens)
    expect(result.metrics.estimatedTokenReductionPercent).toBeGreaterThan(0)
    expect(result.metrics.tokenEstimateIsHeuristic).toBeTrue()
  })

  it('keeps the existing Buddy API on the compact representation', async () => {
    const root = fixture()
    expect(await getRepoContext(root)).toBe(buildProjectContext(root).text)
  })

  it('rejects unusable budgets', () => {
    expect(() => buildProjectContext(fixture(), { maxChars: 255 })).toThrow('at least 256')
  })
})
