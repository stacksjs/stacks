/**
 * declarativeNetRequest rules as WebKit content-blocker lists.
 *
 * An app that embeds WKWebView has no extension runtime, but it does have
 * `WKContentRuleListStore`, which compiles the JSON format Safari content
 * blockers use. This module turns an extension's DNR rules (and its cosmetic
 * selectors) into that format, so one blocker ships to Chrome, Firefox,
 * Safari and any WebKit app from the same rules.
 *
 * It imports nothing but `node:crypto`, so an app can also convert rules it
 * builds at runtime: `import { buildWebKitLists } from '@stacksjs/browser-extension/webkit'`.
 *
 * What WebKit cannot express is never dropped quietly. Every conversion comes
 * with a report: rules left out (`unsupported`) and rules emitted with
 * narrower or broader matching than DNR's (`approximated`), each with a count
 * and example rule ids.
 */

import { createHash } from 'node:crypto'

export type DnrResourceType =
  | 'main_frame'
  | 'sub_frame'
  | 'stylesheet'
  | 'script'
  | 'image'
  | 'font'
  | 'object'
  | 'xmlhttprequest'
  | 'ping'
  | 'csp_report'
  | 'media'
  | 'websocket'
  | 'webtransport'
  | 'webbundle'
  | 'other'

export type DnrActionType = 'block' | 'allow' | 'allowAllRequests' | 'upgradeScheme' | 'redirect' | 'modifyHeaders'

/** The parts of a `chrome.declarativeNetRequest.RuleCondition` this converter reads. */
export interface DnrCondition {
  urlFilter?: string
  regexFilter?: string
  isUrlFilterCaseSensitive?: boolean
  initiatorDomains?: string[]
  excludedInitiatorDomains?: string[]
  /** Deprecated spelling of `initiatorDomains`, still accepted by Chrome. */
  domains?: string[]
  /** Deprecated spelling of `excludedInitiatorDomains`. */
  excludedDomains?: string[]
  requestDomains?: string[]
  excludedRequestDomains?: string[]
  resourceTypes?: DnrResourceType[] | string[]
  excludedResourceTypes?: DnrResourceType[] | string[]
  requestMethods?: string[]
  excludedRequestMethods?: string[]
  domainType?: 'firstParty' | 'thirdParty'
  tabIds?: number[]
  excludedTabIds?: number[]
  responseHeaders?: unknown[]
  excludedResponseHeaders?: unknown[]
}

/** A `chrome.declarativeNetRequest.Rule`, loosely typed so `@types/chrome` rules assign to it. */
export interface DnrRule {
  id: number
  priority?: number
  action: { type: DnrActionType | string, [key: string]: unknown }
  condition: DnrCondition
}

export type WebKitResourceType =
  | 'document'
  | 'image'
  | 'style-sheet'
  | 'script'
  | 'font'
  | 'raw'
  | 'svg-document'
  | 'media'
  | 'popup'
  | 'ping'
  | 'fetch'
  | 'websocket'
  | 'other'

export interface WebKitTrigger {
  'url-filter': string
  'url-filter-is-case-sensitive'?: boolean
  'resource-type'?: WebKitResourceType[]
  'load-type'?: Array<'first-party' | 'third-party'>
  'load-context'?: Array<'top-frame' | 'child-frame'>
  'if-domain'?: string[]
  'unless-domain'?: string[]
}

export type WebKitAction =
  | { type: 'block' }
  | { type: 'ignore-previous-rules' }
  | { type: 'make-https' }
  | { type: 'css-display-none', selector: string }

/** One rule in WebKit's content-blocker JSON (`WKContentRuleListStore`). */
export interface WebKitRule {
  trigger: WebKitTrigger
  action: WebKitAction
}

/** A cosmetic rule: elements matching `selector` are hidden (`css-display-none`). */
export interface WebKitCosmeticRule {
  selector: string | string[]
  /** Pages it applies to (and their subdomains). Omitted: every page. */
  domains?: string[]
  /** Pages it never applies to (and their subdomains). */
  excludedDomains?: string[]
}

/**
 * A named source of rules: one DNR ruleset, the extension's dynamic rules, or
 * a set of cosmetic selectors. Each group becomes one or more lists, so a host
 * app can switch groups on and off the way the extension switches rulesets.
 */
export interface WebKitRuleGroup {
  id: string
  /** Whether the extension enables this group by default. @default true */
  enabled?: boolean
  dnr?: DnrRule[]
  cosmetic?: WebKitCosmeticRule[]
}

export interface WebKitListOptions {
  /**
   * Rules per compiled list, including the exception rules every network list
   * repeats. WebKit refuses a list over 150,000 rules, and smaller lists
   * compile faster and recompile less when one rule changes.
   * @default 50000
   */
  maxRulesPerList?: number
  /** Selectors joined into one `css-display-none` rule. @default 100 */
  selectorsPerRule?: number
}

