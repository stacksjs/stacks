import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { androidCapabilityKeys, ANDROID_UNMAPPED_CRAFT_FLAGS } from '../src/build/android-config'
import { iosCapabilityKeys, IOS_UNMAPPED_CRAFT_FLAGS } from '../src/build/ios-config'

/*
 * stacksjs/stacks#3147. The capability maps are closed, so a flag Craft ships
 * is unreachable from an app until a map names it, and nothing used to say
 * so: Craft's shake gesture was dead in seven TestFlight builds (#3146). Every
 * `enable…` flag the installed Craft declares is mapped or listed as unmapped
 * with a reason, and every map target is a flag Craft still has.
 */
const craftRoot = dirname(Bun.resolveSync('craft-native/package.json', import.meta.dir))
const craftVersion = (JSON.parse(readFileSync(join(craftRoot, 'package.json'), 'utf8')) as { version: string }).version

/** The `enable…` properties of `export interface <name>`, without those of its nested objects. */
function declaredFlags(file: string, name: string): Set<string> {
  const source = readFileSync(join(craftRoot, file), 'utf8')
  const start = source.indexOf(`export interface ${name} {`)
  if (start < 0) throw new Error(`craft-native ${craftVersion} declares no ${name} in ${file}`)
  const flags = new Set<string>()
  let depth = 0
  for (const line of source.slice(start).split('\n')) {
    const flag = depth === 1 ? /^\s*(enable[A-Za-z0-9]+)\??:/.exec(line)?.[1] : undefined
    if (flag) flags.add(flag)
    depth += (line.match(/\{/g)?.length ?? 0) - (line.match(/\}/g)?.length ?? 0)
    if (depth === 0) break
  }
  return flags
}

/** The `enable…` keys a host template reads from craft.config.json, declared or not. */
function hostReads(directory: string, pattern: RegExp): Set<string> {
  const flags = new Set<string>()
  for (const entry of readdirSync(join(craftRoot, directory), { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue
    for (const match of readFileSync(join(entry.parentPath, entry.name), 'utf8').matchAll(pattern)) flags.add(match[1]!)
  }
  return flags
}

const iosBuilder = await import('craft-native/ios') as { nativeSensorCapabilities?: readonly string[] }
const androidBuilder = await import('craft-native/android') as { nativeSensorCapabilities?: readonly string[] }
const platforms = [
  {
    platform: 'iOS',
    map: iosCapabilityKeys(iosBuilder.nativeSensorCapabilities) as Record<string, string>,
    unmapped: IOS_UNMAPPED_CRAFT_FLAGS,
    declared: declaredFlags('dist/ios/src/index.d.ts', 'CraftConfig'),
    read: hostReads('dist/ios/templates', /\bconfig\.(enable[A-Za-z0-9]+)\b/g),
    where: 'IOS_CAPABILITY_KEYS or IOS_UNMAPPED_CRAFT_FLAGS in src/build/ios-config.ts',
  },
  {
    platform: 'Android',
    map: androidCapabilityKeys(androidBuilder.nativeSensorCapabilities) as Record<string, string>,
    unmapped: ANDROID_UNMAPPED_CRAFT_FLAGS,
    declared: declaredFlags('dist/android/src/index.d.ts', 'CraftAndroidConfig'),
    read: hostReads('dist/android/templates', /config\.optBoolean\("(enable[A-Za-z0-9]+)"/g),
    where: 'ANDROID_CAPABILITY_KEYS or ANDROID_UNMAPPED_CRAFT_FLAGS in src/build/android-config.ts',
  },
]

describe(`the capability maps cover craft-native ${craftVersion}`, () => {
  for (const { platform, map, unmapped, declared, read, where } of platforms) {
    describe(platform, () => {
      it('reads a Craft surface at all', () => {
        expect(declared.size).toBeGreaterThan(10)
      })

      it('maps every enable flag Craft declares, or says why not', () => {
        const mapped = new Set(Object.values(map))
        const missing = [...declared].filter(flag => !mapped.has(flag) && !Object.hasOwn(unmapped, flag))
          .map(flag => `${platform}: craft-native ${craftVersion} declares ${flag}, which no capability sets. Add it to ${where}.`)
        expect(missing).toEqual([])
      })

      it('maps only to flags Craft still has', () => {
        const stale = Object.entries(map).filter(([, flag]) => !declared.has(flag) && !read.has(flag))
          .map(([capability, flag]) => `${platform}: capabilities.${capability} sets ${flag}, which craft-native ${craftVersion} neither declares nor reads.`)
        expect(stale).toEqual([])
      })

      it('lists as unmapped only Craft flags no capability sets', () => {
        const mapped = new Set(Object.values(map))
        const wrong = Object.entries(unmapped).filter(([flag, reason]) => !declared.has(flag) || mapped.has(flag) || !reason.trim())
          .map(([flag]) => `${platform}: ${flag} is listed as unmapped, but it is ${mapped.has(flag) ? 'mapped' : declared.has(flag) ? 'given no reason' : `not declared by craft-native ${craftVersion}`}.`)
        expect(wrong).toEqual([])
      })
    })
  }
})
