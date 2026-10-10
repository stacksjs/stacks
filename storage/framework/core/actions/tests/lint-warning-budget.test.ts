import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const action = new URL('../src/lint/lint.ts', import.meta.url).pathname

test('warning budgets fail a warning-only project while preserving the default policy', () => {
  const root = mkdtempSync(join(tmpdir(), 'stacks-warning-budget-'))
  try {
    writeFileSync(join(root, 'fixture.ts'), 'export const a = 1; export const b = 2\n')
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'lint-fixture', type: 'module', private: true }))
    writeFileSync(join(root, 'bunfig.toml'), '')
    const run = (budget?: number) => Bun.spawnSync([process.execPath, '-e', `
      import { lintProject } from ${JSON.stringify(action)};
      const result = await lintProject(${budget === undefined ? '{}' : JSON.stringify({ maxWarnings: budget })});
      process.exit(result.ok ? 0 : 1);
    `], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
    expect(run().exitCode).toBe(0)
    expect(run(0).exitCode).toBe(1)
    writeFileSync(join(root, 'fixture.ts'), 'export const a = 1\nexport const b = 2\n')
    const clean = run(0)
    expect(clean.stdout.toString() + clean.stderr.toString()).toContain('0 errors and 0 warnings')
    expect(clean.exitCode).toBe(0)
    expect(run(-2).exitCode).toBe(1)
    expect(run(0.5).exitCode).toBe(1)
  }
  finally {
    rmSync(root, { recursive: true, force: true })
  }
})