/** A WebKit content-blocker list, ready for `WKContentRuleListStore.compileContentRuleList`. */
export interface WebKitRuleList {
  /** Stable across builds: the same list, newer rules. Compile under this identifier. */
  id: string
  /** A content hash of `rules`: recompile only when it changes. */
  version: string
  /** The group the list was built from. */
  group: string
  kind: 'network' | 'cosmetic'
  enabled: boolean
  rules: WebKitRule[]
}

export interface WebKitConversionIssue {
  reason: string
  count: number
  /** Up to ten example rule ids (DNR ids, or cosmetic rule indexes). */
  examples: Array<number | string>
}

export interface WebKitConversionReport {
  /** DNR and cosmetic rules read. */
  input: number
  /** WebKit rules emitted, before exceptions are repeated across lists. */
  output: number
  /** Rules left out entirely, grouped by reason. */
  unsupported: WebKitConversionIssue[]
  /** Rules emitted with matching that differs from DNR's, grouped by reason. */
  approximated: WebKitConversionIssue[]
}

/** WebKit's hard limit on rules in one compiled list. */
export const WEBKIT_MAX_RULES_PER_LIST = 150_000

/** Thrown for a rule (or pattern) WebKit's content-blocker format cannot express. */
export class WebKitUnsupportedError extends Error {
  override name = 'WebKitUnsupportedError'
}

const ALL_DNR_TYPES: DnrResourceType[] = ['main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object', 'xmlhttprequest', 'ping', 'csp_report', 'media', 'websocket', 'webtransport', 'webbundle', 'other']

/**
 * DNR resource types to WebKit's. Frames are handled apart (as `document` plus
 * a `load-context`); `object` loads (plugin content) are `other` to WebKit.
 * `webtransport` and `webbundle` have no WebKit counterpart.
 */
const RESOURCE_TYPE_MAP: Partial<Record<DnrResourceType, WebKitResourceType>> = {
  stylesheet: 'style-sheet',
  script: 'script',
  image: 'image',
  font: 'font',
  object: 'other',
  xmlhttprequest: 'fetch',
  ping: 'ping',
  csp_report: 'ping',
  media: 'media',
  websocket: 'websocket',
  other: 'other',
}

/** Every subresource type WebKit has, so "all of them" can be written as no `resource-type` at all. */
const ALL_WEBKIT_SUBRESOURCE_TYPES: WebKitResourceType[] = ['style-sheet', 'script', 'image', 'font', 'fetch', 'ping', 'media', 'websocket', 'other']

/** Characters an adblock `^` separator may NOT be: letters, digits, `_ - . %`. */
const SEPARATOR = '[^a-zA-Z0-9_.%-]'
/** `||`: the start of the host or of any of its subdomain labels. */
const HOST_ANCHOR = '^[a-z][a-z0-9+.-]*://([^/:]*\\.)?'
/** WebKit's regex subset has no counted repetition; expansion past this is refused. */
const MAX_REPEAT = 16
/** Alternatives one regexFilter may expand into before it is reported instead. */
const MAX_EXPANSIONS = 64

function escapeRegexChar(char: string): string {
  return /[\\.+?$(){}[\]|*^]/.test(char) ? `\\${char}` : char
}

function escapeRegex(text: string): string {
  return [...text].map(escapeRegexChar).join('')
}

function assertAscii(text: string, what: string): void {
  // eslint-disable-next-line no-control-regex
  if (/[^\x00-\x7F]/.test(text))
    throw new WebKitUnsupportedError(`non-ASCII characters in ${what}`)
}

/**
 * A DNR `urlFilter` as the regular expression a WebKit `url-filter` takes.
 *
 * `||` anchors at a host label, `|` at the start or end of the URL, `*` is any
 * run of characters and `^` a separator (or, at the end, the end of the URL).
 * Everything else is literal. WebKit has no alternation, so a trailing `^` is
 * written `(sep.*)?$`: a separator then anything, or nothing at all.
 */
