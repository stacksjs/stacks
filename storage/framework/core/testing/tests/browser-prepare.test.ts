import { describe, expect, test } from 'bun:test'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { runIsolated } from '../src/isolated'

describe.skipIf(process.platform !== 'darwin')('macOS browser preparation', () => {
  test('signs every real framework version and retains an invalid cached bundle while preparing its replacement', async () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-browser-signing-'))
    const run = (command: string[]): void => {
      const result = Bun.spawnSync(command, { stdout: 'pipe', stderr: 'pipe' })
      expect(result.exitCode, result.stderr.toString()).toBe(0)
    }
    try {
      const contents = join(root, 'Source.app', 'Contents'), source = join(contents, 'MacOS/FixtureBrowser')
      const framework = join(contents, 'Frameworks/Fixture.framework'), versions = join(framework, 'Versions')
      const info = (id: string, executable: string, kind: string) => `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>${id}</string><key>CFBundleExecutable</key><string>${executable}</string><key>CFBundlePackageType</key><string>${kind}</string><key>CFBundleShortVersionString</key><string>1.0</string><key>CFBundleVersion</key><string>1</string></dict></plist>`
      mkdirSync(join(contents, 'MacOS'), { recursive: true })
      mkdirSync(join(contents, 'Resources'))
      writeFileSync(join(contents, 'Info.plist'), info('example.fixture.browser', 'FixtureBrowser', 'APPL'))
      writeFileSync(join(contents, 'Resources/payload'), 'original payload')
      const appCode = join(root, 'main.c'), frameworkCode = join(root, 'framework.c')
      writeFileSync(appCode, 'int main(void) { return 0; }\n')
      writeFileSync(frameworkCode, 'int fixture(void) { return 42; }\n')
      run(['/usr/bin/clang', appCode, '-o', source])
      for (const version of ['A', 'B']) {
        const at = join(versions, version)
        mkdirSync(join(at, 'Resources'), { recursive: true })
        writeFileSync(join(at, 'Resources/Info.plist'), info('example.fixture.framework', 'Fixture', 'FMWK'))
        run(['/usr/bin/clang', '-dynamiclib', frameworkCode, '-o', join(at, 'Fixture'), '-install_name', `@rpath/Fixture.framework/Versions/${version}/Fixture`])
        run(['/usr/bin/codesign', '--force', '--sign', '-', '--requirements', '=designated => identifier "example.fixture.framework"', at])
      }
      symlinkSync('B', join(versions, 'Current'))
      symlinkSync('Versions/Current/Fixture', join(framework, 'Fixture'))
      symlinkSync('Versions/Current/Resources', join(framework, 'Resources'))
      run(['/usr/bin/codesign', '--force', '--sign', '-', join(root, 'Source.app')])
      run(['/usr/bin/codesign', '--verify', '--deep', '--strict', join(root, 'Source.app')])
      const script = join(root, 'prepare.ts'), directory = join(root, 'prepared')
      const browser = pathToFileURL(join(import.meta.dir, '../src/browser.ts')).href
      writeFileSync(script, `import { prepareMacChrome } from ${JSON.stringify(browser)}\nconsole.log(JSON.stringify(prepareMacChrome(${JSON.stringify({ source, directory })})))\n`)
      const prepare = async () => {
        const result = await runIsolated(script, { cwd: root, inheritEnv: false, envFile: false, preload: [], env: { PATH: '/usr/bin:/bin' }, timeoutMs: 15000 })
        expect(result.timedOut).toBe(false)
        expect(result.code, result.stderr).toBe(0)
        return JSON.parse(result.stdout) as { app: string, executable: string, reused: boolean }
      }
      const first = await prepare()
      expect(first.reused).toBe(false)
      run(['/usr/bin/codesign', '--verify', '--deep', '--strict', first.app])
      expect(await prepare()).toEqual({ ...first, reused: true })
      writeFileSync(join(first.app, 'Contents/Resources/payload'), 'invalidated cached payload')
      const replacement = await prepare()
      expect(replacement.reused).toBe(false)
      expect(replacement.app).not.toBe(first.app)
      expect(readFileSync(join(first.app, 'Contents/Resources/payload'), 'utf8')).toBe('invalidated cached payload')
      expect(readFileSync(join(replacement.app, 'Contents/Resources/payload'), 'utf8')).toBe('original payload')
      run(['/usr/bin/codesign', '--verify', '--deep', '--strict', replacement.app])
      expect(await prepare()).toEqual({ ...replacement, reused: true })
      expect(readFileSync(join(contents, 'Resources/payload'), 'utf8')).toBe('original payload')
      run(['/usr/bin/codesign', '--verify', '--deep', '--strict', join(root, 'Source.app')])
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 60000)

  test('copies a fresh bundle with native clone semantics despite a GNU-first PATH, then reuses it', async () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-browser-prepare-'))
    try {
      const bin = join(root, 'bin')
      const contents = join(root, 'Source.app', 'Contents')
      const source = join(contents, 'MacOS', 'FixtureBrowser')
      const sourceInfo = join(contents, 'Info.plist')
      const directory = join(root, 'prepared')
      const copyMarker = join(root, 'path-cp-called')
      const signMarker = join(root, 'signing-stub-called')
      mkdirSync(bin)
      mkdirSync(join(contents, 'MacOS'), { recursive: true })
      const originalInfo = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>FixtureBrowser</string>
<key>CFBundleShortVersionString</key><string>1.2.3-fixture</string>
<key>CFBundleIdentifier</key><string>example.original.fixture</string>
<key>KSProductID</key><string>fixture-product</string>
<key>KSUpdateURL</key><string>https://example.invalid/update</string>
<key>KSChannelID</key><string>fixture-channel</string>
<key>KSVersion</key><string>fixture-version</string>
</dict></plist>
`
      writeFileSync(sourceInfo, originalInfo)
      writeFileSync(source, '#!/bin/sh\nexit 0\n', { mode: 0o755 })
      writeFileSync(join(contents, 'payload'), 'literal copy fixture\n')
      writeFileSync(join(bin, 'cp'), '#!/bin/sh\nprintf called > "$NATIVE_COPY_MARKER"\nprintf "GNU-style cp rejects -c\\n" >&2\nexit 64\n')
      // Only signing and verification are stubbed. Copying and plist mutation use the real macOS tools.
      writeFileSync(join(bin, 'codesign'), '#!/bin/sh\nprintf "called\\n" >> "$NATIVE_SIGN_MARKER"\nexit 0\n')
      chmodSync(join(bin, 'cp'), 0o755)
      chmodSync(join(bin, 'codesign'), 0o755)
      const script = join(root, 'prepare.ts')
      const browser = pathToFileURL(join(import.meta.dir, '../src/browser.ts')).href
      writeFileSync(script, `import { prepareMacChrome } from ${JSON.stringify(browser)}
const options = ${JSON.stringify({ source, directory })}
const first = prepareMacChrome(options)
const second = prepareMacChrome(options)
console.log(JSON.stringify({ first, second }))
`)
      const result = await runIsolated(script, {
        cwd: root,
        inheritEnv: false,
        envFile: false,
        preload: [],
        env: { PATH: `${bin}:/usr/bin:/bin`, NATIVE_COPY_MARKER: copyMarker, NATIVE_SIGN_MARKER: signMarker },
        timeoutMs: 10_000,
      })
      expect(result.timedOut).toBe(false)
      expect(result.code, `${result.stderr}\nPATH cp invoked: ${existsSync(copyMarker)}`).toBe(0)
      expect(result.stderr).toBe('')
      const prepared = join(directory, 'Chrome.app')
      const executable = join(prepared, 'Contents/MacOS/FixtureBrowser')
      expect(JSON.parse(result.stdout)).toEqual({
        first: { executable, app: prepared, reused: false },
        second: { executable, app: prepared, reused: true },
      })
      expect(existsSync(copyMarker)).toBe(false)
      expect(readFileSync(signMarker, 'utf8')).toBe('called\ncalled\ncalled\n')
      expect(readFileSync(sourceInfo, 'utf8')).toBe(originalInfo)
      expect(readFileSync(executable)).toEqual(readFileSync(source))
      expect(readFileSync(join(prepared, 'Contents/payload'), 'utf8')).toBe('literal copy fixture\n')
      const preparedInfo = readFileSync(join(prepared, 'Contents/Info.plist'), 'utf8')
      expect(preparedInfo).toContain('<string>dev.stacks.testing.chrome</string>')
      expect(preparedInfo).toContain('<string>1.2.3-fixture</string>')
      for (const key of ['KSProductID', 'KSUpdateURL', 'KSChannelID', 'KSVersion']) expect(preparedInfo).not.toContain(`<key>${key}</key>`)
      expect(readdirSync(directory)).toEqual(['Chrome.app'])
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 15_000)
})
