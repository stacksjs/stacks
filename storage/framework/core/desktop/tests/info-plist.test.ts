import { describe, expect, test } from 'bun:test'
import { plistValue, RESERVED_PLIST_KEYS, renderUserlandPlistEntries, xmlEscape } from '../src/index'

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