export function urlFilterToWebKitRegex(filter: string): string {
  assertAscii(filter, 'urlFilter')
  let pattern = filter
  let prefix = ''
  let suffix = ''

  if (pattern.startsWith('||')) {
    prefix = HOST_ANCHOR
    pattern = pattern.slice(2)
  }
  else if (pattern.startsWith('|')) {
    prefix = '^'
    pattern = pattern.slice(1)
  }

  if (pattern.endsWith('|')) {
    suffix = '$'
    pattern = pattern.slice(0, -1)
  }

  // `||host^` is by far the commonest filter. A browser always writes a `/`
  // (or a `:port`) after the host, so the separator is exactly `[:/]`.
  if (prefix === HOST_ANCHOR && !suffix && /^[\w.-]+\^$/.test(pattern))
    return `${prefix}${escapeRegex(pattern.slice(0, -1))}[:/]`

  let body = ''
  for (let index = 0; index < pattern.length; index++) {
    const char = pattern[index] as string
    if (char === '*') {
      body += '.*'
    }
    else if (char === '^') {
      const last = index === pattern.length - 1
      body += last ? (suffix ? `(${SEPARATOR})?` : `(${SEPARATOR}.*)?$`) : SEPARATOR
    }
    else {
      body += escapeRegexChar(char)
    }
  }

  // A search is unanchored already; leading and trailing `.*` only slow WebKit down.
  if (!prefix)
    body = body.replace(/^(?:\.\*)+/, '')
  if (!suffix)
    body = body.replace(/(?:\.\*)+$/, '')

  const regex = `${prefix}${body}${suffix}`
  return regex || '.*'
}

/** The regex a WebKit `url-filter` uses to match one host and its subdomains. */
export function hostToWebKitRegex(host: string): string {
  return `${HOST_ANCHOR}${escapeRegex(host)}[:/]`
}

/** Whether `pattern` stays inside WebKit's content-blocker regex subset. */
export function isWebKitRegex(pattern: string): boolean {
  // eslint-disable-next-line no-control-regex
  if (/[^\x00-\x7F]/.test(pattern))
    return false
  let inClass = false
  for (let index = 0; index < pattern.length; index++) {
    const char = pattern[index]
    if (char === '\\') {
      const next = pattern[index + 1] ?? ''
      // Only escaped literals: no \d, \w, \b, back-references and the like.
      if (/[0-9a-zA-Z]/.test(next))
        return false
      index++
      continue
    }
    if (inClass) {
      if (char === ']')
        inClass = false
      continue
    }
    if (char === '[') {
      inClass = true
      continue
    }
    if (char === '|' || char === '{' || char === '}')
      return false
    if (char === '(' && pattern[index + 1] === '?')
      return false
  }
  return !inClass
}

/*
 * regexFilter (RE2 syntax) to WebKit's subset: a tiny parser that rewrites
 * `\d`/`\w`, non-capturing groups, lazy quantifiers and `{n,m}` repetition,
 * and expands alternation into separate patterns (one WebKit rule each).
 */

interface RegexCursor {
  source: string
  index: number
}

function peek(cursor: RegexCursor): string | undefined {
  return cursor.source[cursor.index]
}

function product(left: string[], right: string[]): string[] {
  const out: string[] = []
  for (const a of left) {
    for (const b of right)
      out.push(a + b)
  }
  if (out.length > MAX_EXPANSIONS)
    throw new WebKitUnsupportedError(`regexFilter expands to more than ${MAX_EXPANSIONS} alternatives`)
  return out
}

function parseAlternation(cursor: RegexCursor): string[] {
  const options = [...parseSequence(cursor)]
  while (peek(cursor) === '|') {
    cursor.index++
    options.push(...parseSequence(cursor))
    if (options.length > MAX_EXPANSIONS)
      throw new WebKitUnsupportedError(`regexFilter expands to more than ${MAX_EXPANSIONS} alternatives`)
  }
  return options
}

function parseSequence(cursor: RegexCursor): string[] {
  let options = ['']
  while (cursor.index < cursor.source.length && peek(cursor) !== '|' && peek(cursor) !== ')') {
    const atom = parseAtom(cursor)
    options = product(options, applyQuantifier(cursor, atom))
  }
  return options
}

/** An atom's alternatives, and whether each one is a single unit a quantifier may follow. */
interface Atom {
  options: string[]
  quantifiable: boolean
}

function parseClass(cursor: RegexCursor): string {
  // cursor sits on `[`
  let out = '['
  cursor.index++
  if (peek(cursor) === '^') {
    out += '^'
    cursor.index++
  }
  if (peek(cursor) === ']') {
    out += '\\]'
    cursor.index++
  }
  while (cursor.index < cursor.source.length && peek(cursor) !== ']') {
    const char = peek(cursor) as string
    if (char === '\\') {
      const next = cursor.source[cursor.index + 1] ?? ''
      cursor.index += 2
      if (next === 'd')
        out += '0-9'
      else if (next === 'w')
        out += 'a-zA-Z0-9_'
      else if (/[a-zA-Z0-9]/.test(next))
        throw new WebKitUnsupportedError(`regexFilter uses \\${next}, which WebKit does not support`)
      else
        out += `\\${next}`
      continue
    }
    if (char === '[' && cursor.source[cursor.index + 1] === ':')
      throw new WebKitUnsupportedError('regexFilter uses a POSIX character class')
    out += char
    cursor.index++
  }
  if (peek(cursor) !== ']')
    throw new WebKitUnsupportedError('regexFilter has an unterminated character class')
  cursor.index++
  return `${out}]`
}

