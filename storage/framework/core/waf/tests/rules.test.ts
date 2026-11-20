import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { findWafLibrary, libraryFileName, renderWafRules } from '../src'

const read = (path: string) => `# rules from ${path}\nSecRule ARGS "@rx x" "id:1,phase:1,pass"`

describe('renderWafRules', () => {
  test('refuses to run with no rule files, since zig-waf ships none', () => {
    expect(() => renderWafRules({})).toThrow(/names no rule files/)
  })

  test('sets the CRS paranoia level and thresholds before the rules', () => {
    const { text } = renderWafRules({ rules: ['/crs/rules/a.conf'], paranoiaLevel: 2, inboundThreshold: 10 }, read)
    expect(text).toContain('setvar:tx.blocking_paranoia_level=2')
    expect(text).toContain('setvar:tx.inbound_anomaly_score_threshold=10')
    expect(text.indexOf('blocking_paranoia_level')).toBeLessThan(text.indexOf('# rules from /crs/rules/a.conf'))
  })

  test('data files resolve next to the rule files, not crs-setup.conf one level up', () => {
    expect(renderWafRules({ rules: ['/crs/crs-setup.conf', '/crs/rules/b.conf'] }, read).dataDir).toBe('/crs/rules')
  })

  test('an explicit dataDir wins', () => {
    expect(renderWafRules({ rules: ['/crs/crs-setup.conf', '/crs/rules/b.conf'], dataDir: '/data' }, read).dataDir).toBe('/data')
  })

  test('allows the methods a Stacks API uses, ahead of the rules', () => {
    const { text } = renderWafRules({ rules: ['/crs/rules/a.conf'] }, read)
    expect(text).toContain("setvar:'tx.allowed_methods=GET HEAD POST OPTIONS PUT PATCH DELETE'")
    expect(text.indexOf('tx.allowed_methods')).toBeLessThan(text.indexOf('# rules from'))
  })

  test('allowed methods can be narrowed, and a malformed one is dropped', () => {
    const { text, warnings } = renderWafRules({ rules: ['/a.conf'], allowedMethods: ['GET', 'POST', "PUT'"] }, read)
    expect(text).toContain("setvar:'tx.allowed_methods=GET POST'")
    expect(warnings).toEqual(['Allowed method "PUT\'" was dropped: a method is upper-case letters only.'])
  })

  test('an unscoped exclusion follows the rules it removes; a path-scoped one precedes them', () => {
    const { text } = renderWafRules({
      rules: ['/crs/rules/a.conf'],
      exclusions: [{ ruleId: 942100, reason: 'search box' }, { ruleId: 941100, pathPattern: '^/editor', reason: 'rich text' }],
    }, read)
    const rules = text.indexOf('# rules from')
    expect(text.indexOf('SecRuleRemoveById 942100')).toBeGreaterThan(rules)
    expect(text.indexOf('ctl:ruleRemoveById=941100')).toBeLessThan(rules)
  })

  test('drops an exclusion without a usable rule id, and says so', () => {
    const { text, warnings } = renderWafRules({ rules: ['/a.conf'], exclusions: [{ ruleId: 0, reason: 'x' }] }, read)
    expect(text).not.toContain('SecRuleRemoveById 0')
    expect(warnings).toEqual(['Exclusion for rule "0" was dropped: the id is not a positive integer.'])
  })

  test('a quote or newline in a configured path cannot end its argument early', () => {
    const { text } = renderWafRules({ rules: ['/a.conf'], bypassPaths: ['/x" "id:5,phase:1,deny\nSecRule'] }, read)
    expect(text).toContain('@beginsWith /x\\" \\"id:5,phase:1,deny SecRule"')
  })
})

describe('findWafLibrary', () => {
  test('says where to get the library when none is named', () => {
    expect(() => findWafLibrary(undefined, {})).toThrow(/security\.waf\.library or ZIG_WAF_LIBRARY/)
  })

  test('names the setting a missing path came from', () => {
    expect(() => findWafLibrary(undefined, { ZIG_WAF_LIBRARY: '/nowhere/libzig-waf.so' })).toThrow(/from ZIG_WAF_LIBRARY/)
    expect(() => findWafLibrary('/nowhere/libzig-waf.so', {})).toThrow(/from security\.waf\.library/)
  })

  test('the configured path wins over the environment', () => {
    expect(findWafLibrary(import.meta.path, { ZIG_WAF_LIBRARY: '/elsewhere' })).toBe(import.meta.path)
    expect(existsSync(import.meta.path)).toBeTrue()
  })

  test('names the file each platform builds', () => {
    expect([libraryFileName('darwin'), libraryFileName('linux'), libraryFileName('win32')]).toEqual(['libzig-waf.dylib', 'libzig-waf.so', 'zig-waf.dll'])
  })
})
