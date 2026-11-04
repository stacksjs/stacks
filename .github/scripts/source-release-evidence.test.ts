import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { releaseEvidenceTests } from './source-release-evidence'

test('Mac source acceptance executes the same release tests as Linux and Windows', () => {
  const read = (path: string): any => Bun.YAML.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
  const github = read('../workflows/ci.yml')
  const reviewos = read('../../.reviewos/workflows/release-evidence.yml')
  expect(reviewos.on.push.branches).toEqual(['main'])
  expect(reviewos.permissions).toEqual({ contents: 'read' })
  expect(reviewos.jobs.macos['runs-on']).toEqual(['self-hosted', 'macos-arm64', 'stacks-release'])
  expect(reviewos.jobs.macos.steps[0].run).toContain('process.platform !== "darwin"')
  expect(reviewos.jobs.macos.steps[0].run).toContain('process.arch !== "arm64"')
  expect(reviewos.jobs.macos.steps[0].run).toContain('Bun.version !== "1.4.4"')
  for (const mode of ['build', 'test', 'stress']) {
    const command = `bun .github/scripts/source-release-evidence.ts ${mode}`
    expect(github.jobs['release-evidence'].steps.some((step: any) => step.run === command)).toBe(true)
    expect(reviewos.jobs.macos.steps.some((step: any) => step.run === command)).toBe(true)
  }
  expect(releaseEvidenceTests).toContain('./storage/framework/core/testing/tests/process-tree.test.ts')
  expect(releaseEvidenceTests).toContain('./storage/framework/core/actions/tests/reviewos-evidence.test.ts')
  expect(github.jobs['release-evidence-macos'].steps.some((step: any) => step.run === 'bun .github/scripts/await-reviewos-macos.ts')).toBe(true)
  expect(github.jobs['release-evidence-macos']['runs-on']).toBe('ubuntu-latest')
})