function parseAtom(cursor: RegexCursor): Atom {
  const char = peek(cursor) as string

  if (char === '(') {
    cursor.index++
    if (peek(cursor) === '?') {
      if (cursor.source[cursor.index + 1] === ':')
        cursor.index += 2
      else
        throw new WebKitUnsupportedError('regexFilter uses a lookaround, named group or inline flag')
    }
    const inner = parseAlternation(cursor)
    if (peek(cursor) !== ')')
      throw new WebKitUnsupportedError('regexFilter has an unbalanced group')
    cursor.index++
    return { options: inner.map(option => `(${option})`), quantifiable: true }
  }

  if (char === '[')
    return { options: [parseClass(cursor)], quantifiable: true }

  if (char === '\\') {
    const next = cursor.source[cursor.index + 1] ?? ''
    cursor.index += 2
    if (next === 'd')
      return { options: ['[0-9]'], quantifiable: true }
    if (next === 'w')
      return { options: ['[a-zA-Z0-9_]'], quantifiable: true }
    if (next === '/')
      return { options: ['/'], quantifiable: true }
    if (/[a-zA-Z0-9]/.test(next))
      throw new WebKitUnsupportedError(`regexFilter uses \\${next}, which WebKit does not support`)
    return { options: [`\\${next}`], quantifiable: true }
  }

  if (char === '*' || char === '+' || char === '?' || char === '{')
    throw new WebKitUnsupportedError('regexFilter has a quantifier with nothing to repeat')

  cursor.index++
  if (char === '^' || char === '$')
    return { options: [char], quantifiable: false }
  // A stray `}` or `]` is a literal to RE2; WebKit wants it escaped.
  return { options: [char === '}' || char === ']' ? `\\${char}` : char], quantifiable: true }
}

function applyQuantifier(cursor: RegexCursor, atom: Atom): string[] {
  const char = peek(cursor)
  if (char !== '*' && char !== '+' && char !== '?' && char !== '{')
    return atom.options
  if (!atom.quantifiable)
    throw new WebKitUnsupportedError('regexFilter quantifies an anchor')

  let min: number
  let max: number | undefined
  if (char === '{') {
    const match = /^\{(\d+)(,(\d*))?\}/.exec(cursor.source.slice(cursor.index))
    if (!match)
      throw new WebKitUnsupportedError('regexFilter has a malformed {n,m} repetition')
    cursor.index += match[0].length
    min = Number(match[1])
    max = match[2] === undefined ? min : match[3] ? Number(match[3]) : undefined
    if (min > MAX_REPEAT || (max !== undefined && (max > MAX_REPEAT || max < min)))
      throw new WebKitUnsupportedError(`regexFilter repeats more than ${MAX_REPEAT} times`)
  }
  else {
    cursor.index++
    min = char === '+' ? 1 : 0
    max = char === '?' ? 1 : undefined
  }
  // Laziness changes what a match captures, never whether a URL matches.
  if (peek(cursor) === '?')
    cursor.index++

  // A single alternative takes WebKit's own *, +, ? directly.
  if (atom.options.length === 1) {
    const unit = atom.options[0] as string
    if (char !== '{')
      return [`${unit}${char}`]
    const required = unit.repeat(min)
    if (max === undefined)
      return [`${required}${unit}*`]
    return [`${required}${`${unit}?`.repeat(max - min)}`]
  }

  // Alternatives cannot carry * or + without alternation; finite counts expand.
  if (max === undefined)
    throw new WebKitUnsupportedError('regexFilter repeats an alternation without bound')
  let options: string[] = []
  for (let count = min; count <= max; count++) {
    let repeated = ['']
    for (let n = 0; n < count; n++)
      repeated = product(repeated, atom.options)
    options.push(...repeated)
    if (options.length > MAX_EXPANSIONS)
      throw new WebKitUnsupportedError(`regexFilter expands to more than ${MAX_EXPANSIONS} alternatives`)
  }
  options = [...new Set(options)]
  return options
}

/**
 * A DNR `regexFilter` as one or more WebKit `url-filter` patterns. Alternation
 * becomes several patterns (each its own rule); anything outside WebKit's
 * subset throws `WebKitUnsupportedError`.
 */
export function regexFilterToWebKit(regex: string): string[] {
  assertAscii(regex, 'regexFilter')
  const cursor: RegexCursor = { source: regex, index: 0 }
  const options = parseAlternation(cursor)
  if (cursor.index !== regex.length)
    throw new WebKitUnsupportedError('regexFilter has an unbalanced group')
  const patterns = [...new Set(options.map(option => option || '.*'))]
  for (const pattern of patterns) {
    if (!isWebKitRegex(pattern))
      throw new WebKitUnsupportedError('regexFilter cannot be expressed in WebKit\'s regex subset')
  }
  return patterns
}

