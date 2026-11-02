import type { DnrRule, WebKitRule } from '../src/webkit'
import { describe, expect, it } from 'bun:test'
import {
  buildWebKitLists,
  convertDnrRule,
  cosmeticSelectorProblem,
  isWebKitRegex,
  regexFilterToWebKit,
  urlFilterToWebKitRegex,
  WEBKIT_MAX_RULES_PER_LIST,
  WebKitUnsupportedError,
} from '../src/webkit'

function matches(filter: string, url: string): boolean {
  return new RegExp(urlFilterToWebKitRegex(filter), 'i').test(url)
}

function only(rule: DnrRule): WebKitRule {
  const { rules } = convertDnrRule(rule)
  expect(rules).toHaveLength(1)
  return rules[0]!.rule
}

function unsupported(rule: DnrRule): string {
  try {
    convertDnrRule(rule)
  }
  catch (error) {
    expect(error).toBeInstanceOf(WebKitUnsupportedError)
    return (error as Error).message
  }
  throw new Error('expected the rule to be unsupported')
}

describe('urlFilter to WebKit regex', () => {
  it('anchors || at the host and its subdomains, and nowhere else', () => {
    expect(matches('||doubleclick.net^', 'https://doubleclick.net/x')).toBe(true)
    expect(matches('||doubleclick.net^', 'https://ad.g.doubleclick.net:443/x')).toBe(true)
    expect(matches('||doubleclick.net^', 'http://doubleclick.net/')).toBe(true)
    expect(matches('||doubleclick.net^', 'https://notdoubleclick.net/x')).toBe(false)
    expect(matches('||doubleclick.net^', 'https://doubleclick.network/x')).toBe(false)
    expect(matches('||doubleclick.net^', 'https://example.com/?u=https://doubleclick.net/')).toBe(false)
    expect(urlFilterToWebKitRegex('||doubleclick.net^')).toBe('^[a-z][a-z0-9+.-]*://([^/:]*\\.)?doubleclick\\.net[:/]')
  })

  it('reads ^ as a separator in the middle and as separator-or-end at the end', () => {
    expect(matches('||youtube.com/api/stats/ads^', 'https://www.youtube.com/api/stats/ads?ver=2')).toBe(true)
    expect(matches('||youtube.com/api/stats/ads^', 'https://www.youtube.com/api/stats/ads')).toBe(true)
    expect(matches('||youtube.com/api/stats/ads^', 'https://www.youtube.com/api/stats/adsense')).toBe(false)
    expect(matches('/ad^banner', 'https://x.com/ad/banner')).toBe(true)
    expect(matches('/ad^banner', 'https://x.com/ad-banner')).toBe(false)
    expect(matches('/ad^|', 'https://x.com/ad/')).toBe(true)
    expect(matches('/ad^|', 'https://x.com/ad')).toBe(true)
    expect(matches('/ad^|', 'https://x.com/ad/more')).toBe(false)
  })

  it('treats * as any run and | as the start or end of the URL', () => {
    expect(matches('/ads/*/banner', 'https://x.com/ads/one/two/banner.png')).toBe(true)
    expect(matches('/ads/*/banner', 'https://x.com/ads/banner')).toBe(false)
    expect(matches('|https://gql.twitch.tv/gql?operationName=VideoAd', 'https://gql.twitch.tv/gql?operationName=VideoAdUi')).toBe(true)
    expect(matches('|https://gql.twitch.tv/gql?operationName=VideoAd', 'http://x/https://gql.twitch.tv/gql?operationName=VideoAd')).toBe(false)
    expect(matches('.gif|', 'https://x.com/a.gif')).toBe(true)
    expect(matches('.gif|', 'https://x.com/a.gif?x=1')).toBe(false)
    expect(urlFilterToWebKitRegex('*ads*')).toBe('ads')
    expect(urlFilterToWebKitRegex('*')).toBe('.*')
  })

  it('escapes every regex metacharacter so filters stay literal', () => {
    expect(matches('/a+b(c)?.js', 'https://x.com/a+b(c)?.js')).toBe(true)
    expect(matches('/a+b(c)?.js', 'https://x.com/aab.js')).toBe(false)
    expect(isWebKitRegex(urlFilterToWebKitRegex('/x{1}|y[2]$'))).toBe(true)
  })

  it('refuses non-ASCII filters', () => {
    expect(() => urlFilterToWebKitRegex('||bücher.de^')).toThrow(WebKitUnsupportedError)
  })
})

