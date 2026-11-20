/**
 * The SecLang the in-process WAF compiles: a setup block generated from
 * `security.waf`, the app's rule files (typically an OWASP CRS checkout), and
 * the exclusions that have to follow them.
 *
 * zig-waf bundles no rules, so with no rule files there is nothing to detect.
 * That is refused rather than run, because a firewall that matches nothing
 * looks exactly like one that found nothing wrong.
 */

import type { WafRuleExclusion } from '@stacksjs/types'
import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'

export interface WafRuleSettings {
  paranoiaLevel?: number
  inboundThreshold?: number
  outboundThreshold?: number
  maxBodyBytes?: number
  bypassPaths?: string[]
  exclusions?: WafRuleExclusion[]
  /** SecLang files, in load order: CRS's `crs-setup.conf` then `rules/*.conf`, or your own. */
  rules?: string[]
  /**
   * Where `@pmFromFile` / `@ipMatchFromFile` data files are. Defaults to the
   * last rule file's directory: in a CRS checkout that is `rules/`, where the
   * `.data` files sit, while the first file (`crs-setup.conf`) is one level up.
   */
  dataDir?: string
  /**
   * HTTP methods CRS lets through (rule 911100). CRS's own default is
   * GET HEAD POST OPTIONS, which refuses every PUT, PATCH and DELETE, so a
   * Stacks API's update and destroy routes would be blocked.
   */
  allowedMethods?: string[]
}

/** The methods a Stacks API uses, on top of CRS's default. */
export const DEFAULT_ALLOWED_METHODS = ['GET', 'HEAD', 'POST', 'OPTIONS', 'PUT', 'PATCH', 'DELETE']

export interface RenderedRules {
  text: string
  /** Where `@pmFromFile` / `@ipMatchFromFile` data files resolve. */
  dataDir: string
  warnings: string[]
}

/** Ids for the generated rules, kept out of the CRS range (900000+), as ts-cloud does. */
const IDS = { setup: 99_000, bypass: 100_000, exclusion: 101_000 }

export function renderWafRules(settings: WafRuleSettings, read: (path: string) => string = path => readFileSync(path, 'utf8')): RenderedRules {
  const files = settings.rules ?? []
  if (files.length === 0)
    throw new Error('security.waf.rules names no rule files. zig-waf ships no rules, so the in-process WAF would match nothing. Point it at an OWASP CRS checkout (crs-setup.conf, then rules/*.conf) or your own SecLang files.')

  const warnings: string[] = []
  const lines: string[] = [
    'SecRuleEngine On',
    'SecRequestBodyAccess On',
    `SecAction "id:${IDS.setup},phase:1,pass,nolog,t:none,setvar:tx.blocking_paranoia_level=${settings.paranoiaLevel ?? 1},setvar:tx.paranoia_level=${settings.paranoiaLevel ?? 1}"`,
    `SecAction "id:${IDS.setup + 1},phase:1,pass,nolog,t:none,setvar:tx.inbound_anomaly_score_threshold=${settings.inboundThreshold ?? 5},setvar:tx.outbound_anomaly_score_threshold=${settings.outboundThreshold ?? 4}"`,
    // CRS sets allowed_methods only when nothing did before it (REQUEST-901),
    // so this, ahead of the rule files, is what rule 911100 checks against.
    `SecAction "id:${IDS.setup + 2},phase:1,pass,nolog,t:none,setvar:'tx.allowed_methods=${methods(settings.allowedMethods, warnings)}'"`,
  ]

  let bypassId = IDS.bypass
  for (const path of settings.bypassPaths ?? []) {
    lines.push(`SecRule REQUEST_FILENAME "@beginsWith ${escape(path)}" "id:${bypassId++},phase:1,pass,nolog,ctl:ruleEngine=Off"`)
  }

  // A path-scoped exclusion is a runtime ctl, so it has to run before the
  // rule it removes; an unscoped one is SecRuleRemoveById, which only removes
  // rules already defined, so it goes after the rule files.
  const removeAfter: number[] = []
  let exclusionId = IDS.exclusion
  for (const exclusion of settings.exclusions ?? []) {
    if (!Number.isInteger(exclusion.ruleId) || exclusion.ruleId <= 0) {
      warnings.push(`Exclusion for rule "${exclusion.ruleId}" was dropped: the id is not a positive integer.`)
      continue
    }
    if (exclusion.pathPattern)
      lines.push(`SecRule REQUEST_FILENAME "@rx ${escape(exclusion.pathPattern)}" "id:${exclusionId++},phase:1,pass,nolog,ctl:ruleRemoveById=${exclusion.ruleId}"`)
    else
      removeAfter.push(exclusion.ruleId)
  }

  for (const file of files)
    lines.push(`# ${file}`, read(file))

  for (const id of removeAfter)
    lines.push(`SecRuleRemoveById ${id}`)

  return { text: `${lines.join('\n')}\n`, dataDir: settings.dataDir ?? dirname(files.at(-1)!), warnings }
}

/** The allowed methods as one space-separated token list; a method that is not a token is dropped. */
function methods(configured: string[] | undefined, warnings: string[]): string {
  const valid = (configured ?? DEFAULT_ALLOWED_METHODS).filter((method) => {
    if (/^[A-Z]+$/.test(method))
      return true
    warnings.push(`Allowed method "${method}" was dropped: a method is upper-case letters only.`)
    return false
  })
  return valid.join(' ')
}

/** A value inside a double-quoted SecLang argument: no quote or newline may end it early. */
function escape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]/g, ' ')
}