/** Lowercase, punycoded, without a leading `*.` or `.`. */
function normalizeDomain(domain: string): string {
  const bare = domain.trim().toLowerCase().replace(/^\*?\./, '')
  // eslint-disable-next-line no-control-regex
  if (!/[^\x00-\x7F]/.test(bare))
    return bare
  try {
    return new URL(`http://${bare}/`).hostname
  }
  catch {
    throw new WebKitUnsupportedError(`domain "${domain}" is not a valid host`)
  }
}

function isUnder(domain: string, parent: string): boolean {
  return domain === parent || domain.endsWith(`.${parent}`)
}

/**
 * `if-domain` / `unless-domain` from DNR's included and excluded initiators.
 * WebKit allows one of the two per rule; an exclusion under an included
 * domain (include example.com, exclude ads.example.com) has no WebKit form.
 */
function domainCondition(included: string[], excluded: string[], what: string): Pick<WebKitTrigger, 'if-domain' | 'unless-domain'> | null {
  let include = [...new Set(included.map(normalizeDomain))]
  const exclude = [...new Set(excluded.map(normalizeDomain))]

  if (include.length && exclude.length) {
    include = include.filter(domain => !exclude.some(ex => isUnder(domain, ex)))
    if (!include.length)
      return null
    if (exclude.some(ex => include.some(domain => isUnder(ex, domain))))
      throw new WebKitUnsupportedError(`${what} excluded under an included domain`)
    return { 'if-domain': include.map(domain => `*${domain}`) }
  }
  if (include.length)
    return { 'if-domain': include.map(domain => `*${domain}`) }
  if (exclude.length)
    return { 'unless-domain': exclude.map(domain => `*${domain}`) }
  return {}
}

interface ResourceVariant {
  types?: WebKitResourceType[]
  loadContext?: Array<'top-frame' | 'child-frame'>
}

/**
 * The WebKit `resource-type` (and `load-context`) combinations a DNR rule's
 * resource types need. DNR's default leaves top-level documents out, so a rule
 * without `resourceTypes` blocks subframes but not the page itself; WebKit's
 * default includes it, so the frames are spelled out with a `load-context`.
 */
function resourceVariants(condition: DnrCondition, approximate: (reason: string) => void): ResourceVariant[] {
  const listed = (condition.resourceTypes as DnrResourceType[] | undefined) ?? ALL_DNR_TYPES.filter(type => type !== 'main_frame')
  const excluded = new Set((condition.excludedResourceTypes as DnrResourceType[] | undefined) ?? [])
  const types = new Set(listed.filter(type => !excluded.has(type)))

  const unmappable = [...types].filter(type => type !== 'main_frame' && type !== 'sub_frame' && !RESOURCE_TYPE_MAP[type])
  if (unmappable.length && unmappable.length === types.size)
    throw new WebKitUnsupportedError(`only resource types WebKit cannot match (${unmappable.join(', ')})`)
  // Implicit defaults are "everything", so only an explicit unmappable type is worth reporting.
  if (unmappable.length && condition.resourceTypes)
    approximate(`resource types without a WebKit equivalent ignored (${unmappable.sort().join(', ')})`)

  const sub = [...new Set([...types].map(type => RESOURCE_TYPE_MAP[type]).filter((type): type is WebKitResourceType => Boolean(type)))]
  const main = types.has('main_frame')
  const frame = types.has('sub_frame')
  const variants: ResourceVariant[] = []

  if (main && frame) {
    if (ALL_WEBKIT_SUBRESOURCE_TYPES.every(type => sub.includes(type)))
      return [{}]
    sub.push('document', 'svg-document', 'popup')
  }
  if (sub.length)
    variants.push({ types: sub })
  if (main && !frame) {
    variants.push({ types: ['document', 'svg-document'], loadContext: ['top-frame'] })
    // A window.open or target=_blank load is a `popup` to WebKit, a main_frame to DNR.
    variants.push({ types: ['popup'] })
  }
  if (frame && !main)
    variants.push({ types: ['document', 'svg-document'], loadContext: ['child-frame'] })
  return variants
}

/** The hostname a `||host`, `||host^`, `||host/` or `||host^*` filter names, else null. */
function hostOfFilter(filter: string): string | null {
  const match = /^\|\|([\w.-]+)(?:\^|\/)?\*?\|?$/.exec(filter)
  return match ? (match[1] as string).toLowerCase() : null
}

/** The leading host a `||` filter starts with (`||ads.example.com/x` → `ads.example.com`). */
function leadingHostOfFilter(filter: string): string | null {
  const match = /^\|\|([\w.-]+)/.exec(filter)
  return match ? (match[1] as string).toLowerCase() : null
}