describe('regexFilter to WebKit regex', () => {
  it('passes the WebKit subset through and rewrites \\d, \\w and (?:)', () => {
    expect(regexFilterToWebKit('^https://ads\\.example\\.com/[0-9]+\\.js$')).toEqual(['^https://ads\\.example\\.com/[0-9]+\\.js$'])
    expect(regexFilterToWebKit('/banner\\d+/(?:x)?\\w')).toEqual(['/banner[0-9]+/(x)?[a-zA-Z0-9_]'])
    expect(regexFilterToWebKit('[\\d_]')).toEqual(['[0-9_]'])
  })

  it('expands alternation into one pattern per alternative', () => {
    expect(regexFilterToWebKit('^https?://(www\\.)?(foo|bar)\\.com/')).toEqual([
      '^https?://(www\\.)?(foo)\\.com/',
      '^https?://(www\\.)?(bar)\\.com/',
    ])
    expect(regexFilterToWebKit('ads|track')).toEqual(['ads', 'track'])
    expect(regexFilterToWebKit('/(a|b)?x')).toEqual(['/x', '/(a)x', '/(b)x'])
  })

  it('expands counted repetition', () => {
    expect(regexFilterToWebKit('a{3}')).toEqual(['aaa'])
    expect(regexFilterToWebKit('[0-9]{2,4}x')).toEqual(['[0-9][0-9][0-9]?[0-9]?x'])
    expect(regexFilterToWebKit('b{2,}')).toEqual(['bbb*'])
    expect(regexFilterToWebKit('(a|b){2}')).toEqual(['(a)(a)', '(a)(b)', '(b)(a)', '(b)(b)'])
  })

  it('reports what WebKit cannot do', () => {
    for (const regex of ['(?=ads)', '(?!x)y', '\\bads', '(a)\\1', '\\s', '(a|b)+', 'x{40}', '(a|b|c|d){4}', '[[:alpha:]]', 'tracking[', 'ü'])
      expect(() => regexFilterToWebKit(regex)).toThrow(WebKitUnsupportedError)
  })

  it('every produced pattern is in the WebKit subset', () => {
    for (const regex of ['^https?://[^/]+/ads/', 'a{2}|b\\d', '(?:x|y)z', '\\/path\\/', 'end}'])
      expect(regexFilterToWebKit(regex).every(isWebKitRegex)).toBe(true)
  })
})

