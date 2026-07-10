import type { ExtensionConfig, ExtensionTarget } from './types'
import { basename } from 'node:path'

/** MV3 manifest shape (loose — the two targets diverge on `background`). */
export interface GeneratedManifest {
  manifest_version: 3
  name: string
  description: string
  version: string
  minimum_chrome_version?: string
  action?: { default_title?: string, default_popup?: string }
  options_page?: string
  background?: { service_worker: string, type?: 'module' } | { scripts: string[], type?: 'module' }
  browser_specific_settings?: {
    gecko: {
      id: string
      strict_min_version: string
      data_collection_permissions: { required: ['none'] }
    }
  }
  permissions?: string[]
  optional_permissions?: string[]
  host_permissions?: string[]
  icons?: Record<string, string>
  content_scripts?: Array<{
    matches: string[]
    js: string[]
    css?: string[]
    run_at?: string
    world?: string
    all_frames?: boolean
    match_about_blank?: boolean
    exclude_matches?: string[]
  }>
  declarative_net_request?: { rule_resources: Array<{ id: string, enabled: boolean, path: string }> }
  content_security_policy?: { extension_pages: string }
  web_accessible_resources?: Array<{ resources: string[], matches: string[] }>
  [key: string]: unknown
}

/** Output filename for a content script (explicit `out`, else entry basename). */
export function contentScriptOut(entry: string, out?: string): string {
  return out ?? basename(entry).replace(/\.[cm]?tsx?$/, '.js')
}

/**
 * Generate an MV3 manifest for a target from the extension config. Chrome uses
 * a `service_worker` background + `minimum_chrome_version`; Firefox uses a
 * `scripts` event page + `browser_specific_settings.gecko` (required by AMO).
 */
export function generateManifest(config: ExtensionConfig, opts: { version: string, target?: ExtensionTarget }): GeneratedManifest {
  const target = opts.target ?? 'chrome'
  const isFirefox = target === 'firefox'
  const m = config.manifest ?? {}

  const manifest: GeneratedManifest = {
    manifest_version: 3,
    name: config.name,
    description: config.description,
    version: opts.version,
  }

  if (!isFirefox && m.minimumChromeVersion)
    manifest.minimum_chrome_version = m.minimumChromeVersion

  if (config.pages?.popup)
    manifest.action = { default_title: config.name, default_popup: 'popup.html' }
  if (config.pages?.options)
    manifest.options_page = 'options.html'

  if (config.background) {
    manifest.background = isFirefox
      ? { scripts: ['background.js'], type: 'module' }
      : { service_worker: 'background.js', type: 'module' }
  }

  if (isFirefox && config.geckoId) {
    manifest.browser_specific_settings = {
      gecko: {
        id: config.geckoId,
        strict_min_version: m.firefoxMinVersion ?? '128.0',
        // AMO requires a data-collection declaration for new add-ons.
        data_collection_permissions: { required: ['none'] },
      },
    }
  }

  if (m.permissions?.length)
    manifest.permissions = m.permissions
  if (m.optionalPermissions?.length)
    manifest.optional_permissions = m.optionalPermissions
  if (m.hostPermissions?.length)
    manifest.host_permissions = m.hostPermissions

  if (config.icons)
    manifest.icons = Object.fromEntries(Object.entries(config.icons).map(([size, path]) => [String(size), path]))

  if (config.content?.length) {
    manifest.content_scripts = config.content.map(cs => ({
      matches: cs.matches,
      js: [contentScriptOut(cs.entry, cs.out)],
      ...(cs.runAt ? { run_at: cs.runAt } : {}),
      ...(cs.world ? { world: cs.world } : {}),
      ...(cs.allFrames ? { all_frames: true } : {}),
      ...(cs.matchAboutBlank ? { match_about_blank: true } : {}),
      ...(cs.excludeMatches ? { exclude_matches: cs.excludeMatches } : {}),
    }))
  }

  if (config.rules?.length) {
    manifest.declarative_net_request = {
      rule_resources: config.rules.map(r => ({
        id: r.id,
        enabled: r.enabled ?? true,
        path: r.path ?? `rules/${r.id}.json`,
      })),
    }
  }

  manifest.content_security_policy = {
    extension_pages: m.contentSecurityPolicy ?? `script-src 'self'; object-src 'self'`,
  }

  if (m.webAccessibleResources?.length)
    manifest.web_accessible_resources = m.webAccessibleResources

  return { ...manifest, ...(m.extra ?? {}) }
}
