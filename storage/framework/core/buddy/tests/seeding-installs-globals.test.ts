import { describe, expect, it } from 'bun:test'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'

/**
 * Every command that seeds installs the server globals first
 * (stacksjs/stacks#2952).
 *
 * `buddy seed` did and `migrate:fresh --seed` did not, so a job using the bare
 * `db` global, which the auto-import declarations promise, worked from one
 * command and failed with `db is not defined` from the other.
 */
const src = resolve(import.meta.dir, '../src')
const projectRoot = resolve(import.meta.dir, '../../../../..')

describe('seeding', () => {
  it('loads the seeders only after the server globals are installed', () => {
    // No preload, so nothing but loadSeeders() can install the global, and
    // the "before" line is the control: it has to read undefined.
    const scratch = mkdtempSync(join(tmpdir(), 'stacks-seeding-globals-'))
    try {
      const config = join(scratch, 'bunfig.toml')
      const probe = join(scratch, 'probe.ts')
      writeFileSync(config, '')
      writeFileSync(probe, [
        `import { loadSeeders } from ${JSON.stringify(join(src, 'seeding.ts'))}`,
        `console.log('before=' + typeof (globalThis as any).db)`,
        `const seeders = await loadSeeders()`,
        `console.log('after=' + typeof (globalThis as any).db + ' seed=' + typeof seeders.seed + ' app=' + typeof seeders.runApplicationSeeders)`,
        `process.exit(0)`,
      ].join('\n'))

      const result = Bun.spawnSync([process.execPath, `--config=${config}`, probe], { cwd: projectRoot, stdout: 'pipe', stderr: 'pipe' })
      const output = `${result.stdout}${result.stderr}`
      expect(output).toContain('before=undefined')
      expect(output).toContain('after=object seed=function app=function')
    }
    finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  }, 60_000)

  it('is reached by every buddy command that runs seeders, never around it', () => {
    // Comments are stripped first, so prose that names a seeder cannot pass
    // or fail this.
    const transpiler = new Bun.Transpiler({ loader: 'ts', trimUnusedImports: false })
    const files = readdirSync(src, { recursive: true, encoding: 'utf8' })
      .filter(file => file.endsWith('.ts') && file !== 'seeding.ts')

    const bypassing = files.filter(file => /\bimport\(\s*['"]@stacksjs\/database['"]\s*\)[\s\S]{0,200}?\b(?:seed|runApplicationSeeders)\b|\{[^}]*\b(?:runApplicationSeeders)\b[^}]*\}\s*=\s*await import\(\s*['"]@stacksjs\/database['"]/.test(
      transpiler.transformSync(readFileSync(join(src, file), 'utf8')),
    ))
    expect(bypassing).toEqual([])

    const callers = files.filter(file => /\bloadSeeders\(\)/.test(transpiler.transformSync(readFileSync(join(src, file), 'utf8'))))
    expect(callers.sort()).toEqual(['commands/migrate.ts', 'commands/seed.ts'])
  })
})
