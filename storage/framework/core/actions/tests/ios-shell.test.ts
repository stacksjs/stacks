import { expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeIosShellSupport } from '../src/build/ios-shell'

test('a cloud clone restores ignored native sources from the locked package', () => {
  const output = mkdtempSync(join(tmpdir(), 'stacks-ios-shell-'))
  try {
    writeIosShellSupport(output, { appName: 'Example', bundleId: 'org.example.app', shell: { bunVersion: '1.3.14' } }, '1.3.0')
    expect(readFileSync(join(output, '.gitignore'), 'utf8')).toContain('*.swift')
    // The compiled screens ship from dist/; the compiler's own copy is not committed.
    expect(readFileSync(join(output, '.gitignore'), 'utf8')).toContain('/native-screens/\n')
    expect(readFileSync(join(output, '.gitignore'), 'utf8')).toContain('/native-screens.js\n')
    const path = join(output, 'ci_scripts/ci_post_clone.sh')
    const script = readFileSync(path, 'utf8')
    expect(script).toContain('bun-v1.3.14')
    // Cloud runners can reset the TLS connection before any build starts.
    // Retry that transport failure with finite budgets, preserving TLS checks.
    expect(script).toContain('--retry 3 --retry-all-errors --connect-timeout 20 --max-time 90 --retry-max-time 180')
    expect(script).not.toContain('--insecure')
    expect(script).toContain('bun install --frozen-lockfile')
    expect(script).toContain('@stacksjs/mobile/testing')
    expect(script).toContain('--config="$PROJECT_DIR/ci_scripts/bunfig.toml"')
    expect(readFileSync(join(output, 'ci_scripts/bunfig.toml'), 'utf8')).toBe('preload = []\n')
    expect(script).toContain('restoreIosShell(process.argv[1])')
    expect(script).not.toContain(output)
    expect(statSync(path).mode & 0o111).toBe(0o111)
    expect(Bun.spawnSync(['sh', '-n', path]).exitCode).toBe(0)
    expect(() => writeIosShellSupport(output, { appName: 'Example', bundleId: 'org.example.app', shell: { bunVersion: '$(bad)' } })).toThrow()
  }
  finally { rmSync(output, { recursive: true, force: true }) }
})
