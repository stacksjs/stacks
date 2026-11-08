import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/** An explicitly selected runtime file never falls back to the default environment. */
export function explicitDeploymentEnvFile(root: string, file?: string): string | undefined {
  if (file === undefined) return undefined
  if (!file.trim() || /[\r\n\0]/.test(file)) throw new Error('--env-file must name one environment file')
  const path = resolve(root, file)
  if (!existsSync(path)) throw new Error(`The selected deployment environment file does not exist: ${file}`)
  return path
}

/** Explicit operator retirement keeps application names out of a shared host's config. */
export function deploymentRetirements<T extends { cloud?: any, sites?: Record<string, any> }>(config: T, input?: string): T {
  if (input === undefined) return config
  const domains = [...new Set(input.split(',').map(domain => domain.trim().toLowerCase()))]
  if (!domains.length || domains.some(domain => domain.length > 253 || domain.replace(/^\*\./, '').split('.').some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))))
    throw new Error('--retire-domains must contain comma-separated hostnames')
  const declared = Object.values(config.sites ?? {}).flatMap(site => [site.domain, ...(site.aliases ?? [])]).filter(Boolean).map(domain => String(domain).toLowerCase())
  if (domains.some(domain => declared.includes(domain)))
    throw new Error('A retired domain is still declared in sites. Remove its site first.')
  return { ...config, cloud: { ...config.cloud, retiredDomains: [...new Set([...(config.cloud?.retiredDomains ?? []), ...domains])] } }
}

/** Refuse provider paths that cannot preserve the selected runtime contract. */
export function validateDeploymentProviderInputs(provider: string, options: { envFile?: string, retireDomains?: string }): void {
  const ssh = provider === 'ssh' || provider === 'hetzner'
  if (options.envFile && !ssh && provider !== 'fly')
    throw new Error('--env-file requires an SSH, Hetzner or Fly deployment')
  if (options.retireDomains !== undefined && !ssh)
    throw new Error('--retire-domains requires an SSH or Hetzner gateway')
}
