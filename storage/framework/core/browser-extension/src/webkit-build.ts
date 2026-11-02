import type { ExtensionConfig, RuleResource } from './types'
import type { DnrRule, WebKitConversionReport, WebKitCosmeticRule, WebKitRuleGroup } from './webkit'
import type { WebKitUserScript } from './webkit-scripts'
import { existsSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { bundleScript, loadModuleValue } from './bundle'
import { contentScriptOut } from './manifest'
import { buildWebKitLists } from './webkit'
import { WEBKIT_BRIDGE_VERSION, wrapForWebKit } from './webkit-scripts'

/** One compiled-list entry in `dist-webkit/manifest.json`. */
export interface WebKitManifestList {
  id: string
  version: string
  group: string
  kind: 'network' | 'cosmetic'
  enabled: boolean
  ruleCount: number
  /** Relative to the manifest: the JSON to hand `compileContentRuleList`. */
  file: string
}

/** One user-script entry in `dist-webkit/manifest.json`; the source lives in `file`. */
export interface WebKitManifestScript extends Omit<WebKitUserScript, 'source'> {
  file: string
  /** Whether the `chrome.runtime` / `chrome.storage` bridge is prepended. */
  bridged: boolean
  /** `chrome.*` uses found in the script, as `namespace.member`. */
  apis: string[]
  /** Uses the bridge does not provide (they fail at runtime). */
  unsupportedApis: string[]
}

/** `dist-webkit/manifest.json`. */
export interface WebKitManifest {
  format: 'stacks-webkit'
  formatVersion: 1
  name: string
  version: string
  maxRulesPerList: number
  /** The message handler bridged scripts post to, and the contract version they speak. */
  bridge: { messageHandler: string, version: number }
  lists: WebKitManifestList[]
  scripts: WebKitManifestScript[]
  report: WebKitConversionReport
}

/** `Very Good AdBlock` → `very-good-adblock`. */
export function webkitSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

/** The DNR rules a static ruleset holds: from its `source` module, else its prebuilt JSON under `public`. */
async function rulesetRules(rule: RuleResource, config: ExtensionConfig, cwd: string): Promise<DnrRule[]> {
  if (rule.source)
    return asArray<DnrRule>(await loadModuleValue(cwd, rule.source), rule.id)
  const file = resolve(cwd, config.public ?? 'public', rule.path ?? `rules/${rule.id}.json`)
  if (!existsSync(file))
    throw new Error(`[browser-extension] ruleset "${rule.id}" has no source module and no file at ${file}`)
  return asArray<DnrRule>(await Bun.file(file).json(), rule.id)
}

function asArray<T>(value: unknown, id: string): T[] {
  if (!Array.isArray(value))
    throw new Error(`[browser-extension] "${id}" did not produce an array of rules`)
  return value as T[]
}

/**
 * Build the `webkit` target into `outdir`:
 *
 * - `lists/<id>.json` - the static rulesets, `webkit.dynamicRules` and
 *   `webkit.cosmetic` as WebKit content-blocker lists (see `buildWebKitLists`)
 * - `scripts/<id>.js` - every content script as a standalone `WKUserScript`
 *   source, isolated-world ones bridged to `window.webkit.messageHandlers`
 * - `manifest.json` - the lists (id, content-hash version, group, file), the
 *   scripts (matches, run time, world, file) and the conversion report
 *
 * Rules WebKit cannot express are counted in `report.unsupported` and printed,
 * never dropped silently.
 */
export async function buildWebKit(config: ExtensionConfig, options: { outdir: string, cwd: string, version: string, minify?: boolean }): Promise<WebKitManifest> {
  const { outdir, cwd } = options
  const webkit = config.webkit ?? {}
  const maxRulesPerList = webkit.maxRulesPerList ?? 50_000
  const messageHandler = webkit.messageHandler ?? webkitSlug(config.name)

  await rm(outdir, { recursive: true, force: true })
  await mkdir(join(outdir, 'lists'), { recursive: true })
  await mkdir(join(outdir, 'scripts'), { recursive: true })

  // 1. Rule groups: static rulesets, then the dynamic and cosmetic sources.
  const groups: WebKitRuleGroup[] = []
  for (const rule of config.rules ?? [])
    groups.push({ id: rule.id, enabled: rule.enabled ?? true, dnr: await rulesetRules(rule, config, cwd) })
  for (const source of webkit.dynamicRules ?? [])
    groups.push({ id: source.id, enabled: source.enabled ?? true, dnr: asArray<DnrRule>(await loadModuleValue(cwd, source.source), source.id) })
  for (const source of webkit.cosmetic ?? [])
    groups.push({ id: source.id, enabled: source.enabled ?? true, cosmetic: asArray<WebKitCosmeticRule>(await loadModuleValue(cwd, source.source), source.id) })

  const { lists, report } = buildWebKitLists(groups, { maxRulesPerList, selectorsPerRule: webkit.selectorsPerRule })
  const manifestLists: WebKitManifestList[] = []
  for (const list of lists) {
    const file = `lists/${list.id}.json`
    // Compact: the app reads it as the string compileContentRuleList takes.
    await Bun.write(join(outdir, file), JSON.stringify(list.rules))
    manifestLists.push({ id: list.id, version: list.version, group: list.group, kind: list.kind, enabled: list.enabled, ruleCount: list.rules.length, file })
  }

  // 2. Content scripts as WKUserScript sources.
  const excluded = new Set(webkit.excludeScripts ?? [])
  const scripts: WebKitManifestScript[] = []
  for (const cs of config.content ?? []) {
    const id = contentScriptOut(cs.entry, cs.out).replace(/\.js$/, '')
    if (excluded.has(id))
      continue
    const world = cs.world === 'MAIN' ? 'page' : 'isolated'
    const wrapped = wrapForWebKit(await bundleScript(cs.entry, cwd, options.minify ?? true), { handler: messageHandler, world })
    const file = `scripts/${id}.js`
    await Bun.write(join(outdir, file), wrapped.source)
    scripts.push({
      id,
      matches: cs.matches,
      excludeMatches: cs.excludeMatches ?? [],
      runAt: cs.runAt === 'document_start' ? 'document-start' : 'document-end',
      allFrames: cs.allFrames ?? false,
      matchAboutBlank: cs.matchAboutBlank ?? false,
      world,
      file,
      bridged: wrapped.bridged,
      apis: wrapped.apis,
      unsupportedApis: wrapped.unsupportedApis,
    })
  }

  const manifest: WebKitManifest = {
    format: 'stacks-webkit',
    formatVersion: 1,
    name: config.name,
    version: options.version,
    maxRulesPerList,
    bridge: { messageHandler, version: WEBKIT_BRIDGE_VERSION },
    lists: manifestLists,
    scripts,
    report,
  }
  await Bun.write(join(outdir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

  logWebKitReport(manifest)
  return manifest
}

/** Say what was built and, loudly, what could not be. */
function logWebKitReport(manifest: WebKitManifest): void {
  const rules = manifest.lists.reduce((sum, list) => sum + list.ruleCount, 0)
  console.log(`[browser-extension] webkit: ${manifest.lists.length} list(s), ${rules} rule(s), ${manifest.scripts.length} script(s)`)
  for (const issue of manifest.report.unsupported)
    console.warn(`[browser-extension] webkit: ${issue.count} rule(s) left out - ${issue.reason} (e.g. ${issue.examples.slice(0, 3).join(', ')})`)
  for (const issue of manifest.report.approximated)
    console.warn(`[browser-extension] webkit: ${issue.count} rule(s) approximated - ${issue.reason}`)
  for (const script of manifest.scripts) {
    if (script.world === 'isolated' && script.unsupportedApis.length)
      console.warn(`[browser-extension] webkit: script ${script.id} calls ${script.unsupportedApis.join(', ')}, which the WebKit bridge does not provide`)
  }
}
