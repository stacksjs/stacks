import { expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const action = new URL('../src/lint/lint.ts', import.meta.url).pathname

test('template warnings fail the lint budget and lint:fix corrects the actual STX source', () => {
  const root = mkdtempSync(join(tmpdir(), 'stacks-stx-lint-budget-'))
  try {
    writeFileSync(join(root, 'fixture.stx'), '<div class="text-sm px-4">Hello</div>\n')
    writeFileSync(join(root, 'pickier.config.ts'), `export default { pluginRules: { 'pickier/sort-tailwind-classes': 'warn' } }\n`)
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'stx-lint-fixture', type: 'module', private: true }))
    writeFileSync(join(root, 'bunfig.toml'), '')
    const run = (fix = false) => Bun.spawnSync([process.execPath, '-e', `
      import { lintProject } from ${JSON.stringify(action)};
      const result = await lintProject(${JSON.stringify({ maxWarnings: 0, fix })});
      process.exit(result.ok ? 0 : 1);
    `], { cwd: root, stdout: 'pipe', stderr: 'pipe' })

    const warning = run()
    expect(warning.exitCode).toBe(1)
    expect(warning.stdout.toString() + warning.stderr.toString()).toContain('pickier/sort-tailwind-classes')
    expect(run(true).exitCode).toBe(0)
    expect(readFileSync(join(root, 'fixture.stx'), 'utf8')).toContain('class="px-4 text-sm"')
    expect(run().exitCode).toBe(0)
  }
  finally {
    rmSync(root, { recursive: true, force: true })
  }
})

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
