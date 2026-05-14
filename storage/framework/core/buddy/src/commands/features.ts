import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'

/**
 * Feature install / uninstall commands.
 *
 * Each framework feature bundle (dashboard, commerce, cms, marketing,
 * monitoring, realtime, queue) is opt-in. The default `config/features.ts`
 * has them all set to `false` for new apps — running `./buddy <feature>:install`
 * flips the flag to `true` and `./buddy <feature>:uninstall` flips it back.
 *
 * The framework loaders (`orm/index.ts` eager-load, `defaults/bootstrap.ts`
 * route registration, action prefetch) consult these flags at boot and
 * skip anything whose feature is off — so an app with only `core` and
 * `auth` activated never pays the cost of importing 70+ Commerce models
 * or registering hundreds of dashboard routes it doesn't use.
 *
 * Mirrors Laravel's `php artisan passport:install` / `horizon:install`
 * pattern: features are inert dead code on disk until installed.
 */

const FEATURE_NAMES = [
  'dashboard',
  'commerce',
  'cms',
  'marketing',
  'monitoring',
  'realtime',
  'queue',
] as const

type FeatureName = (typeof FEATURE_NAMES)[number]

const FEATURE_DESCRIPTIONS: Record<FeatureName, string> = {
  dashboard: 'Admin SPA shell + Activity/Log/Request/Deployment/Notification dashboards.',
  commerce: 'Order/Cart/Product/Customer/Coupon/GiftCard/Shipping + storefront API.',
  cms: 'Post/Page/Author/Comment/Tag models + content edit dashboards.',
  marketing: '/api/email/subscribe, /api/contact, Campaign/EmailList/SocialPost.',
  monitoring: 'Error model + error-tracking views and actions.',
  realtime: 'WebSocket broadcaster + Websocket model + realtime-stats actions.',
  queue: 'Job + FailedJob models + queue dashboard pages.',
}

/**
 * Flip `<feature>: <value>` inside the project's `config/features.ts`
 * (or add the line if absent). Preserves surrounding comments and the
 * `satisfies FeaturesConfig` suffix.
 */
async function setFeatureFlag(feature: FeatureName, enabled: boolean): Promise<'updated' | 'unchanged' | 'created'> {
  const path = projectPath('config/features.ts')
  const file = Bun.file(path)
  if (!(await file.exists())) {
    // Project hasn't created `config/features.ts` yet. Write a fresh one
    // with this single flag flipped — the framework defaults take care
    // of `core` and `auth` always being active.
    const initial = `import type { FeaturesConfig } from '@stacksjs/types'

export default {
  ${feature}: ${enabled},
} satisfies FeaturesConfig
`
    await Bun.write(path, initial)
    return 'created'
  }

  const src = await file.text()
  const lineRegex = new RegExp(`(^\\s*${feature}\\s*:\\s*)(true|false|\\{[^}]*\\})(\\s*,?)`, 'm')

  if (lineRegex.test(src)) {
    const next = src.replace(lineRegex, `$1${enabled}$3`)
    if (next === src) return 'unchanged'
    await Bun.write(path, next)
    return 'updated'
  }

  // Flag isn't in the file — insert it inside the `export default { ... }`
  // object literal. We anchor on the opening brace so we don't trip on
  // any other braces in the file (e.g. a satisfies-expression at the end).
  const insertRegex = /(export default\s*\{)/
  if (!insertRegex.test(src)) {
    // Bail loudly — the file's been edited into a shape we can't safely
    // mutate. The user can fix the flag by hand.
    throw new Error(`Could not locate \`export default {\` in ${path} — please add \`${feature}: ${enabled}\` manually.`)
  }
  const next = src.replace(insertRegex, `$1\n  ${feature}: ${enabled},`)
  await Bun.write(path, next)
  return 'updated'
}

function registerInstallPair(buddy: CLI, feature: FeatureName): void {
  const desc = FEATURE_DESCRIPTIONS[feature]

  buddy
    .command(`${feature}:install`, `Activate the ${feature} feature bundle. ${desc}`)
    .action(async () => {
      try {
        const outcome = await setFeatureFlag(feature, true)
        if (outcome === 'unchanged')
          log.info(`'${feature}' is already enabled in config/features.ts`)
        else
          log.success(`Enabled '${feature}' in config/features.ts${outcome === 'created' ? ' (created file)' : ''}`)
        log.info(`The next ./buddy dev will boot with ${feature} loaded.`)
        process.exit(ExitCode.Success)
      }
      catch (err) {
        log.error(`Failed to install ${feature}:`, err)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command(`${feature}:uninstall`, `Deactivate the ${feature} feature bundle.`)
    .action(async () => {
      try {
        const outcome = await setFeatureFlag(feature, false)
        if (outcome === 'unchanged')
          log.info(`'${feature}' is already disabled in config/features.ts`)
        else
          log.success(`Disabled '${feature}' in config/features.ts`)
        log.info(`The next ./buddy dev will boot without ${feature}.`)
        process.exit(ExitCode.Success)
      }
      catch (err) {
        log.error(`Failed to uninstall ${feature}:`, err)
        process.exit(ExitCode.FatalError)
      }
    })
}

export function features(buddy: CLI): void {
  for (const feature of FEATURE_NAMES)
    registerInstallPair(buddy, feature)
}
