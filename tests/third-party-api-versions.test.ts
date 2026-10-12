/**
 * Every outbound integration's API version, pinned (stacksjs/stacks#2859).
 *
 * `@stacksjs/push` was calling an endpoint that had been dead for two years
 * and another with a 2027 sunset (#2856), and the Facebook driver pinned a
 * Graph version that expired on 2026-01-26 while the Instagram driver, against
 * the same host, named one three years newer. Nothing noticed any of it,
 * because two of the three ways this fails produce no error at all:
 *
 * 1. **The endpoint is gone.** `fcm.googleapis.com/fcm/send` answers 404 where
 *    the v1 endpoint answers 401. A probe finds this.
 * 2. **The version expired but is silently upgraded.** Meta serves a call to an
 *    unusable Graph version from the oldest version still supported, so the
 *    call succeeds and the version in the URL has merely stopped being the
 *    version answering. Only the provider's schedule finds this.
 * 3. **Auth is checked before the version.** LinkedIn returns the same 401 for
 *    every `linkedin-version`, so an unauthenticated probe says nothing.
 *
 * Which is why this file pins the surface rather than testing behaviour: for
 * (2) and (3) there is no behaviour to test. The tables below are what the
 * framework currently calls, and the tests assert the code still matches them
 * in both directions. A version that drifts, a host that gains a second
 * version, a retired endpoint that comes back, or an integration added without
 * a recorded version all fail here, which turns a silent upgrade into a
 * conscious edit of this file.
 *
 * Sources are read through `Bun.Transpiler`, so comments are gone before
 * anything is matched. Three of these versions are named in prose in the very
 * files that must not call them, and a guard that reads a comment pins nothing.
 */

import { describe, expect, it } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const coreDir = join(import.meta.dir, '../storage/framework/core')
const transpiler = new Bun.Transpiler({ loader: 'ts' })

/**
 * What the integration is to us, because a change does not mean the same thing
 * for each: `api` is a call that can break, `asset` a script we load, `link` a
 * URL shown to a person, `ours` a URL we serve ourselves.
 */
type Kind = 'api' | 'asset' | 'link' | 'ours'

interface UrlPin {
  host: string
  /** Every version path segment the framework names against this host. */
  versions: string[]
  kind: Kind
  why: string
}

/** Versions that appear literally in a URL. */
const URL_PINS: UrlPin[] = [
  { host: 'addons.mozilla.org', versions: ['api/v5'], kind: 'api', why: 'current; the AMO API retires older majors' },
  { host: 'api.anthropic.com', versions: ['v1'], kind: 'api', why: 'current' },
  { host: 'api.hetzner.cloud', versions: ['v1'], kind: 'api', why: 'current' },
  { host: 'api.lemonsqueezy.com', versions: ['v1'], kind: 'api', why: 'current' },
  { host: 'api.nexmo.com', versions: ['v1', 'v2'], kind: 'api', why: 'two products, not a disagreement: /v1/messages is the Messages API and /v2/verify is Verify v2' },
  { host: 'api.openai.com', versions: ['v1'], kind: 'api', why: 'current' },
  { host: 'api.sendgrid.com', versions: ['v3'], kind: 'api', why: 'current' },
  { host: 'api.twilio.com', versions: ['2010-04-01'], kind: 'api', why: "Twilio's stable version, not a stale date" },
  { host: 'cdn.paddle.com', versions: ['paddle/v2'], kind: 'asset', why: 'Paddle Billing JS SDK' },
  { host: 'discord.com', versions: ['api/v10', 'api/v9'], kind: 'api', why: 'deliberate and overridable: v10 for bot accounts, v9 for the user-account surface' },
  { host: 'exp.host', versions: ['--/api/v2'], kind: 'api', why: 'current Expo push API' },
  { host: 'fcm.googleapis.com', versions: ['v1'], kind: 'api', why: 'HTTP v1; the legacy API it replaced is in RETIRED below' },
  { host: 'lookups.twilio.com', versions: ['v2'], kind: 'api', why: 'current; v1 is the retired one' },
  { host: 'postmaster.google.com', versions: ['v2'], kind: 'link', why: "a dashboard URL inside a hint a person reads, not a call" },
  { host: 'stacksjs.com', versions: ['schemas/ai-project-context/v1'], kind: 'ours', why: 'our own schema URL' },
  { host: 'verify.twilio.com', versions: ['v2'], kind: 'api', why: 'current' },
]

