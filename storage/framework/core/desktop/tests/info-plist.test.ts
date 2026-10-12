import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { plistValue, RESERVED_PLIST_KEYS, renderInfoPlist, renderUserlandPlistEntries, xmlEscape } from '../src/index'

/**
 * Extra `Info.plist` entries an application declares for its bundle.
 *
 * The keys that matter most are the `NS*UsageDescription` strings: they are the
 * sentences a person reads when macOS asks whether an app may look in their
 * Downloads folder or drive Finder. A bundle without them gets a generic prompt
 * or a flat refusal, and `build:dmg` used to write a fixed plist with no way for
 * an app to add its own.
 *
 * They are declared as JSON rather than XML because a malformed plist produces a
 * bundle macOS silently refuses to launch — a failure that surfaces long after
 * the build reported success.
 */

describe('plistValue', () => {
  test('renders the scalar types macOS reads', () => {
    expect(plistValue('Scan your Downloads')).toBe('<string>Scan your Downloads</string>')
    expect(plistValue(true)).toBe('<true/>')
    expect(plistValue(false)).toBe('<false/>')
    expect(plistValue(11)).toBe('<integer>11</integer>')
    expect(plistValue(1.5)).toBe('<real>1.5</real>')
  })

  test('escapes text that would otherwise break the document', () => {
    expect(plistValue('Tom & "Jerry" <here>')).toBe(
      '<string>Tom &amp; &quot;Jerry&quot; &lt;here&gt;</string>',
    )
  })

  test('renders nested dictionaries, as App Transport Security needs', () => {
    const xml = plistValue({
      NSExceptionDomains: { '127.0.0.1': { NSExceptionAllowsInsecureHTTPLoads: true } },
    })
    expect(xml).toContain('<key>NSExceptionDomains</key>')
    expect(xml).toContain('<key>127.0.0.1</key>')
    expect(xml).toContain('<key>NSExceptionAllowsInsecureHTTPLoads</key><true/>')
  })

  test('renders arrays', () => {
    expect(plistValue(['a', 'b'])).toContain('<array>')
    expect(plistValue(['a', 'b'])).toContain('<string>a</string>')
  })

  test('collapses empty containers rather than emitting a broken pair', () => {
    expect(plistValue([])).toBe('<array/>')
    expect(plistValue({})).toBe('<dict/>')
  })

  test('refuses a value plist has no representation for', () => {
    expect(() => plistValue(null)).toThrow(/Unsupported/)
    expect(() => plistValue(undefined)).toThrow(/Unsupported/)
    expect(() => plistValue(Number.NaN)).toThrow(/Unsupported/)
  })
})

describe('renderUserlandPlistEntries', () => {
  test('renders what an app declares', () => {
    const { xml, ignored } = renderUserlandPlistEntries({
      NSDownloadsFolderUsageDescription: 'Scan your Downloads for large files.',
      LSApplicationCategoryType: 'public.app-category.utilities',
    })

    expect(ignored).toEqual([])
    expect(xml).toContain('<key>NSDownloadsFolderUsageDescription</key>')
    expect(xml).toContain('<string>Scan your Downloads for large files.</string>')
    expect(xml).toContain('<key>LSApplicationCategoryType</key>')
  })

  test('drops the keys the bundle must own, and says which', () => {
    const { xml, ignored } = renderUserlandPlistEntries({
      CFBundleIdentifier: 'com.attacker.impostor',
      CFBundleExecutable: 'something-else',
      NSAppleEventsUsageDescription: 'Ask Finder to move items to the Trash.',
    })

    // Rewriting these produces a bundle that does not match what was signed,
    // which fails at launch rather than at build.
    expect(ignored.sort()).toEqual(['CFBundleExecutable', 'CFBundleIdentifier'])
    expect(xml).not.toContain('impostor')
    expect(xml).not.toContain('CFBundleExecutable')
    expect(xml).toContain('NSAppleEventsUsageDescription')
  })

  test('renders nothing at all when only reserved keys were declared', () => {
    const { xml, ignored } = renderUserlandPlistEntries({ CFBundleName: 'Nope' })
    expect(xml).toBe('')
    expect(ignored).toEqual(['CFBundleName'])
  })

  test('renders nothing for an empty declaration', () => {
    expect(renderUserlandPlistEntries({})).toEqual({ xml: '', ignored: [] })
  })

  test('guards every key the bundle identity depends on', () => {
    for (const key of ['CFBundleIdentifier', 'CFBundleExecutable', 'CFBundleVersion', 'CFBundleShortVersionString'])
      expect(RESERVED_PLIST_KEYS.has(key)).toBe(true)
  })
})