/** The `url-filter` patterns a DNR condition matches requests by. */
function urlPatterns(condition: DnrCondition, approximate: (reason: string) => void): string[] {
  const requestDomains = (condition.requestDomains ?? []).map(normalizeDomain)

  if (condition.regexFilter !== undefined) {
    if (requestDomains.length)
      throw new WebKitUnsupportedError('regexFilter combined with requestDomains')
    return regexFilterToWebKit(condition.regexFilter)
  }

  if (condition.urlFilter !== undefined && condition.urlFilter !== '') {
    const filter = condition.urlFilter
    const pattern = urlFilterToWebKitRegex(filter)
    if (!requestDomains.length)
      return [pattern]

    const leading = leadingHostOfFilter(filter)
    if (leading) {
      // `||ads.example.com/x` with requestDomains [example.com]: the filter already implies it.
      if (requestDomains.some(domain => isUnder(leading, domain)))
        return [pattern]
      throw new WebKitUnsupportedError('a ||host urlFilter outside its requestDomains')
    }
    if (filter.startsWith('|'))
      throw new WebKitUnsupportedError('a |-anchored urlFilter combined with requestDomains')
    // An unanchored filter must match after the host here, never inside it.
    approximate('requestDomains with an unanchored urlFilter match it only after the host')
    return requestDomains.map(domain => `${HOST_ANCHOR}${escapeRegex(domain)}[:/].*${pattern}`)
  }

  if (requestDomains.length)
    return requestDomains.map(hostToWebKitRegex)
  return ['.*']
}

/** A converted rule with what ordering it needs: DNR priority, then action precedence. */
export interface RankedWebKitRule {
  rule: WebKitRule
  priority: number
  /** Within one priority: make-https 0, block 1, allowAllRequests 2, allow 3 (DNR's precedence). */
  rank: number
  /** An `ignore-previous-rules` rule, repeated in every network list. */
  exception: boolean
}

export interface DnrRuleConversion {
  rules: RankedWebKitRule[]
  /** Reasons the WebKit rules match differently from the DNR rule. */
  approximated: string[]
}

/** `allowAllRequests`: everything a page (and its frames) loads, by the page's domain. */
function convertAllowAllRequests(rule: DnrRule, approximated: string[]): RankedWebKitRule[] {
  const { condition } = rule
  const types = new Set((condition.resourceTypes as DnrResourceType[] | undefined) ?? [])
  if (!types.has('main_frame'))
    throw new WebKitUnsupportedError('allowAllRequests for subframes only')
  if (condition.regexFilter !== undefined)
    throw new WebKitUnsupportedError('allowAllRequests with a regexFilter')

  const pages = (condition.requestDomains ?? []).map(normalizeDomain)
  if (condition.urlFilter) {
    const host = hostOfFilter(condition.urlFilter)
    if (!host)
      throw new WebKitUnsupportedError('allowAllRequests with a urlFilter that is not a bare ||host')
    pages.push(host)
  }
  const initiators = [...(condition.initiatorDomains ?? []), ...(condition.domains ?? [])]
  const domains = domainCondition(
    [...pages, ...initiators],
    [...(condition.excludedInitiatorDomains ?? []), ...(condition.excludedDomains ?? [])],
    'allowAllRequests page',
  )
  if (domains === null)
    throw new WebKitUnsupportedError('every included domain is also excluded')

  if (types.has('sub_frame') && (pages.length || initiators.length))
    approximated.push('allowAllRequests applies to top-level pages on its domains, not to their frames embedded elsewhere')

  return [{
    rule: { trigger: { 'url-filter': '.*', ...domains }, action: { type: 'ignore-previous-rules' } },
    priority: rule.priority ?? 1,
    rank: 2,
    exception: true,
  }]
}

/**
 * One DNR rule as WebKit rules. Throws `WebKitUnsupportedError` when WebKit
 * has no way to say it; otherwise lists any way the result matches differently.
 */