interface HeaderPin {
  header: string
  value: string
  /** Why this one is written at a call site rather than named once. */
  why: string
}

/**
 * Versions written literally into a request header, which no URL scan sees.
 *
 * Empty, and that is the assertion. `anthropic-version` was at five call sites,
 * `x-restli-protocol-version` at three and `x-github-api-version` at two; all
 * three are now named once and live in DEFAULT_PINS below. #2859's second
 * acceptance item asks for exactly this, so the rule is that a version header
 * is not a literal at a call site, and an entry here is an exception that has
 * to argue for itself.
 */
const HEADER_PINS: HeaderPin[] = []

interface DefaultPin {
  integration: string
  /** Relative to `storage/framework/core`. */
  file: string
  version: string
  /** The expression an application overrides it through, inside `file`. */
  overridableVia?: string
  /**
   * Where the override is pinned instead, for a version defined in one file and
   * consumed in others. Relative to `storage/framework/core`.
   */
  structurePinnedBy?: string
  /** Why this one is a single constant with no application override. */
  notConfigurable?: string
  blockedOn?: string
}

/**
 * A version that is a configurable default rather than a literal in a URL.
 *
 * This is the category the Facebook bug lived in, so it is the category worth
 * pinning hardest: the value must appear exactly once in its file, so it cannot
 * be scattered the way `v18.0` was across four call sites.
 */
const DEFAULT_PINS: DefaultPin[] = [
  // The constant is defined alone and read by both drivers, so the override
  // lives in them. meta-graph.test.ts pins that shape, including that neither
  // driver hardcodes a version and that all four of Facebook's URLs are built
  // from the configured one; this pins the value.
  { integration: 'Meta Graph (Facebook and Instagram)', file: 'socials/src/meta-graph.ts', version: 'v24.0', structurePinnedBy: 'socials/tests/meta-graph.test.ts' },
  { integration: 'Threads', file: 'socials/src/drivers/threads.ts', version: 'v1.0', overridableVia: 'options.graphVersion' },
  {
    integration: 'LinkedIn',
    file: 'socials/src/drivers/linkedin.ts',
    version: '202405',
    overridableVia: 'options.apiVersion',
    blockedOn: 'LinkedIn answers 401 for every version, valid or not, so no probe can confirm it. May 2024, so it looks stale, but a wrong guess breaks posting. Needs a real credential',
  },
  // Was at five call sites, none of which had heard of `anthropicVersion`, so
  // an application configuring a version got it on chat and streaming and was
  // silently ignored on RAG, vision, buddy and personalization.
  { integration: 'Anthropic', file: 'ai/src/drivers/anthropic/index.ts', version: '2023-06-01', overridableVia: 'globalConfig?.anthropicVersion' },
  {
    integration: 'GitHub REST',
    file: 'github/src/client.ts',
    version: '2022-11-28',
    notConfigurable: 'GitHub keeps a dated version serving for at least 24 months after its successor ships, so this is a review item rather than a break risk, and neither header builder takes an options object to thread an override through. Exported as GITHUB_API_VERSION',
  },
  {
    integration: 'LinkedIn Rest.li protocol',
    file: 'socials/src/drivers/linkedin.ts',
    version: '2.0.0',
    notConfigurable: 'the wire protocol the API speaks, not a dated API version: it has been 2.0.0 throughout and nothing an application does should change it. The dated LinkedIn version is the separate pin above',
  },
]

interface RetiredPin {
  /** Matched against comment-stripped source. */
  needle: string
  dead: string
  why: string
}

const RETIRED: RetiredPin[] = [
  {
    needle: 'https://fcm.googleapis.com/fcm/send',
    dead: 'decommissioned 2024-06-20',
    why: 'the legacy FCM HTTP API, replaced by fcm.googleapis.com/v1/projects. A Web Push subscription endpoint issued by Chrome shares this prefix, but the app never writes one: web-push posts to whatever endpoint the browser handed it',
  },
  {
    needle: 'https://iid.googleapis.com/iid/v1',
    dead: 'stops serving 2027-09-29, closed to new projects 2027-01-01',
    why: 'legacy instance-ID topic subscription (#2856)',
  },
  {
    needle: 'fcm.googleapis.com/iid/v1',
    dead: 'stops serving 2027-09-29',
    why: 'the same legacy topic endpoint under the FCM host',
  },
]

function sourceFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir))
    return out

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)

    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'tests', 'test', '__tests__'].includes(entry.name))
        continue
      sourceFiles(path, out)
    }
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      out.push(path)
    }
  }

  return out
}

/** Core sources with comments removed, so prose cannot satisfy or break a match. */
function codeByFile(): Map<string, string> {
  const code = new Map<string, string>()

  for (const file of sourceFiles(coreDir)) {
    try {
      code.set(file.replace(`${coreDir}/`, ''), transpiler.transformSync(readFileSync(file, 'utf8')))
    }
    catch {
      // A file bun cannot transpile is one nothing imports either.
    }
  }

  return code
}

const CODE = codeByFile()

// A version as a path segment: `vN`, `vN.N`, a date, or a dated month.
const URL_VERSION = /https:\/\/([a-z0-9.-]+)\/((?:[a-z0-9._~-]+\/)*?)(v\d+(?:\.\d+)?|\d{4}-\d{2}-\d{2}|\d{4}-\d{2})(?=[/'"`\s)]|$)/gi
const HEADER_VERSION = /['"]([a-z][a-z0-9-]*-(?:api-)?(?:protocol-)?version)['"]\s*:\s*['"]([^'"]+)['"]/gi

describe('third-party API versions (#2859)', () => {
  it('reads enough of the framework to be meaningful', () => {
    // A walk that silently found nothing would make every assertion below pass.
    expect(CODE.size).toBeGreaterThan(500)
  })

  describe('versions named in a URL', () => {
    const live = new Map<string, Set<string>>()

    for (const code of CODE.values()) {
      for (const match of code.matchAll(URL_VERSION)) {
        const host = match[1]!
        const version = `${match[2] ?? ''}${match[3]!}`
        if (!live.has(host))
          live.set(host, new Set())
        live.get(host)!.add(version)
      }
    }

    it('names no host that is not pinned here', () => {
      // A new integration has to be recorded, which is the point: nobody checks
      // a provider's schedule for a version they did not know was being called.
      const pinned = new Set(URL_PINS.map(pin => pin.host))
      expect([...live.keys()].filter(host => !pinned.has(host)).sort()).toEqual([])
    })

    it('still names every host pinned here', () => {
      // The mirror: a pin for a call that no longer exists is stale, and a
      // stale pin is how this file would rot into saying nothing.
      expect(URL_PINS.map(pin => pin.host).filter(host => !live.has(host)).sort()).toEqual([])
    })

    it.each(URL_PINS.map(pin => [pin.host, pin] as const))('%s calls exactly its pinned version(s)', (host, pin) => {
      expect([...(live.get(host) ?? [])].sort()).toEqual([...pin.versions].sort())
    })

    it('says why every host with more than one version has more than one', () => {
      // Two versions against one host is exactly the Facebook/Instagram bug, so
      // it is allowed only where the reason is written down.
      for (const pin of URL_PINS.filter(entry => entry.versions.length > 1))
        expect(pin.why.length, pin.host).toBeGreaterThan(30)
    })
  })

  describe('versions named in a request header', () => {
    const live = new Map<string, Map<string, number>>()

    for (const code of CODE.values()) {
      for (const match of code.matchAll(HEADER_VERSION)) {
        const header = match[1]!.toLowerCase()
        const value = match[2]!
        if (!live.has(header))
          live.set(header, new Map())
        const values = live.get(header)!
        values.set(value, (values.get(value) ?? 0) + 1)
      }
    }

    it('writes no version into a header at a call site', () => {
      // #2859's second acceptance item, as a rule rather than a count. Every
      // version header is named once now, so anything appearing here is a new
      // literal and has to either be named once too or argue for itself in
      // HEADER_PINS. A failure prints the header and value, which is enough to
      // find it.
      const pinned = new Set(HEADER_PINS.map(pin => pin.header))
      const literals = [...live.entries()]
        .filter(([header]) => !pinned.has(header))
        .flatMap(([header, values]) => [...values.entries()].map(([value, sites]) => `${header}: ${value} (${sites})`))

      expect(literals.sort()).toEqual([])
    })

    it('still accounts for every header it pins', () => {
      // Empty today. A pin for a literal that no longer exists would otherwise
      // sit here excusing something gone, which is how this table would rot.
      for (const pin of HEADER_PINS) {
        expect([...(live.get(pin.header)?.keys() ?? [])], pin.header).toEqual([pin.value])
        expect(pin.why.length, pin.header).toBeGreaterThan(30)
      }
    })
  })

  describe('versions that are a configurable default', () => {
    it.each(DEFAULT_PINS.map(pin => [pin.integration, pin] as const))('%s names its version exactly once', (_integration, pin) => {
      const code = CODE.get(pin.file)
      expect(code, `${pin.file} is not a core source file`).toBeDefined()

      // Exactly one, so it cannot be scattered the way Graph v18.0 was across
      // four call sites, where changing it meant finding all four.
      expect(code!.split(pin.version).length - 1).toBe(1)
    })

    it.each(DEFAULT_PINS.map(pin => [pin.integration, pin] as const))('%s can be overridden by the application', (_integration, pin) => {
      if (pin.overridableVia) {
        expect(CODE.get(pin.file)).toContain(pin.overridableVia)
        return
      }

      if (pin.notConfigurable) {
        // Deliberately one constant with no override, so what is asserted is
        // that it is exported or named rather than inlined: the value appearing
        // exactly once is pinned by the test above.
        expect(CODE.get(pin.file)).toMatch(/(?:export )?const [A-Z_]+ = /)
        return
      }

      // Defined in one file and consumed in others, so the override is pinned
      // by the named test rather than visible here. Asserted to exist and to
      // actually be about the override, so a deleted guard fails this one.
      const guard = join(coreDir, pin.structurePinnedBy!)
      expect(existsSync(guard), `${pin.integration}: ${pin.structurePinnedBy} is missing`).toBe(true)
      expect(readFileSync(guard, 'utf8')).toContain('graphVersion')
    })

    it('says for each one how its value can be changed', () => {
      // Exactly one of the three, so a pin cannot be added with no story: an
      // override expression, a test that pins the override for a shared
      // constant, or a reason there is deliberately no override.
      for (const pin of DEFAULT_PINS) {
        const stories = [pin.overridableVia, pin.structurePinnedBy, pin.notConfigurable].filter(Boolean)
        expect(stories, pin.integration).toHaveLength(1)
      }
    })

    it('argues for every version it declares unconfigurable', () => {
      for (const pin of DEFAULT_PINS.filter(entry => entry.notConfigurable))
        expect(pin.notConfigurable!.length, pin.integration).toBeGreaterThan(60)
    })

    it('records what blocks each version it cannot settle', () => {
      const blocked = DEFAULT_PINS.filter(pin => pin.blockedOn)

      // #2859 accepts "recorded here with the reason it cannot be settled", so
      // an empty reason would satisfy the letter of it and none of the point.
      expect(blocked.length).toBeGreaterThan(0)
      for (const pin of blocked)
        expect(pin.blockedOn!.length, pin.integration).toBeGreaterThan(40)
    })
  })

  describe('retired endpoints', () => {
    it.each(RETIRED.map(pin => [pin.needle, pin] as const))('%s is not called anywhere', (needle, pin) => {
      const callers = [...CODE.entries()].filter(([, code]) => code.includes(needle)).map(([file]) => file)

      expect(callers, `${needle} (${pin.dead})`).toEqual([])
    })

    it('is matched against code rather than prose', () => {
      // The decommissioned FCM URL is named in a comment in the push driver's
      // own test, and the expired Graph version in the Meta guard's. If
      // comments reached these assertions the bans above would be unfailable.
      const explained = readFileSync(join(coreDir, 'push/tests/fcm.test.ts'), 'utf8')
      expect(explained).toContain('fcm/send')
      expect(transpiler.transformSync(explained)).not.toContain('fcm/send')
    })
  })
})
