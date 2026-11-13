import { describe, expect, test } from 'bun:test'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { runIsolated } from '../src/isolated'

describe.skipIf(process.platform !== 'darwin')('macOS browser preparation', () => {
  test('leaves superseded framework versions out, signs what is left, and retains an invalid cached bundle while preparing its replacement', async () => {
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
      // An installed app carries extended attributes the clone keeps, and
      // codesign refuses to seal a bundle that has Finder info on it
      // ("resource fork, Finder information, or similar detritus not
      // allowed"). Google Chrome 155 does, so preparation failed outright.
      run(['/usr/bin/xattr', '-wx', 'com.apple.FinderInfo', `01${'0'.repeat(62)}`, join(root, 'Source.app')])
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
      // The copy carries the version in use and not the one the updater kept
      // beside it: a private copy is started fresh and only loads `Current`.
      // The installed app keeps both.
      expect(readdirSync(join(first.app, 'Contents/Frameworks/Fixture.framework/Versions')).sort()).toEqual(['B', 'Current'])
      expect(readdirSync(versions).sort()).toEqual(['A', 'B', 'Current'])
      // Verified when it was made, and remembered beside it, not inside it.
      expect(existsSync(`${first.app}.verified`)).toBe(true)
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
      // Preparation clears attributes on its clone, never on the installed app.
      const attributes = Bun.spawnSync(['/usr/bin/xattr', join(root, 'Source.app')], { stdout: 'pipe' }).stdout.toString()
      expect(attributes).toContain('com.apple.FinderInfo')
      run(['/usr/bin/xattr', '-c', join(root, 'Source.app')])
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
      // Sealed and verified when it was made. Reused as it was verified: not read again.
      expect(readFileSync(signMarker, 'utf8')).toBe('called\ncalled\n')
      expect(readFileSync(sourceInfo, 'utf8')).toBe(originalInfo)
      expect(readFileSync(executable)).toEqual(readFileSync(source))
      expect(readFileSync(join(prepared, 'Contents/payload'), 'utf8')).toBe('literal copy fixture\n')
      const preparedInfo = readFileSync(join(prepared, 'Contents/Info.plist'), 'utf8')
      expect(preparedInfo).toContain('<string>dev.stacks.testing.chrome</string>')
      expect(preparedInfo).toContain('<string>1.2.3-fixture</string>')
      for (const key of ['KSProductID', 'KSUpdateURL', 'KSChannelID', 'KSVersion']) expect(preparedInfo).not.toContain(`<key>${key}</key>`)
      // The copy, and beside it the record that it was verified. Nothing left from staging.
      expect(readdirSync(directory).sort()).toEqual(['Chrome.app', 'Chrome.app.verified'])
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 15_000)

  // Strict verification reads the whole bundle: about 15 seconds for one Chrome
  // version, and 20 to 28 with the two more an updater had left beside it. It
  // ran before every reuse, in every process that started a browser, so a
  // test that waits 30 seconds for its page never got one.
  test('reuses a verified copy without reading it again, and verifies again whatever has changed', async () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-browser-reuse-'))
    try {
      const bin = join(root, 'bin')
      const contents = join(root, 'Source.app', 'Contents')
      const source = join(contents, 'MacOS', 'FixtureBrowser')
      const framework = join(contents, 'Frameworks/Fixture.framework'), versions = join(framework, 'Versions')
      const directory = join(root, 'prepared')
      const signMarker = join(root, 'signing-stub-called')
      const info = (id: string, executable: string, version = '1.2.3-fixture') => `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>${id}</string><key>CFBundleExecutable</key><string>${executable}</string><key>CFBundleShortVersionString</key><string>${version}</string></dict></plist>`
      mkdirSync(bin)
      mkdirSync(join(contents, 'MacOS'), { recursive: true })
      writeFileSync(join(contents, 'Info.plist'), info('example.fixture.browser', 'FixtureBrowser'))
      writeFileSync(source, '#!/bin/sh\nexit 0\n', { mode: 0o755 })
      // The version in use, and the one an updater kept for a browser still running it.
      for (const version of ['A', 'B']) {
        mkdirSync(join(versions, version, 'Resources'), { recursive: true })
        writeFileSync(join(versions, version, 'Resources/Info.plist'), info('example.fixture.framework', 'Fixture'))
        writeFileSync(join(versions, version, 'Fixture'), `code of version ${version}\n`)
      }
      symlinkSync('B', join(versions, 'Current'))
      symlinkSync('Versions/Current/Resources', join(framework, 'Resources'))
      // Signing and verification are counted, and pass. Everything else is the real tool.
      writeFileSync(join(bin, 'codesign'), '#!/bin/sh\nprintf "%s\\n" "$1" >> "$NATIVE_SIGN_MARKER"\nexit 0\n')
      chmodSync(join(bin, 'codesign'), 0o755)

      const script = join(root, 'prepare.ts')
      const browser = pathToFileURL(join(import.meta.dir, '../src/browser.ts')).href
      writeFileSync(script, `import { prepareMacChrome } from ${JSON.stringify(browser)}\nconsole.log(JSON.stringify(prepareMacChrome(${JSON.stringify({ source, directory })})))\n`)
      const calls = (): string[] => existsSync(signMarker) ? readFileSync(signMarker, 'utf8').trim().split('\n') : []
      const prepare = async () => {
        const result = await runIsolated(script, { cwd: root, inheritEnv: false, envFile: false, preload: [], env: { PATH: `${bin}:/usr/bin:/bin`, NATIVE_SIGN_MARKER: signMarker }, timeoutMs: 10_000 })
        expect(result.timedOut).toBe(false)
        expect(result.code, result.stderr).toBe(0)
        return JSON.parse(result.stdout) as { app: string, executable: string, reused: boolean }
      }

      // Made: only the version in use is copied, so only it is signed. With
      // both, this would be six calls: two to sign, two to seal, then the app.
      const made = await prepare()
      expect(made.reused).toBe(false)
      expect(readdirSync(join(made.app, 'Contents/Frameworks/Fixture.framework/Versions')).sort()).toEqual(['B', 'Current'])
      expect(readdirSync(versions).sort()).toEqual(['A', 'B', 'Current'])
      expect(calls()).toEqual(['--force', '--force', '--force', '--verify'])
      const stamp = `${made.app}.verified`
      const verified = readFileSync(stamp, 'utf8')
      expect(verified).toMatch(/^stacks-chrome-verified-1\n[0-9a-f]{64}\n$/)

      // Reused, twice: nothing is signed and nothing is verified.
      expect(await prepare()).toEqual({ ...made, reused: true })
      expect(await prepare()).toEqual({ ...made, reused: true })
      expect(calls()).toHaveLength(4)

      // No record that it was verified: it is, once, and that is recorded.
      rmSync(stamp)
      expect(await prepare()).toEqual({ ...made, reused: true })
      expect(calls().slice(4)).toEqual(['--verify'])
      expect(readFileSync(stamp, 'utf8')).toBe(verified)
      expect(await prepare()).toEqual({ ...made, reused: true })
      expect(calls()).toHaveLength(5)

      // A file as old as it was but not the size it was: verified again.
      const payload = join(made.app, 'Contents/Frameworks/Fixture.framework/Versions/B/Fixture')
      const before = statSync(payload)
      writeFileSync(payload, 'code of version B, rewritten\n')
      utimesSync(payload, before.atime, before.mtime)
      expect(await prepare()).toEqual({ ...made, reused: true })
      expect(calls().slice(5)).toEqual(['--verify'])
      expect(readFileSync(stamp, 'utf8')).not.toBe(verified)

      // The size it was but newer: verified again.
      writeFileSync(payload, 'code of version B, rewritteN\n')
      expect(await prepare()).toEqual({ ...made, reused: true })
      expect(calls().slice(6)).toEqual(['--verify'])

      // A file removed, as the temp cleaner does to what has not been read lately.
      rmSync(join(made.app, 'Contents/Frameworks/Fixture.framework/Versions/B/Resources/Info.plist'))
      writeFileSync(join(made.app, 'Contents/Frameworks/Fixture.framework/Versions/B/Resources/Info.plist'), info('example.fixture.framework', 'Fixture'))
      rmSync(join(made.app, 'Contents/MacOS/FixtureBrowser'))
      writeFileSync(join(made.app, 'Contents/MacOS/FixtureBrowser'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
      expect(await prepare()).toEqual({ ...made, reused: true })
      expect(calls().slice(7)).toEqual(['--verify'])
      expect(calls()).toHaveLength(8)

      // A copy that still carries a superseded version was made the old way.
      // It is passed over without being verified, kept, and replaced.
      mkdirSync(join(made.app, 'Contents/Frameworks/Fixture.framework/Versions/A'))
      const replaced = await prepare()
      expect(replaced.reused).toBe(false)
      expect(replaced.app).not.toBe(made.app)
      expect(existsSync(made.app)).toBe(true)
      expect(readdirSync(join(replaced.app, 'Contents/Frameworks/Fixture.framework/Versions')).sort()).toEqual(['B', 'Current'])
      expect(calls().slice(8)).toEqual(['--force', '--force', '--force', '--verify'])
      expect(await prepare()).toEqual({ ...replaced, reused: true })
      expect(calls()).toHaveLength(12)
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 60_000)
})