describe('DNR rule conversion', () => {
  it('converts a domain block, keeping DNR\'s default of everything but the top-level page', () => {
    const { rules } = convertDnrRule({ id: 1, action: { type: 'block' }, condition: { urlFilter: '||ads.com^' } })
    expect(rules.every(r => r.rule.action.type === 'block' && r.rule.trigger['url-filter'] === urlFilterToWebKitRegex('||ads.com^'))).toBe(true)
    // Subresources in one rule, subframe documents in a second, never the top-level page.
    expect(rules).toHaveLength(2)
    expect(rules[0]!.rule.trigger['resource-type']).toEqual(['style-sheet', 'script', 'image', 'font', 'other', 'fetch', 'ping', 'media', 'websocket'])
    expect(rules[0]!.rule.trigger['load-context']).toBeUndefined()
    expect(rules[1]!.rule.trigger).toMatchObject({ 'resource-type': ['document', 'svg-document'], 'load-context': ['child-frame'] })
  })

  it('maps resource types, and spells out top-level documents with a load-context and popups', () => {
    const { rules } = convertDnrRule({ id: 2, action: { type: 'block' }, condition: { urlFilter: '||pop.com^', resourceTypes: ['main_frame', 'script', 'xmlhttprequest'] } })
    expect(rules.map(r => r.rule.trigger['resource-type'])).toEqual([['script', 'fetch'], ['document', 'svg-document'], ['popup']])
    expect(rules[1]!.rule.trigger['load-context']).toEqual(['top-frame'])
    expect(rules[2]!.rule.trigger['load-context']).toBeUndefined()
  })

  it('drops resource-type entirely when a rule covers everything', () => {
    const rule = only({ id: 3, action: { type: 'block' }, condition: { urlFilter: '||x.com^', resourceTypes: ['main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object', 'xmlhttprequest', 'ping', 'csp_report', 'media', 'websocket', 'other'] } })
    expect(rule.trigger['resource-type']).toBeUndefined()
  })

  it('honours excludedResourceTypes', () => {
    const rule = only({ id: 4, action: { type: 'block' }, condition: { urlFilter: '/ads/', resourceTypes: ['script', 'image', 'font'], excludedResourceTypes: ['font'] } })
    expect(rule.trigger['resource-type']).toEqual(['script', 'image'])
  })

  it('reports explicit resource types WebKit has no equivalent for', () => {
    const result = convertDnrRule({ id: 5, action: { type: 'block' }, condition: { urlFilter: '/x', resourceTypes: ['script', 'webtransport'] } })
    expect(result.approximated[0]).toContain('webtransport')
    expect(unsupported({ id: 6, action: { type: 'block' }, condition: { urlFilter: '/x', resourceTypes: ['webbundle'] } })).toContain('webbundle')
  })

  it('turns initiatorDomains and excludedInitiatorDomains into if-domain and unless-domain', () => {
    expect(only({ id: 7, action: { type: 'block' }, condition: { urlFilter: '/ad.js', resourceTypes: ['script'], initiatorDomains: ['News.example', 'blog.example'] } }).trigger['if-domain']).toEqual(['*news.example', '*blog.example'])
    expect(only({ id: 8, action: { type: 'block' }, condition: { urlFilter: '/ad.js', resourceTypes: ['script'], excludedInitiatorDomains: ['safe.example'] } }).trigger['unless-domain']).toEqual(['*safe.example'])
    // The deprecated spellings mean the same.
    expect(only({ id: 9, action: { type: 'block' }, condition: { urlFilter: '/ad.js', resourceTypes: ['script'], domains: ['old.example'] } }).trigger['if-domain']).toEqual(['*old.example'])
    // An exclusion outside every included domain changes nothing and is dropped.
    expect(only({ id: 10, action: { type: 'block' }, condition: { urlFilter: '/a', resourceTypes: ['script'], initiatorDomains: ['a.example'], excludedInitiatorDomains: ['b.example'] } }).trigger).toMatchObject({ 'if-domain': ['*a.example'] })
    expect(unsupported({ id: 11, action: { type: 'block' }, condition: { urlFilter: '/a', initiatorDomains: ['a.example'], excludedInitiatorDomains: ['shop.a.example'] } })).toContain('excluded under an included domain')
    expect(unsupported({ id: 12, action: { type: 'block' }, condition: { urlFilter: '/a', initiatorDomains: ['shop.a.example'], excludedInitiatorDomains: ['a.example'] } })).toContain('every included domain')
  })

  it('punycodes internationalised domains', () => {
    expect(only({ id: 13, action: { type: 'block' }, condition: { urlFilter: '/a', resourceTypes: ['script'], initiatorDomains: ['bücher.de'] } }).trigger['if-domain']).toEqual(['*xn--bcher-kva.de'])
  })

  it('turns requestDomains into one host-anchored rule per domain', () => {
    const { rules } = convertDnrRule({ id: 14, action: { type: 'block' }, condition: { requestDomains: ['ads.example', 'track.example'], resourceTypes: ['script'] } })
    expect(rules.map(r => r.rule.trigger['url-filter'])).toEqual([urlFilterToWebKitRegex('||ads.example^'), urlFilterToWebKitRegex('||track.example^')])
    // A ||host filter inside its requestDomains already implies them.
    expect(only({ id: 15, action: { type: 'block' }, condition: { urlFilter: '||cdn.ads.example/x', requestDomains: ['ads.example'], resourceTypes: ['script'] } }).trigger['url-filter']).toBe(urlFilterToWebKitRegex('||cdn.ads.example/x'))
    // An unanchored filter is matched after the host, and that is reported.
    const scoped = convertDnrRule({ id: 16, action: { type: 'block' }, condition: { urlFilter: '/pixel', requestDomains: ['t.example'], resourceTypes: ['image'] } })
    expect(scoped.approximated).toHaveLength(1)
    expect(new RegExp(scoped.rules[0]!.rule.trigger['url-filter']).test('https://a.t.example/x/pixel.gif')).toBe(true)
    expect(new RegExp(scoped.rules[0]!.rule.trigger['url-filter']).test('https://other.example/pixel.gif')).toBe(false)
    expect(unsupported({ id: 17, action: { type: 'block' }, condition: { urlFilter: '||other.example^', requestDomains: ['t.example'] } })).toContain('outside its requestDomains')
    expect(unsupported({ id: 18, action: { type: 'block' }, condition: { regexFilter: 'x', requestDomains: ['t.example'] } })).toContain('regexFilter combined with requestDomains')
  })

  it('converts regexFilter rules, expanding alternation into several rules', () => {
    const { rules } = convertDnrRule({ id: 19, action: { type: 'block' }, condition: { regexFilter: '/(ads|track)\\.js$', resourceTypes: ['script'] } })
    expect(rules.map(r => r.rule.trigger['url-filter'])).toEqual(['/(ads)\\.js$', '/(track)\\.js$'])
    expect(unsupported({ id: 20, action: { type: 'block' }, condition: { regexFilter: '(?<=x)ads' } })).toContain('lookaround')
  })

  it('maps domainType and case sensitivity', () => {
    expect(only({ id: 21, action: { type: 'block' }, condition: { urlFilter: '/a', resourceTypes: ['script'], domainType: 'thirdParty' } }).trigger['load-type']).toEqual(['third-party'])
    expect(only({ id: 22, action: { type: 'block' }, condition: { urlFilter: '/a', resourceTypes: ['script'], domainType: 'firstParty' } }).trigger['load-type']).toEqual(['first-party'])
    expect(only({ id: 23, action: { type: 'block' }, condition: { urlFilter: '/A', resourceTypes: ['script'], isUrlFilterCaseSensitive: true } }).trigger['url-filter-is-case-sensitive']).toBe(true)
  })

  it('turns allow into ignore-previous-rules and upgradeScheme into make-https', () => {
    const allow = convertDnrRule({ id: 24, priority: 3, action: { type: 'allow' }, condition: { urlFilter: '||news.example^', resourceTypes: ['main_frame'] } })
    expect(allow.rules.every(r => r.exception && r.rule.action.type === 'ignore-previous-rules' && r.priority === 3)).toBe(true)
    expect(only({ id: 25, action: { type: 'upgradeScheme' }, condition: { urlFilter: '|http://', resourceTypes: ['script'] } }).action).toEqual({ type: 'make-https' })
  })

  it('turns allowAllRequests into a page-wide exception scoped by the page\'s domain', () => {
    const rule = only({ id: 26, priority: 10, action: { type: 'allowAllRequests' }, condition: { requestDomains: ['shop.example'], resourceTypes: ['main_frame'] } })
    expect(rule).toEqual({ trigger: { 'url-filter': '.*', 'if-domain': ['*shop.example'] }, action: { type: 'ignore-previous-rules' } })
    expect(only({ id: 27, action: { type: 'allowAllRequests' }, condition: { urlFilter: '||news.example^', resourceTypes: ['main_frame'] } }).trigger['if-domain']).toEqual(['*news.example'])
    // Very Good AdBlock's allowlist shape: the page's own domain as initiator.
    const allowlisted = convertDnrRule({ id: 28, action: { type: 'allowAllRequests' }, condition: { initiatorDomains: ['me.example'], resourceTypes: ['main_frame', 'sub_frame'] } })
    expect(allowlisted.rules[0]!.rule.trigger['if-domain']).toEqual(['*me.example'])
    expect(allowlisted.approximated).toHaveLength(1)
    // No condition at all: protection off everywhere.
    expect(only({ id: 29, priority: 100, action: { type: 'allowAllRequests' }, condition: { resourceTypes: ['main_frame', 'sub_frame'] } }).trigger).toEqual({ 'url-filter': '.*' })
    expect(unsupported({ id: 30, action: { type: 'allowAllRequests' }, condition: { urlFilter: '||x.example/path', resourceTypes: ['main_frame'] } })).toContain('bare ||host')
    expect(unsupported({ id: 31, action: { type: 'allowAllRequests' }, condition: { requestDomains: ['x.example'], resourceTypes: ['sub_frame'] } })).toContain('subframes only')
  })

  it('reports every action and condition WebKit has no form for', () => {
    expect(unsupported({ id: 32, action: { type: 'redirect', redirect: { extensionPath: '/stub.js' } }, condition: { urlFilter: '/gpt.js' } })).toContain('redirect')
    expect(unsupported({ id: 33, action: { type: 'modifyHeaders' }, condition: { urlFilter: '/x' } })).toContain('modifyHeaders')
    expect(unsupported({ id: 34, action: { type: 'block' }, condition: { urlFilter: '/x', requestMethods: ['post'] } })).toContain('request method')
    expect(unsupported({ id: 35, action: { type: 'block' }, condition: { urlFilter: '/x', excludedRequestDomains: ['cdn.example'] } })).toContain('excludedRequestDomains')
    expect(unsupported({ id: 36, action: { type: 'block' }, condition: { urlFilter: '/x', tabIds: [1] } })).toContain('tabIds')
  })
})