export function convertDnrRule(rule: DnrRule): DnrRuleConversion {
  const condition = rule.condition ?? {}
  const approximated: string[] = []
  const approximate = (reason: string): void => {
    approximated.push(reason)
  }

  if (condition.tabIds?.length || condition.excludedTabIds?.length)
    throw new WebKitUnsupportedError('tabIds conditions')
  if (condition.requestMethods?.length || condition.excludedRequestMethods?.length)
    throw new WebKitUnsupportedError('request method conditions')
  if (condition.responseHeaders?.length || condition.excludedResponseHeaders?.length)
    throw new WebKitUnsupportedError('response header conditions')
  if (condition.excludedRequestDomains?.length)
    throw new WebKitUnsupportedError('excludedRequestDomains')

  const type = rule.action?.type
  if (type === 'allowAllRequests')
    return { rules: convertAllowAllRequests(rule, approximated), approximated }

  let action: WebKitAction
  let rank: number
  if (type === 'block') {
    action = { type: 'block' }
    rank = 1
  }
  else if (type === 'allow') {
    action = { type: 'ignore-previous-rules' }
    rank = 3
  }
  else if (type === 'upgradeScheme') {
    action = { type: 'make-https' }
    rank = 0
  }
  else if (type === 'redirect') {
    throw new WebKitUnsupportedError('redirect actions (content blockers cannot redirect)')
  }
  else if (type === 'modifyHeaders') {
    throw new WebKitUnsupportedError('modifyHeaders actions')
  }
  else {
    throw new WebKitUnsupportedError(`unknown action type "${String(type)}"`)
  }

  const domains = domainCondition(
    [...(condition.initiatorDomains ?? []), ...(condition.domains ?? [])],
    [...(condition.excludedInitiatorDomains ?? []), ...(condition.excludedDomains ?? [])],
    'initiator domain',
  )
  if (domains === null)
    throw new WebKitUnsupportedError('every included domain is also excluded')

  const patterns = urlPatterns(condition, approximate)
  const variants = resourceVariants(condition, approximate)
  const loadType = condition.domainType === 'firstParty'
    ? { 'load-type': ['first-party' as const] }
    : condition.domainType === 'thirdParty'
      ? { 'load-type': ['third-party' as const] }
      : {}
  const caseSensitive = condition.isUrlFilterCaseSensitive ? { 'url-filter-is-case-sensitive': true } : {}

  const rules: RankedWebKitRule[] = []
  for (const pattern of patterns) {
    for (const variant of variants) {
      const trigger: WebKitTrigger = {
        'url-filter': pattern,
        ...caseSensitive,
        ...(variant.types ? { 'resource-type': variant.types } : {}),
        ...(variant.loadContext ? { 'load-context': variant.loadContext } : {}),
        ...loadType,
        ...domains,
      }
      rules.push({ rule: { trigger, action }, priority: rule.priority ?? 1, rank, exception: action.type === 'ignore-previous-rules' })
    }
  }
  return { rules, approximated }
}

/** Selectors WebKit's CSS engine would reject, or that only adblock engines understand. */
const PROCEDURAL_PSEUDO = /:(?:-abp-|has-text|contains|matches-css|matches-attr|matches-path|xpath|upward|remove|style|min-text-length|watch-attr|others|if|if-not)\b/

/** Why a cosmetic selector cannot ship, or null when it can. */
export function cosmeticSelectorProblem(selector: string): string | null {
  const text = selector.trim()
  if (!text)
    return 'an empty selector'
  if (/[{};]/.test(text))
    return 'a selector containing CSS declarations'
  if (PROCEDURAL_PSEUDO.test(text))
    return 'a procedural (adblock-only) pseudo-class'
  let depth = 0
  let quote = ''
  for (const char of text) {
    if (quote) {
      if (char === quote)
        quote = ''
      continue
    }
    if (char === '"' || char === '\'')
      quote = char
    else if (char === '(' || char === '[')
      depth++
    else if (char === ')' || char === ']')
      depth--
    if (depth < 0)
      return 'a selector with unbalanced brackets'
  }
  if (depth !== 0 || quote)
    return 'a selector with unbalanced brackets or quotes'
  return null
}

class Issues {
  private byReason = new Map<string, WebKitConversionIssue>()

  add(reason: string, example: number | string): void {
    const issue = this.byReason.get(reason) ?? { reason, count: 0, examples: [] }
    issue.count++
    if (issue.examples.length < 10)
      issue.examples.push(example)
    this.byReason.set(reason, issue)
  }

  list(): WebKitConversionIssue[] {
    return [...this.byReason.values()].sort((a, b) => b.count - a.count)
  }
}

/** A content hash: the list's `version`. */
export function webkitListVersion(rules: WebKitRule[]): string {
  return createHash('sha256').update(JSON.stringify(rules)).digest('hex').slice(0, 16)
}

function safeId(id: string): string {
  if (!/^[\w.-]+$/.test(id))
    throw new Error(`[browser-extension] WebKit list id "${id}" may only contain letters, digits, '.', '_' and '-'`)
  return id
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let index = 0; index < items.length; index += size)
    out.push(items.slice(index, index + size))
  return out
}

interface OrderedRule extends RankedWebKitRule {
  order: number
}

function byPrecedence(a: OrderedRule, b: OrderedRule): number {
  return a.priority - b.priority || a.rank - b.rank || a.order - b.order
}

