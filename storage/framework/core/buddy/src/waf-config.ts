import type { SecurityConfig } from '@stacksjs/types'

/**
 * `security.waf` in the app's Stacks config, applied to the deploy target.
 *
 * Box deploys run zig-waf, configured by ts-cloud's `infrastructure.compute.waf`. Before this the
 * only way to configure it was to know about that field in `config/cloud.ts`; now the security
 * config drives it, and an explicit `compute.waf` in `config/cloud.ts` still wins field by field,
 * so nobody's existing setup changes under them.
 */

type WafSettings = NonNullable<NonNullable<SecurityConfig['waf']>>

export interface AppliedWaf {
  /** The ts-cloud config to deploy with (a copy; the input is not mutated). */
  config: any
  warnings: string[]
}

const COMPUTE_FIELDS = ['mode', 'paranoiaLevel', 'inboundThreshold', 'outboundThreshold', 'maxBodyBytes', 'bypassPaths', 'exclusions', 'forward'] as const

/** Options zig-waf understands that AWS WAF's managed rule groups have no equivalent for. */
const AWS_UNSUPPORTED = ['paranoiaLevel', 'inboundThreshold', 'outboundThreshold', 'maxBodyBytes', 'bypassPaths', 'exclusions', 'forward'] as const

export function applySecurityWaf(tsCloudConfig: any, waf: WafSettings | undefined, provider: string): AppliedWaf {
  const warnings: string[] = []
  if (!tsCloudConfig || !waf)
    return { config: tsCloudConfig, warnings }

  if (provider === 'aws') {
    const unsupported = AWS_UNSUPPORTED.filter(key => waf[key] !== undefined)
    if (unsupported.length > 0)
      warnings.push(`security.waf: AWS WAF has no equivalent for ${unsupported.join(', ')}; those settings apply to box deploys only.`)
    return { config: tsCloudConfig, warnings }
  }

  const config = structuredClone(tsCloudConfig)
  const compute = ((config.infrastructure ??= {}).compute ??= {})
  const explicit = compute.waf

  if (explicit === false) {
    warnings.push('security.waf is ignored: config/cloud.ts sets infrastructure.compute.waf to false.')
    return { config, warnings }
  }

  const fromSecurity: Record<string, unknown> = { mode: 'detection' }
  for (const key of COMPUTE_FIELDS) {
    if (waf[key] !== undefined)
      fromSecurity[key] = structuredClone(waf[key])
  }
  const overrides = explicit && typeof explicit === 'object' ? explicit : {}
  const overridden = Object.keys(overrides).filter(key => key in fromSecurity && JSON.stringify(overrides[key]) !== JSON.stringify(fromSecurity[key]))
  if (overridden.length > 0)
    warnings.push(`security.waf: config/cloud.ts infrastructure.compute.waf overrides ${overridden.join(', ')}.`)

  compute.waf = { ...fromSecurity, ...overrides }
  return { config, warnings }
}