describe('WebKit lists', () => {
  const block = (id: number, host: string, priority = 1): DnrRule => ({ id, priority, action: { type: 'block' }, condition: { urlFilter: `||${host}^`, resourceTypes: ['script'] } })
  const allow = (id: number, host: string, priority = 1): DnrRule => ({ id, priority, action: { type: 'allow' }, condition: { urlFilter: `||${host}^`, resourceTypes: ['script'] } })

  it('orders each list by priority, with allow after block at the same priority', () => {
    const { lists } = buildWebKitLists([{ id: 'rules', dnr: [allow(1, 'a.example', 2), block(2, 'b.example', 3), block(3, 'c.example', 1), allow(4, 'd.example', 1)] }])
    expect(lists).toHaveLength(1)
    const order = lists[0]!.rules.map(rule => `${rule.action.type}:${rule.trigger['url-filter'].match(/\)\?(.)/)?.[1]}`)
    expect(order).toEqual(['block:c', 'ignore-previous-rules:d', 'ignore-previous-rules:a', 'block:b'])
  })

  it('repeats every enabled group\'s exceptions in every network list', () => {
    const { lists } = buildWebKitLists([
      { id: 'one', dnr: [block(1, 'a.example')] },
      { id: 'two', dnr: [block(2, 'b.example'), allow(3, 'c.example', 2)] },
      { id: 'off', enabled: false, dnr: [block(4, 'd.example'), allow(5, 'e.example', 2)] },
    ])
    const exceptions = (id: string) => lists.find(list => list.id === id)!.rules.filter(rule => rule.action.type === 'ignore-previous-rules').length
    expect(lists.map(list => list.id)).toEqual(['one', 'two', 'off'])
    expect(exceptions('one')).toBe(1)
    expect(exceptions('two')).toBe(1)
    // A disabled group adds its own exceptions to its own lists only.
    expect(exceptions('off')).toBe(2)
    expect(lists.find(list => list.id === 'off')!.enabled).toBe(false)
  })

  it('keeps cosmetic rules in their own lists, untouched by network exceptions', () => {
    const { lists, report } = buildWebKitLists([
      { id: 'net', dnr: [block(1, 'a.example'), allow(2, 'b.example', 2)] },
      { id: 'hide', cosmetic: [{ selector: ['.ad', '#banner'] }, { selector: '.yt-ad', domains: ['youtube.com'] }, { selector: '.x', excludedDomains: ['safe.example'] }] },
    ])
    const hide = lists.find(list => list.id === 'hide')!
    expect(hide.kind).toBe('cosmetic')
    expect(hide.rules).toEqual([
      { trigger: { 'url-filter': '.*' }, action: { type: 'css-display-none', selector: '.ad, #banner' } },
      { trigger: { 'url-filter': '.*', 'if-domain': ['*youtube.com'] }, action: { type: 'css-display-none', selector: '.yt-ad' } },
      { trigger: { 'url-filter': '.*', 'unless-domain': ['*safe.example'] }, action: { type: 'css-display-none', selector: '.x' } },
    ])
    expect(report.input).toBe(5)
  })

  it('chunks selectors and reports selectors WebKit would reject', () => {
    const selectors = Array.from({ length: 250 }, (_, i) => `.ad-${i}`)
    const { lists, report } = buildWebKitLists([{ id: 'hide', cosmetic: [{ selector: [...selectors, 'div:has-text(Sponsored)', '.a { color: red }', 'a[href'] }] }], { selectorsPerRule: 100 })
    expect(lists[0]!.rules).toHaveLength(3)
    expect(report.unsupported.map(issue => issue.reason).sort()).toEqual([
      'cosmetic: a procedural (adblock-only) pseudo-class',
      'cosmetic: a selector containing CSS declarations',
      'cosmetic: a selector with unbalanced brackets or quotes',
    ])
    expect(cosmeticSelectorProblem('div > a[href^="https://ads."]:not(.ok)')).toBeNull()
  })

  it('counts left-out and approximated rules with examples instead of dropping them', () => {
    const { report } = buildWebKitLists([{ id: 'rules', dnr: [
      block(1, 'a.example'),
      { id: 2, action: { type: 'redirect' }, condition: { urlFilter: '/gpt.js' } },
      { id: 3, action: { type: 'redirect' }, condition: { urlFilter: '/ads.js' } },
      { id: 4, action: { type: 'block' }, condition: { urlFilter: '/p', requestDomains: ['t.example'], resourceTypes: ['image'] } },
    ] }])
    expect(report.input).toBe(4)
    expect(report.unsupported).toEqual([{ reason: 'redirect actions (content blockers cannot redirect)', count: 2, examples: [2, 3] }])
    expect(report.approximated).toHaveLength(1)
    expect(report.approximated[0]!.examples).toEqual([4])
  })

  it('gives each list a stable id and a version that follows its content', () => {
    const one = buildWebKitLists([{ id: 'rules', dnr: [block(1, 'a.example')] }]).lists[0]!
    const again = buildWebKitLists([{ id: 'rules', dnr: [block(1, 'a.example')] }]).lists[0]!
    const changed = buildWebKitLists([{ id: 'rules', dnr: [block(1, 'b.example')] }]).lists[0]!
    expect(again).toEqual(one)
    expect(changed.id).toBe(one.id)
    expect(changed.version).not.toBe(one.version)
    expect(one.version).toMatch(/^[0-9a-f]{16}$/)
  })

  it('refuses duplicate or unsafe group ids and limits past WebKit\'s', () => {
    expect(() => buildWebKitLists([{ id: 'a', dnr: [] }, { id: 'a', dnr: [] }])).toThrow('both named')
    expect(() => buildWebKitLists([{ id: '../a', dnr: [] }])).toThrow('may only contain')
    expect(() => buildWebKitLists([], { maxRulesPerList: WEBKIT_MAX_RULES_PER_LIST + 1 })).toThrow('maxRulesPerList')
  })
})

