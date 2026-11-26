import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'bun:test'

describe('bootstrap package apps', () => {
  it('recognizes an unvendored Stacks app', () => {
    const file = join(import.meta.dir, '../../../../../bootstrap')
    const source = readFileSync(file, 'utf8')
    expect(source).toContain('is_stacks_app()')
    expect(source).toContain('&& ! is_stacks_app')
    expect(source).toContain('"stacks"[[:space:]]*:')
  })

  it('publishes the root bootstrap as package-project support', () => {
    const build = readFileSync(join(import.meta.dir, '../../defaults/build.ts'), 'utf8')
    expect(build).toContain("'../../../../bootstrap'")
    expect(build).toContain("'project/bootstrap'")
  })
})

it.skipIf(process.platform === 'win32')('installs the locked CLI before running setup in a clean package app', async () => {
  const root = mkdtempSync(join(tmpdir(), 'stacks-bootstrap-package-'))
  const trace = join(root, 'bootstrap.trace')
  const file = join(import.meta.dir, '../../../../../bootstrap')
  try {
    mkdirSync(join(root, 'bin'))
    writeFileSync(join(root, 'package.json'), '{"dependencies":{"stacks":"1.0.0"}}')
    writeFileSync(join(root, 'bun.lock'), '{}')
    writeFileSync(join(root, 'bin/pantry'), `#!/bin/sh
set -eu
test "$*" = "install --ignore-scripts"
printf '%s\n' "+ pantry" >> "$BOOTSTRAP_TRACE"
mkdir -p pantry/.bin
cat > pantry/.bin/bun <<'BUN'
#!/bin/sh
set -eu
test "$*" = "install --frozen-lockfile"
printf '%s\n' "+ bun" >> "$BOOTSTRAP_TRACE"
mkdir -p node_modules/@stacksjs/buddy/dist
touch node_modules/@stacksjs/buddy/dist/cli.js
BUN
chmod +x pantry/.bin/bun
`, { mode: 0o755 })
    writeFileSync(join(root, 'buddy'), `#!/bin/sh
set -eu
test -f node_modules/@stacksjs/buddy/dist/cli.js
test "$*" = "setup --skip-aws"
printf '%s\n' "+ setup" >> "$BOOTSTRAP_TRACE"
`, { mode: 0o755 })
    const env = { ...process.env, PATH: `${join(root, 'bin')}${delimiter}${process.env.PATH}`, BOOTSTRAP_TRACE: trace }
    const run = async () => {
      const child = Bun.spawn(['sh', file], { cwd: root, env, stdout: 'pipe', stderr: 'pipe' })
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      expect(code, stdout + stderr).toBe(0)
    }
    await run()
    await run()
    expect(readFileSync(trace, 'utf8').trim().split('\n')).toEqual(['+ pantry', '+ bun', '+ setup', '+ setup'])
  }
  finally {
    rmSync(root, { recursive: true, force: true })
  }
})
