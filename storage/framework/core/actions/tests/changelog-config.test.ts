import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadChangelogConfig } from '../src/changelog-config'

test('reads project-specific changelog settings with command overrides', async () => {
  const project = mkdtempSync(join(tmpdir(), 'changelog-config-'))
  try {
    mkdirSync(join(project, 'config'))
    const repo = 'https://github.com/example/project'
    writeFileSync(join(project, 'config/changelog.ts'), `export default { repo: '${repo}', from: 'v1.0.0', excludeCommitTypes: ['ci'] }`)
    const config = await loadChangelogConfig(project, { from: undefined, output: false })
    expect(config).toMatchObject({ dir: project, from: 'v1.0.0', repo, output: false, excludeCommitTypes: ['ci'] })
    expect((await loadChangelogConfig(project, { from: 'v2.0.0' })).from).toBe('v2.0.0')
  }
  finally {
    rmSync(project, { recursive: true, force: true })
  }
})