describe('WebKit list size and splitting', () => {
  const hosts = (count: number, offset = 0): DnrRule[] => Array.from({ length: count }, (_, i) => ({
    id: offset + i + 1,
    action: { type: 'block' },
    condition: { urlFilter: `||host-${offset + i}.example^`, resourceTypes: ['script', 'image'] },
  }))

  it('splits a large group under the limit, exceptions counted in every part', () => {
    const exceptions: DnrRule[] = Array.from({ length: 50 }, (_, i) => ({ id: 900_000 + i, priority: 3, action: { type: 'allow' }, condition: { urlFilter: `||ok-${i}.example^`, resourceTypes: ['main_frame'] } }))
    const { lists } = buildWebKitLists([{ id: 'static', dnr: [...hosts(120_000), ...exceptions] }], { maxRulesPerList: 50_000 })
    // allow on main_frame emits a document rule and a popup rule: 100 exception rules.
    expect(lists.map(list => list.id)).toEqual(['static', 'static-2', 'static-3'])
    expect(lists.every(list => list.rules.length <= 50_000)).toBe(true)
    expect(lists.reduce((sum, list) => sum + list.rules.filter(rule => rule.action.type === 'block').length, 0)).toBe(120_000)
    for (const list of lists) {
      const tail = list.rules.slice(-100)
      expect(tail.every(rule => rule.action.type === 'ignore-previous-rules')).toBe(true)
    }
  })

  it('stays within WebKit\'s 150,000 cap at the maximum list size', () => {
    const { lists } = buildWebKitLists([{ id: 'big', dnr: hosts(160_000) }], { maxRulesPerList: WEBKIT_MAX_RULES_PER_LIST })
    expect(lists.map(list => list.rules.length)).toEqual([150_000, 10_000])
  })

  it('keeps the serialized lists a reasonable size per rule', () => {
    const { lists } = buildWebKitLists([{ id: 'size', dnr: hosts(10_000) }])
    const bytes = JSON.stringify(lists[0]!.rules).length
    expect(bytes / 10_000).toBeLessThan(160)
  })

  it('refuses a group whose exceptions alone fill a list', () => {
    const exceptions: DnrRule[] = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, action: { type: 'allow' }, condition: { urlFilter: `||ok-${i}.example^`, resourceTypes: ['script'] } }))
    expect(() => buildWebKitLists([{ id: 'tight', dnr: [...hosts(5, 100), ...exceptions] }], { maxRulesPerList: 10 })).toThrow('no room')
  })
})