/**
 * Convert rule groups to WebKit lists.
 *
 * Within a list, WebKit applies `ignore-previous-rules` only to rules before
 * it, so each list is ordered by DNR priority and then DNR's precedence
 * (allow beats block at one priority). Lists compile independently, while DNR
 * evaluates every enabled ruleset together, so each network list repeats every
 * exception from the enabled groups (plus its own group's). A group over
 * `maxRulesPerList` is split into `<id>`, `<id>-2`, … with the exceptions
 * counted against each part. Cosmetic groups never receive network exceptions:
 * an extension's DNR `allow` does not unhide elements.
 */
export function buildWebKitLists(groups: WebKitRuleGroup[], options: WebKitListOptions = {}): { lists: WebKitRuleList[], report: WebKitConversionReport } {
  const max = options.maxRulesPerList ?? 50_000
  if (!Number.isInteger(max) || max < 1 || max > WEBKIT_MAX_RULES_PER_LIST)
    throw new Error(`[browser-extension] maxRulesPerList must be an integer from 1 to ${WEBKIT_MAX_RULES_PER_LIST}`)
  const perRule = options.selectorsPerRule ?? 100

  const unsupported = new Issues()
  const approximated = new Issues()
  let input = 0
  let output = 0
  let order = 0

  const seen = new Set<string>()
  const converted = groups.map((group) => {
    const id = safeId(group.id)
    if (seen.has(id))
      throw new Error(`[browser-extension] two WebKit rule groups are both named "${id}"`)
    seen.add(id)

    const network: OrderedRule[] = []
    for (const rule of group.dnr ?? []) {
      input++
      try {
        const result = convertDnrRule(rule)
        for (const reason of result.approximated)
          approximated.add(reason, rule.id)
        for (const ranked of result.rules)
          network.push({ ...ranked, order: order++ })
        output += result.rules.length
      }
      catch (error) {
        if (!(error instanceof WebKitUnsupportedError))
          throw error
        unsupported.add(error.message, rule.id)
      }
    }

    const cosmetic: OrderedRule[] = []
    for (const [index, entry] of (group.cosmetic ?? []).entries()) {
      input++
      const example = `${id}#${index}`
      const selectors = (Array.isArray(entry.selector) ? entry.selector : [entry.selector]).filter((selector) => {
        const problem = cosmeticSelectorProblem(selector)
        if (problem)
          unsupported.add(`cosmetic: ${problem}`, example)
        return !problem
      })
      if (!selectors.length)
        continue
      let domains: ReturnType<typeof domainCondition>
      try {
        domains = domainCondition(entry.domains ?? [], entry.excludedDomains ?? [], 'cosmetic page')
      }
      catch (error) {
        if (!(error instanceof WebKitUnsupportedError))
          throw error
        unsupported.add(`cosmetic: ${error.message}`, example)
        continue
      }
      if (domains === null) {
        unsupported.add('cosmetic: every included domain is also excluded', example)
        continue
      }
      for (const part of chunk(selectors, perRule)) {
        cosmetic.push({
          rule: { trigger: { 'url-filter': '.*', ...domains }, action: { type: 'css-display-none', selector: part.join(', ') } },
          priority: 0,
          rank: 0,
          exception: false,
          order: order++,
        })
        output++
      }
    }

    return { id, enabled: group.enabled ?? true, network, cosmetic }
  })

  const globalExceptions = converted
    .filter(group => group.enabled)
    .flatMap(group => group.network.filter(rule => rule.exception))

  const lists: WebKitRuleList[] = []
  const emit = (id: string, kind: WebKitRuleList['kind'], enabled: boolean, ordinary: OrderedRule[], exceptions: OrderedRule[]): void => {
    if (!ordinary.length)
      return
    const room = max - exceptions.length
    if (room < 1)
      throw new Error(`[browser-extension] group "${id}" needs ${exceptions.length} exception rules in every list, which leaves no room under maxRulesPerList (${max})`)
    chunk(ordinary, room).forEach((part, index) => {
      const rules = [...part, ...exceptions].sort(byPrecedence).map(entry => entry.rule)
      lists.push({ id: index ? `${id}-${index + 1}` : id, version: webkitListVersion(rules), group: id, kind, enabled, rules })
    })
  }

  for (const group of converted) {
    const own = group.network.filter(rule => rule.exception)
    const exceptions = group.enabled ? globalExceptions : [...globalExceptions, ...own]
    emit(group.id, 'network', group.enabled, group.network.filter(rule => !rule.exception), exceptions)
    // A group holding both kinds keeps its cosmetic rules in their own list.
    emit(group.network.length ? `${group.id}-cosmetic` : group.id, 'cosmetic', group.enabled, group.cosmetic, [])
  }

  return { lists, report: { input, output, unsupported: unsupported.list(), approximated: approximated.list() } }
}
