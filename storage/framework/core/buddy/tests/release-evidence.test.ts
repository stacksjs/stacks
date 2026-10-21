import { expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

test('release:verify exits nonzero and preserves a prior receipt for invalid plans', async () => {
  const checkout = resolve(import.meta.dir, '../../../../..')
  const root = mkdtempSync(join(tmpdir(), 'buddy-release-evidence-'))
  try {
    const runner = join(root, 'buddy.ts')
    writeFileSync(runner, `import { cli } from ${JSON.stringify(join(checkout, 'storage/framework/core/cli/src/index.ts'))}
import { release } from ${JSON.stringify(join(checkout, 'storage/framework/core/buddy/src/commands/release.ts'))}
globalThis.fetch = async () => { throw new Error('Invalid plans must not request external evidence') }
const buddy = cli('buddy')
release(buddy)
await buddy.parse()
`)
    writeFileSync(join(root, 'receipt.json'), 'retained successful historical receipt\n')
    for (const input of ['{}', 'malformed JSON']) {
      writeFileSync(join(root, 'plan.json'), input)
      const child = Bun.spawn([
        process.execPath, '--no-env-file', '--tsconfig-override', join(checkout, 'storage/framework/tsconfig.framework.json'),
        runner, 'release:verify', 'plan.json', '--output', 'receipt.json',
      ], { cwd: root, env: { PATH: process.env.PATH, APP_ENV: 'test', NODE_ENV: 'test' }, stdout: 'pipe', stderr: 'pipe' })
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      expect(code, `${stdout}\n${stderr}`).not.toBe(0)
      expect(`${stdout}\n${stderr}`).toContain('Release verification failed')
      expect(readFileSync(join(root, 'receipt.json'), 'utf8')).toBe('retained successful historical receipt\n')
      expect(readdirSync(root).filter(path => path.endsWith('.tmp'))).toEqual([])
    }
  }
  finally {
    rmSync(root, { recursive: true, force: true })
  }
})
