import { describe, expect, test } from 'bun:test'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { runIsolated } from '../src/isolated'

describe.skipIf(process.platform !== 'darwin')('macOS browser preparation', () => {
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
      // Only signing is stubbed. Copying and plist mutation use the real macOS tools.
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
      expect(readFileSync(signMarker, 'utf8')).toBe('called\n')
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