describe('xmlEscape', () => {
  test('escapes every character that terminates a plist string', () => {
    expect(xmlEscape(`& < > " '`)).toBe('&amp; &lt; &gt; &quot; &apos;')
  })
})

/**
 * The whole `Info.plist` the packaged `.app` carries.
 *
 * The keys below are the ones every build writes, as opposed to the ones an app
 * declares, and they were interpolated into the document raw: an app named
 * `Repro & Co` wrote `<string>Repro & Co</string>` and produced a plist macOS
 * cannot parse. `build:dmg` reported success, signed the bundle and would have
 * notarized it, so the only symptom was an app that would not open. Reproduced
 * by building a real DMG, mounting it and running `plutil -lint` on what was
 * inside, which is why the parse test below shells out to `plutil` rather than
 * asserting a shape: the question is what macOS accepts, not what looks right.
 */

/** What macOS itself makes of the document, rather than what we think of it. */
function plutilAccepts(xml: string): { ok: boolean, output: string } {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-plist-lint-'))
  try {
    const file = join(directory, 'Info.plist')
    writeFileSync(file, xml)
    const linted = Bun.spawnSync(['plutil', '-lint', file], { stdout: 'pipe', stderr: 'pipe' })
    return { ok: linted.exitCode === 0, output: `${linted.stdout.toString()}${linted.stderr.toString()}`.trim() }
  }
  finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

/** `<key>NAME</key>` occurrences — a plist with a key twice is malformed. */
function keyCount(xml: string, key: string): number {
  return xml.split(`<key>${key}</key>`).length - 1
}

const BASE = {
  appName: 'Repro App',
  bundleId: 'sh.stacks.repro-app',
  version: '1.2.3',
  executable: 'Repro App',
  ownsLauncher: false,
} as const
/** App names whose characters XML would otherwise swallow. */
const AWKWARD_NAMES = [
  ['an ampersand', 'Repro & Co'],
  ['angle brackets', 'Repro <Beta>'],
  ['a quote', 'Repro "Nightly"'],
  ['an apostrophe', 'Glenn\'s Repro'],
] as const

/** Keys an app may set for itself, which the framework also sets. */
const OVERRIDES = [
  ['LSMinimumSystemVersion', { LSMinimumSystemVersion: '13.0' }],
  ['NSHighResolutionCapable', { NSHighResolutionCapable: false }],
  ['NSAppTransportSecurity', { NSAppTransportSecurity: { NSAllowsLocalNetworking: true } }],
] as const

describe('renderInfoPlist', () => {
  test.each(AWKWARD_NAMES)('escapes %s in the app name', (_label, appName) => {
    const { xml } = renderInfoPlist({ ...BASE, appName, executable: appName })

    // Escaped, so the raw character cannot appear between the tags.
    expect(xml).not.toContain(`<string>${appName}</string>`)
  })

  test('escapes the bundle id and version, which come straight from the environment', () => {
    // DESKTOP_BUNDLE_ID and DESKTOP_APP_VERSION are unvalidated env values.
    const { xml } = renderInfoPlist({ ...BASE, bundleId: 'sh.stacks.a&b', version: '1.0<rc1>' })

    expect(xml).toContain('<string>sh.stacks.a&amp;b</string>')
    expect(xml).toContain('<string>1.0&lt;rc1&gt;</string>')
  })

  test('carries the name, id and version it was given', () => {
    const { xml } = renderInfoPlist(BASE)
    expect(xml).toContain('<key>CFBundleName</key><string>Repro App</string>')
    expect(xml).toContain('<key>CFBundleIdentifier</key><string>sh.stacks.repro-app</string>')
    expect(xml).toContain('<key>CFBundleVersion</key><string>1.2.3</string>')
    expect(xml).toContain('<key>CFBundleShortVersionString</key><string>1.2.3</string>')
  })

  test('an app serving its own window gets a loopback exception, not the open internet', () => {
    const { xml } = renderInfoPlist({ ...BASE, ownsLauncher: true })
    expect(xml).toContain('<key>NSAllowsLocalNetworking</key>')
    expect(xml).toContain('<key>127.0.0.1</key>')
    // The KEY, not the word: the comment beside the exception mentions
    // NSAllowsArbitraryLoads to say why it is not being used.
    expect(keyCount(xml, 'NSAllowsArbitraryLoads')).toBe(0)
  })

  test('an app loading a remote URL is allowed to reach it', () => {
    const { xml } = renderInfoPlist({ ...BASE, ownsLauncher: false })
    expect(xml).toContain('<key>NSAllowsArbitraryLoads</key>')
    expect(xml).not.toContain('<key>127.0.0.1</key>')
  })

  test.each(OVERRIDES)('an app overriding %s gets its value once, not twice', (key, declared) => {
    expect(keyCount(renderInfoPlist({ ...BASE, declared }).xml, key)).toBe(1)
  })

  test("the app's override is the value that survives", () => {
    const { xml } = renderInfoPlist({ ...BASE, declared: { LSMinimumSystemVersion: '13.0' } })
    expect(xml).toContain('<string>13.0</string>')
    expect(xml).not.toContain('<string>11.0</string>')
  })

  test('declared extras are carried, and reserved keys reported rather than emitted twice', () => {
    const { xml, ignored } = renderInfoPlist({
      ...BASE,
      declared: { NSCameraUsageDescription: 'Scan a receipt', CFBundleName: 'Hijacked' },
    })
    expect(xml).toContain('<key>NSCameraUsageDescription</key><string>Scan a receipt</string>')
    expect(ignored).toContain('CFBundleName')
    expect(keyCount(xml, 'CFBundleName')).toBe(1)
    expect(xml).not.toContain('Hijacked')
  })

  test('names an icon only when one was built', () => {
    expect(renderInfoPlist({ ...BASE, iconFile: 'AppIcon' }).xml)
      .toContain('<key>CFBundleIconFile</key><string>AppIcon</string>')
    expect(renderInfoPlist(BASE).xml).not.toContain('CFBundleIconFile')
  })
})

/**
 * What macOS itself makes of every document the suite builds.
 *
 * This is the question that found the bug: a `<dict>` closed twice reads as
 * fine and is a document macOS will not open. It needs `plutil`, which ships
 * with macOS and exists nowhere else, so the Linux runner reports these as
 * skipped rather than failing - it has no opinion to offer about what macOS
 * parses. Every assertion above is a shape assertion and runs everywhere.
 *
 * Gated on the tool rather than on `process.platform`, because a macOS
 * runner with a trimmed PATH should skip rather than fail for the same
 * reason. The inputs come from the tables the assertions above use, so a
 * document cannot be asserted about in one place and left unlinted here.
 */
describe.if(Bun.which('plutil') !== null)('what macOS accepts', () => {
  const documents: Array<[string, string]> = [
    ['the plain bundle', renderInfoPlist(BASE).xml],
    ['an app serving its own window', renderInfoPlist({ ...BASE, ownsLauncher: true }).xml],
    ['an escaped bundle id and version', renderInfoPlist({ ...BASE, bundleId: 'sh.stacks.a&b', version: '1.0<rc1>' }).xml],
    ...AWKWARD_NAMES.map(([label, appName]): [string, string] => [
      `${label} in the app name`,
      renderInfoPlist({ ...BASE, appName, executable: appName }).xml,
    ]),
    ...OVERRIDES.map(([key, declared]): [string, string] => [
      `an overridden ${key}`,
      renderInfoPlist({ ...BASE, declared }).xml,
    ]),
  ]

  test.each(documents)('parses %s', (_label, xml) => {
    const { ok, output } = plutilAccepts(xml)
    expect(ok, output).toBe(true)
  })
})
