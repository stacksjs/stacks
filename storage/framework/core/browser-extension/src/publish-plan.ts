/**
 * Which stores a release should publish to, and why it is skipping the rest.
 *
 * Publishing runs in CI off the release tag, the same way the framework
 * publishes to npm, so the credentials live in the CI secret store rather than
 * on anyone's laptop. That makes "some stores are set up and others are not"
 * the normal state of a project rather than a misconfiguration: a repo adopts
 * Chrome first, adds Firefox weeks later, and may never ship Safari.
 *
 * So the policy is *skip what is missing, fail on what breaks*:
 *
 *   • a target with no config block is not part of this project — skip
 *   • a target that is configured but has no credentials is not set up *yet* —
 *     skip, and say which variables would turn it on
 *   • a target that is configured and credentialed must succeed — the caller
 *     lets that failure fail the release
 *
 * The alternative policies both hurt: failing on an unconfigured target means
 * no extension project can release until all three stores are live, and
 * warning on a real upload failure means a release quietly does not reach
 * users. The decision is kept separate from the uploading so it can be tested
 * without touching a store API.
 */
import type { ExtensionConfig, ExtensionTarget } from './types'

/** Why a target is not being published. */
export type PublishSkipReason = 'not-configured' | 'missing-credentials'

export interface PublishDecision {
  target: ExtensionTarget
  /** Whether the release should publish this target. */
  publish: boolean
  /** Set when `publish` is false. */
  reason?: PublishSkipReason
  /**
   * Human-readable note for the release log: which config block is absent, or
   * which environment variables would enable the target.
   */
  detail?: string
}

/** The environment a plan is resolved against; `process.env` in practice. */
export type PublishEnv = Record<string, string | undefined>

/**
 * Credential requirements per target, as the publishers themselves read them.
 *
 * Each entry is a set of alternatives — Chrome takes either a service account
 * or a pre-minted token, AMO accepts either the modern or the legacy variable
 * names — and every entry in the list must be satisfied by at least one of its
 * alternatives.
 */
const credentialRequirements: Record<ExtensionTarget, string[][]> = {
  chrome: [['CHROME_WEB_STORE_SERVICE_ACCOUNT_PATH', 'CHROME_WEB_STORE_ACCESS_TOKEN', 'GOOGLE_APPLICATION_CREDENTIALS']],
  firefox: [
    ['AMO_JWT_ISSUER', 'WEB_EXT_API_KEY'],
    ['AMO_JWT_SECRET', 'WEB_EXT_API_SECRET'],
  ],
  safari: [
    ['APP_STORE_CONNECT_API_KEY_ID'],
    ['APP_STORE_CONNECT_API_ISSUER_ID'],
    ['APP_STORE_CONNECT_API_KEY_PATH'],
  ],
}

/** Whether the project declares this store at all. */
export function isTargetConfigured(config: ExtensionConfig, target: ExtensionTarget): boolean {
  if (target === 'chrome')
    return Boolean(config.chromeWebStore?.itemId)

  // A Firefox submission is addressed by the gecko id; without it AMO has no
  // add-on to update, whatever the listing config says.
  if (target === 'firefox')
    return Boolean(config.firefoxAddons && config.geckoId)

  return Boolean(config.safariBundleId && config.safariTeamId)
}

/** The credential variables a configured target still needs, if any. */
export function missingCredentials(target: ExtensionTarget, env: PublishEnv): string[] {
  return credentialRequirements[target]
    .filter(alternatives => !alternatives.some(name => (env[name] ?? '').trim() !== ''))
    // Report the first (preferred) name of each unsatisfied group rather than
    // every alias, so the log reads as a checklist instead of a truth table.
    .map(alternatives => alternatives[0]!)
}

/**
 * Decide what a release publishes. Targets are always returned in a stable
 * order, including the skipped ones, so the release log shows the whole
 * picture rather than only what happened to run.
 */
export function planExtensionPublish(
  config: ExtensionConfig,
  env: PublishEnv = process.env,
  targets: readonly ExtensionTarget[] = ['chrome', 'firefox', 'safari'],
): PublishDecision[] {
  return targets.map((target) => {
    if (!isTargetConfigured(config, target))
      return { target, publish: false, reason: 'not-configured', detail: `no ${configKeyFor(target)} in config/extension.ts` }

    const missing = missingCredentials(target, env)
    if (missing.length)
      return { target, publish: false, reason: 'missing-credentials', detail: `set ${missing.join(', ')}` }

    return { target, publish: true }
  })
}

/** The config field a project sets to declare a store. */
function configKeyFor(target: ExtensionTarget): string {
  if (target === 'chrome')
    return 'chromeWebStore.itemId'
  if (target === 'firefox')
    return 'firefoxAddons + geckoId'
  return 'safariBundleId + safariTeamId'
}

/** One line per target, for the release log. */
export function formatPublishPlan(decisions: readonly PublishDecision[]): string {
  return decisions
    .map((decision) => {
      if (decision.publish)
        return `  ${decision.target}: publishing`
      return `  ${decision.target}: skipped (${decision.detail ?? decision.reason})`
    })
    .join('\n')
}
