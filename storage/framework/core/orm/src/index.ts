// Force the module that binds `schema` to evaluate before any user model file
// runs `import { schema } from '@stacksjs/validation/runtime'`. Without this
// priming import, the auto-imports barrel triggers user models concurrently,
// and later models in the barrel see `schema` in TDZ (the validator hasn't
// reached its `export const schema = v` line yet because evaluation jumped
// into the user model graph first). Pulling it in here at the top of every
// `@stacksjs/orm` consumer's evaluation guarantees schema is bound first.
//
// The narrow entry primes the identical binding - it re-exports `schema` from
// the same `./schema` module the barrel does - without also evaluating
// `./validator`, which reaches path, strings, utils and error-handling for
// ~130 ms this import does not need. Every `@stacksjs/orm` consumer paid that,
// which made it the reason narrowing the server's injection alone saved
// nothing.
import '@stacksjs/validation/runtime'
import { isCompiledBinary } from '@stacksjs/path'

export * from './utils/prunable'
export type { PrunableOptions } from './utils/prunable'
export {
  collectEncryptedAttributes,
  decryptValue,
  encryptValue,
  isEncrypted,
} from './utils/encrypted'
// Audit trait public API: setAuditUser is the queue/cron escape hatch for
// attributing audit rows to a user when there's no current HTTP request.
export { setAuditUser, createAuditMethods } from './traits/audit'

// The polymorphic trait factories, alongside audit's. `define-model` already
// pulls these in, and they are the documented surface for the trait methods —
// there was no way to reach them except a subpath import that never resolved,
// since only the `@stacksjs/orm` barrel itself is aliased.
export { createCommentableMethods } from './traits/commentable'
export type { AddCommentOptions, NewComment } from './traits/commentable'
export { createTaggableMethods } from './traits/taggable'
export { createCategorizableMethods } from './traits/categorizable'
export { createLikeableMethods } from './traits/likeable'
// The billable instance surface: `isBillable(user)` narrows a record to it, so
// a caller holding `request.user()` can ask rather than cast.
export { BILLABLE_INSTANCE_METHODS, isBillable, SubscriptionNotOwnedError } from './traits/billable'
export type { BillableMethods } from './traits/billable'
export type { AuditHelpers } from './traits/audit'
// Re-export soft-delete option types so user code can `satisfies SoftDeleteOptions`.
export type { SoftDeleteOptions, SoftDeleteHelpers } from './traits/soft-deletes'
// Shared write-error classifiers (stacksjs/stacks#1957). Named exports only —
// `export *` would collide with the snakeCase helpers also exported from
// './auto-crud' via other barrels. `isUniqueViolation` is re-exported by
// `@stacksjs/auth`'s './rbac-store-bqb' for back-compat; `mapWriteError`
// powers the auto-CRUD store/update 409 mapping.
export { filterFillable, getWritableFields, isUniqueViolation, mapWriteError, toSnakeCaseKeys } from './auto-crud'

// Ready-made `ownership` resolvers for models whose owner is one hop away
// (stacksjs/stacks#2375).
export { customerOwnership, parentOwnership, selfOwnership, siteOwnership, teamMembershipOwnership } from './ownership'
export * from './batch-loader'
export * from './db'
export * from './subquery'
export * from './transaction'
export * from './locked-row'
export * from './row-token'
// Data-subject access, erasure and retention, plus the processing register,
// read off each model's `personal` attributes and `gdpr` trait
// (stacksjs/stacks#365).
export * from './gdpr'
export * from './model-types'
/*
 * The endpoints a `useApi` model publishes, derived from the model definition
 * at compile time so a typed client can call generated CRUD with no generation
 * step. Type-only; nothing here runs.
 */
export type * from './api-routes'
export * from './types'
export * from '@stacksjs/model-meta'
export * from './define-model'
export * from './extend-model'
// Codegen for `database/types.d.ts` — augments
// `@stacksjs/database`'s `DatabaseSchema` so `db.selectFrom(...)` gets
// table-name autocomplete (stacksjs/stacks#1923).
export { buildDatabaseSchema, renderDatabaseTypeFile } from './generate-database-schema'
export type { GenerateSchemaOptions, GenerateSchemaResult } from './generate-database-schema'
// Canonical paginator shapes + adapters (stacksjs/stacks#1905 P1).
export {
  isCursorPaginator,
  isPaginator,
  isSimplePaginator,
  toCursorPaginator,
  toPaginator,
  toSimplePaginator,
} from '@stacksjs/pagination'
export type { CursorPaginator, Paginator, SimplePaginator } from '@stacksjs/pagination'
// Request-aware pagination helpers (stacksjs/stacks#1906 P2 + #1907 P3).
export {
  enrichPaginatorUrls,
  parseCursor,
  resolveCursorArgs,
  resolvePageArgs,
} from './paginator-request'
export type { ResolvedPageArgs } from './paginator-request'

// The model database is configured by `@stacksjs/database/runtime`, which
// `./db` and `./define-model` import above: it resolves the connection from
// config/database.ts and hands it to the query builder without opening it, and
// the model executor opens it on first use. This file used to set it a second
// time from `DB_*` alone, after that, which could only ever disagree: a path
// named in config/database.ts lost to `database/stacks.sqlite`.
// See ./project-query-builder-config.
import type { StacksFeature } from '@stacksjs/config'

// `@stacksjs/auth` (and other framework packages) statically imports
// `User from '@stacksjs/orm'`, so we have to provide it here. Loading via
// `await import` instead of `export *` keeps the rest of the model graph
// out of orm's evaluation graph — only User is pulled in, and only after
// orm has finished its own static-import phase. The await pauses orm's
// module evaluation just long enough to bind User without re-introducing
// the auto-imports → schema-TDZ cycle that re-exporting the whole barrel
// would cause.
//
// `loadUserlandModel` resolves the project root using `@stacksjs/path`,
// not a relative `../../../../../` path. The relative depth differs
// between the two layouts this package can run from:
//   - workspace: `storage/framework/core/orm/src/index.ts` → 5 ups
//   - installed: `node_modules/@stacksjs/orm/src/index.ts` → 4 ups
// projectPath() handles both because it walks up looking for the project
// root (package.json with no parent), so the same code works regardless.
/**
 * `(await import(path)).default`, resilient to a temporal-dead-zone read.
 *
 * A framework-default model statically imports `{ defineModel }` from this
 * module, so importing one during the deferred warmup forms a cycle. If the
 * model is still mid-evaluation when we read `.default`, the getter throws
 * `ReferenceError: Cannot access 'default' before initialization`. Yielding a
 * macrotask lets the in-flight evaluation settle; the module is already cached,
 * so re-reading doesn't re-import. Bounded retries avoid any spin.
 */
async function importDefault(modulePath: string): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    const mod = await import(modulePath)
    try {
      return mod.default
    }
    catch (err) {
      if (attempt < 5 && err instanceof ReferenceError && /before initialization/.test(err.message)) {
        await new Promise(resolve => setTimeout(resolve, 0))
        continue
      }
      throw err
    }
  }
}

/**
 * Said once, not once per model: 36 identical lines is how a warning stops
 * being read, and the count tracks the enabled features rather than anything
 * the reader did.
 */
let announcedCompiledSkip = false

async function loadUserlandModel(modelName: string, subdirs: string[] = ['']): Promise<any> {
  // A compiled binary has no model files to find, and the ones it would find
  // are not its own (stacksjs/stacks#2886).
  //
  // The probe below resolves the project root by walking up from the CWD, so a
  // compiled desktop binary launched from a directory that happens to be a
  // Stacks project located THAT project's
  // `storage/framework/defaults/app/Models/*.ts`, tried to import them, and
  // failed on `Cannot find module '@stacksjs/orm'` once per model. Launched
  // from anywhere else it found nothing and was silent. Same binary, same
  // arguments, 36 warnings or none depending on where you stood.
  //
  // Skipping rather than quietening it, because the probe cannot succeed here
  // even in principle: a `.ts` file loaded off disk by a dynamic import
  // resolves its own imports from disk, so either `@stacksjs/orm` is absent
  // (the reported failure) or it is present and the model binds against a
  // SECOND copy of the ORM rather than the bundled one - a split-brain worse
  // than the failure. Models a compiled app actually uses are bundled by the
  // static import graph and never come through here.
  if (isCompiledBinary()) {
    if (!announcedCompiledSkip) {
      announcedCompiledSkip = true
      console.debug('[orm] running from a compiled binary, so framework default models are not probed on disk; models this app uses are bundled.')
    }
    return null
  }

  const { path } = await import('@stacksjs/path')
  // 1) User override at app/Models/<Name>.ts (always wins, no subdir search
  //    on the user side — projects flatten their model directory).
  const userPath = path.userModelsPath(`${modelName}.ts`)
  try {
    if (await Bun.file(userPath).exists()) {
      return await importDefault(userPath)
    }
  }
  catch (err) {
    // Pre-fix this was a bare `catch {}` — a typo'd user model silently
    // fell through to the framework default, so the dev's customizations
    // appeared to "not be applied" with no log line indicating why.
    // Surface the actual import error so they can fix it.
    console.error(`[orm] Failed to import userland model ${modelName} from ${userPath} - falling back to framework default. Reason:`, err)
  }
  // 2) Framework default at storage/framework/defaults/app/Models/<Name>.ts
  //    Defaults are organised in subdirectories (commerce/, Content/,
  //    realtime/) so each model is searched in the relevant subdir first
  //    then the root — `subdirs` is the priority list of folders to try.
  for (const sub of subdirs) {
    const prefix = sub ? `${sub}/` : ''
    const defaultPath = path.frameworkPath(`defaults/app/Models/${prefix}${modelName}.ts`)
    try {
      if (await Bun.file(defaultPath).exists()) {
        return await importDefault(defaultPath)
      }
    }
    catch (err) {
      // Same fix as above for the framework-default branch — a broken
      // default shouldn't be invisible.
      console.error(`[orm] Failed to import framework default model ${modelName} from ${defaultPath} - trying next subdir. Reason:`, err)
    }
  }
  return null
}

// =============================================================================
// Lazy model exports.
//
// The eager `export const User = await loadUserlandModel('User')` pattern that
// used to live here deadlocked on the ESM cycle between this module and the
// user's model files: `app/Models/User.ts` statically imports `{ defineModel }`
// from `@stacksjs/orm` (this file), and Bun's dynamic `await import(userPath)`
// from inside orm's evaluation waits for User.ts to finish — which can't,
// because it's transitively waiting on orm to finish.
//
// Pre-fix this only "worked" because the trait files threw TDZ during User.ts
// evaluation, breaking the cycle by failing fast. Once the trait TDZ was fixed
// the cycle had to actually resolve, and it couldn't.
//
// New pattern: schedule the model loads as a microtask that runs AFTER orm's
// own static-import graph finishes. By the time the microtask fires, all
// participating modules (database, validation, define-model, the traits) are
// fully bound, and the dynamic `await import(userPath)` no longer cycles back
// into a half-loaded module. Each export is a Proxy that forwards to the
// loaded model once available; per-request code (HTTP actions, jobs) is
// always called long after the microtask queue has drained, so `User.where(...)`
// at request time works transparently. Code that touches the exports at
// MODULE LOAD time (e.g. a top-level `const adminCount = await User.count()`
// in someone's startup script) should `await ormReady` first.
// =============================================================================

const _loaded: Record<string, any> = {}

/**
 * Whether the deferred model load has finished.
 *
 * Before it has, a missing entry in `_loaded` means "not yet", and the proxy
 * below keeps answering `undefined` as it always did. After it has, a missing
 * entry means the model is genuinely unavailable in this process, and saying
 * so is worth a throw: the alternative is what shipped, where every property
 * came back `undefined` and the first call failed as
 * `Manufacturer.orderByDesc is not a function` several frames away from the
 * actual cause. That cost a real debugging session on the dashboard, where
 * commerce pages 503'd with that TypeError because `config/commerce.ts` had
 * `enabled: false`. See stacksjs/stacks#2928.
 */
let _modelsSettled = false

/**
 * The methods that mean "use this model now", and so are worth a real error
 * rather than `undefined`.
 *
 * Deliberately a narrow allowlist rather than "everything except a few": an
 * unavailable model answering `undefined` is a load-bearing contract
 * elsewhere, and two existing tests depend on it. `Referral.getDefinition?.()`
 * is how feature availability is detected, and `Post`'s eager-load path reads
 * off a gated commerce `Category` and expects nothing back. Throwing on every
 * property broke both. Reading a property stays silent; trying to query does
 * not.
 */
const QUERY_ENTRYPOINTS = new Set([
  'where', 'orWhere', 'whereIn', 'whereNotIn', 'whereNull', 'whereNotNull',
  'whereLike', 'whereBetween', 'whereNotBetween', 'orderBy', 'orderByDesc',
  'latest', 'oldest', 'limit', 'take', 'skip', 'select',
  'find', 'findOrFail', 'findMany', 'first', 'firstOrFail', 'all', 'get', 'paginate',
  'count', 'sum', 'avg', 'min', 'max',
  'create', 'createMany', 'firstOrCreate', 'updateOrCreate', 'save',
  'update', 'updateMany', 'delete', 'destroy', 'remove', 'truncate',
])

/** Which feature flag, if any, decides whether this model loads. */
function featureGateFor(name: string): string | undefined {
  return FRAMEWORK_MODEL_MANIFEST.find(([model]) => model === name)?.[2]
}

/**
 * The feature a framework model belongs to, or undefined for a name the
 * framework does not ship. A model whose feature is off is never loaded, so a
 * surface that lists models (the dashboard sidebar) leaves it out rather than
 * linking a page that can only answer "No ORM model named ...".
 */
export function frameworkModelFeature(name: string): StacksFeature | undefined {
  return FRAMEWORK_MODEL_MANIFEST.find(([model]) => model === name)?.[2]
}

/**
 * The error a call on an unavailable model raises, instead of `undefined`.
 *
 * Its own class, so a caller can tell "this feature is off" from a database
 * that failed: the dashboard answered both with the same 503 (stacksjs/stacks#3184).
 * `name` is the check across module instances, where `instanceof` can miss.
 */
export class ModelUnavailableError extends Error {
  override readonly name = 'ModelUnavailableError'

  constructor(readonly model: string, readonly feature: string | undefined) {
    super(`Model "${model}" is not available in this process. ${feature
      ? `The '${feature}' feature is off, so this model was never loaded - set \`enabled: true\` in config/${feature}.ts to use it.`
      : `No model file for it was found under app/Models or the framework defaults.`}`)
  }
}

function unavailableModel(name: string): ModelUnavailableError {
  return new ModelUnavailableError(name, featureGateFor(name))
}

let _readyResolve: () => void = () => {}
/**
 * Resolves once all framework-default models have been loaded into the
 * lazy-export proxies. Server bootstrap code that wants to ensure model
 * exports are populated before serving the first request should
 * `await ormReady` early. Per-request code doesn't need to — by the
 * time any HTTP handler runs, the microtask queue has long drained.
 */
export const ormReady: Promise<void> = new Promise<void>((resolve) => { _readyResolve = resolve })

/**
 * Returns a Proxy that lazily forwards every property access to the
 * loaded model in `_loaded[name]`. Returns `undefined` before the
 * deferred load completes — callers that need the load to finish
 * first should `await ormReady`.
 */
function lazyModel<T>(name: string): T {
  // The Proxy target is a function so the proxy itself is callable
  // (in case any consumer treats a model as a constructor).
  return new Proxy(function _modelStub() {}, {
    get(_target, prop) {
      // Thenable guard — without it, `await User` would call
      // `User.then`, which we'd forward to the underlying (often
      // function-like bun-query-builder) value, causing JS to treat
      // this Proxy as a Promise and infinite-loop on resolution.
      if (prop === 'then')
        return undefined
      const m = _loaded[name]
      if (m == null) {
        if (_modelsSettled && typeof prop === 'string' && QUERY_ENTRYPOINTS.has(prop))
          throw unavailableModel(name)
        return undefined
      }
      const value = (m)[prop]
      // Bind methods to the underlying model so `this` is correct
      // when the Proxy is the receiver.
      return typeof value === 'function' ? value.bind(m) : value
    },
    set(_target, prop, value) {
      const m = _loaded[name]
      if (m == null)
        return false
      ;(m)[prop] = value
      return true
    },
    has(_target, prop) {
      const m = _loaded[name]
      return m == null ? false : prop in (m)
    },
    apply(_target, thisArg, args) {
      const m = _loaded[name]
      if (m == null || typeof m !== 'function')
        return undefined
      return (m as Function).apply(thisArg, args)
    },
  }) as T
}

// Public model contracts must survive isolated declaration emission. Keep the
// definition type explicit; the build rewrites it to the packaged model copy.
export const User: typeof import('../../../defaults/app/Models/User').default = lazyModel('User')

// Queue framework models. The CLI commands `buddy queue:status`,
// `queue:failed`, `queue:flush`, `queue:inspect`, `queue:monitor`,
// `queue:clear` import them as `import { Job, FailedJob } from
// '@stacksjs/orm'`. Prefer the userland publication
// (`app/Models/Job.ts`, dropped in by `buddy publish:model Job`) so
// projects that customize the queue model see their version.
//
// Gated on the 'queue' feature flag — projects that don't run a queue
// (most marketing sites, plain CMS apps) leave it off and skip the
// defineModel pipeline for these two entirely. The lazyModel proxy
// returns `undefined` for unloaded models, and the CLI queue commands
// can check `await ormReady; if (!Job) throw …` to surface a clear
// "run ./buddy queue:install" error.
export const Job: typeof import('../../../defaults/app/Models/Job').default = lazyModel('Job')
export const QueueWorker: typeof import('../../../defaults/app/Models/QueueWorker').default = lazyModel('QueueWorker')
export const FailedJob: typeof import('../../../defaults/app/Models/FailedJob').default = lazyModel('FailedJob')

// ---------------------------------------------------------------------------
// Auto-load every other framework model. Each row is `[name, subdirs, feature]`:
//   - `name`     : the model class, used as the file basename and the export
//   - `subdirs`  : where to look under `storage/framework/defaults/app/Models/`
//   - `feature`  : which feature bundle owns this model — only loaded when
//                  that bundle's `config/<feature>.ts` has `enabled: true`.
//                  Apps that haven't run `./buddy commerce:install` skip
//                  every entry tagged 'commerce' entirely (no migrations
//                  needed, no defineModel pipeline, no boot cost).
//
// The root namespace is searched first (so a flattened user override wins),
// then the subdir for the framework default. Loaded sequentially so the
// schema-TDZ cycle the original `User`-only export was guarding against
// stays neutralised.
// ---------------------------------------------------------------------------
const FRAMEWORK_MODEL_MANIFEST: Array<[name: string, subdirs: string[], feature: StacksFeature]> = [
  // Queue telemetry follows the normal feature-owned model convention.
  ['QueueWorker', [''], 'queue'],

  // Auth
  ['Referral', [''], 'auth'],
  ['ReferralCode', [''], 'auth'],
  ['Team', [''], 'auth'],
  ['TeamInvitation', [''], 'auth'],
  ['TeamMember', [''], 'auth'],
  ['SocialAccount', [''], 'auth'],
  ['Subscriber', [''], 'auth'],
  ['SubscriberEmail', [''], 'auth'],
  ['Subscription', [''], 'auth'],

  // CMS (Content subdir on disk uses the capital C)
  ['Categorizable', ['Content'], 'cms'],
  ['Post', ['Content'], 'cms'],
  ['Page', ['Content'], 'cms'],
  ['PageRevision', ['Content'], 'cms'],
  ['Redirect', ['Content'], 'cms'],
  ['Menu', ['Content'], 'cms'],
  ['MenuItem', ['Content'], 'cms'],
  ['Author', ['Content'], 'cms'],
  ['Comment', [''], 'cms'],
  ['Tag', [''], 'cms'],

  // Multi-site tenancy + passwordless auth + SMS compliance: always-on
  // platform models (no feature gate beyond their configs being off).
  ['Site', [''], 'auth'],
  ['SiteDomain', [''], 'auth'],
  ['MagicLinkToken', [''], 'auth'],
  ['SmsOptOut', [''], 'auth'],
  // The ledger of GDPR access, erasure and retention runs (stacksjs/stacks#365).
  ['GdprRequest', [''], 'auth'],

  // Form builder
  ['Form', ['Forms'], 'forms'],
  ['FormField', ['Forms'], 'forms'],
  ['FormSubmission', ['Forms'], 'forms'],

  // Dashboard (admin SPA + monitoring dashboards)
  ['Activity', [''], 'dashboard'],
  ['Board', [''], 'dashboard'],
  ['BoardColumn', [''], 'dashboard'],
  ['Card', [''], 'dashboard'],
  ['CardAttachment', [''], 'dashboard'],
  ['CardComment', [''], 'dashboard'],
  ['Deployment', [''], 'dashboard'],
  ['FeedbackToken', [''], 'dashboard'],
  ['Label', [''], 'dashboard'],
  ['Release', [''], 'dashboard'],
  ['Notification', [''], 'dashboard'],
  ['NotificationDelivery', [''], 'dashboard'],
  ['PersonalAccessToken', [''], 'dashboard'],
  ['MailPreference', [''], 'dashboard'],
  ['Log', [''], 'dashboard'],
  ['Request', [''], 'dashboard'],
  ['AnalyticsEvent', [''], 'dashboard'],
  ['QueryLog', [''], 'dashboard'],
  // The file manager's metadata layer: what a disk cannot record about a file
  // (stacksjs/stacks#2577), and the background work queued for it (#2578).
  ['StorageItem', [''], 'dashboard'],
  ['StorageItemTask', [''], 'dashboard'],

  // Monitoring (Error model can be used standalone without the rest of dashboard)
  ['Error', [''], 'monitoring'],

  // Realtime (websocket broadcaster)
  ['Websocket', ['realtime'], 'realtime'],

  // Marketing (email lists, campaigns, social posts)
  ['Campaign', [''], 'marketing'],
  ['CampaignSend', [''], 'marketing'],
  ['EmailList', [''], 'marketing'],
  ['EmailListSubscriber', [''], 'marketing'],
  ['EmailIdempotency', [''], 'marketing'],
  ['EmailSuppression', [''], 'marketing'],
  ['EmailWebhookEvent', [''], 'marketing'],
  ['SocialPost', [''], 'marketing'],
  // Multi-channel delivery primitives (automations, variants, consent,
  // sender domains, cross-channel suppression, usage metering)
  ['Automation', [''], 'marketing'],
  ['AutomationRun', [''], 'marketing'],
  ['CampaignVariant', [''], 'marketing'],
  ['CommunicationSuppression', [''], 'marketing'],
  ['ConsentEvent', [''], 'marketing'],
  ['SenderDomain', [''], 'marketing'],
  ['UsageEvent', [''], 'marketing'],

  // Payments (top-level — used by commerce checkout and by standalone billing)
  ['PaymentMethod', [''], 'commerce'],
  ['PaymentProduct', [''], 'commerce'],
  ['PaymentTransaction', [''], 'commerce'],

  // Commerce
  ['Order', ['commerce'], 'commerce'],
  ['OrderIdempotency', ['commerce'], 'commerce'],
  ['OrderItem', ['commerce'], 'commerce'],
  ['Cart', ['commerce'], 'commerce'],
  ['CartItem', ['commerce'], 'commerce'],
  ['Customer', ['commerce'], 'commerce'],
  ['Product', ['commerce'], 'commerce'],
  ['ProductVariant', ['commerce'], 'commerce'],
  ['ProductUnit', ['commerce'], 'commerce'],
  ['Manufacturer', ['commerce'], 'commerce'],
  ['Category', ['commerce'], 'commerce'],
  ['Coupon', ['commerce'], 'commerce'],
  ['GiftCard', ['commerce'], 'commerce'],
  ['LicenseKey', ['commerce'], 'commerce'],
  ['Review', ['commerce'], 'commerce'],
  ['Receipt', ['commerce'], 'commerce'],
  ['PrintDevice', ['commerce'], 'commerce'],
  ['ShippingMethod', ['commerce'], 'commerce'],
  ['ShippingRate', ['commerce'], 'commerce'],
  ['ShippingZone', ['commerce'], 'commerce'],
  ['DeliveryRoute', ['commerce'], 'commerce'],
  ['DeliveryStop', ['commerce'], 'commerce'],
  ['DigitalDelivery', ['commerce'], 'commerce'],
  ['Courier', ['commerce'], 'commerce'],
  ['CourierPing', ['commerce'], 'commerce'],
  ['TaxRate', ['commerce'], 'commerce'],
  ['WaitlistProduct', ['commerce'], 'commerce'],
  ['WaitlistRestaurant', ['commerce'], 'commerce'],
  ['Auction', ['commerce'], 'commerce'],
  ['AuctionItem', ['commerce'], 'commerce'],
  ['Bid', ['commerce'], 'commerce'],
  ['Pledge', ['commerce'], 'commerce'],
  ['LoyaltyPoint', ['commerce'], 'commerce'],
  ['LoyaltyReward', ['commerce'], 'commerce'],
  ['Payment', ['commerce'], 'commerce'],
  ['PaymentWebhookEvent', ['commerce'], 'commerce'],
  ['Transaction', ['commerce'], 'commerce'],
]

// Schedule deferred loads. The microtask runs AFTER orm's own static-import
// graph finishes — by which point @stacksjs/config (where `feature()` lives)
// AND every user model file's static `import { defineModel } from
// '@stacksjs/orm'` have resolved cleanly. No cycle deadlock, no TDZ flood,
// no eager-pre-init pipeline.
queueMicrotask(async () => {
  try {
    const { feature } = await import('@stacksjs/config')

    // User always loads (gated on 'core' which is implicitly true). Done
    // first because so many framework packages statically import User.
    const userModel = await loadUserlandModel('User')
    if (userModel) _loaded.User = userModel

    if (feature('queue')) {
      const job = await loadUserlandModel('Job')
      if (job) _loaded.Job = job
      const failedJob = await loadUserlandModel('FailedJob')
      if (failedJob) _loaded.FailedJob = failedJob
    }

    for (const [name, subdirs, featureFlag] of FRAMEWORK_MODEL_MANIFEST) {
      if (!feature(featureFlag)) continue
      // eslint-disable-next-line no-await-in-loop
      const M = await loadUserlandModel(name, subdirs)
      if (M) _loaded[name] = M
    }
  }
  catch (err) {
    // A failed deferred load shouldn't hang `ormReady` forever — surface
    // the error and resolve anyway so any waiters proceed and can report
    // the missing model in their own context.
    console.error('[orm] deferred model load failed:', err)
  }
  finally {
    _modelsSettled = true
    _readyResolve()
  }
})

export const Activity: typeof import('../../../defaults/app/Models/Activity').default = lazyModel('Activity')
export const AnalyticsEvent: typeof import('../../../defaults/app/Models/AnalyticsEvent').default = lazyModel('AnalyticsEvent')
export const Automation: typeof import('../../../defaults/app/Models/Automation').default = lazyModel('Automation')
export const AutomationRun: typeof import('../../../defaults/app/Models/AutomationRun').default = lazyModel('AutomationRun')
export const Auction: typeof import('../../../defaults/app/Models/commerce/Auction').default = lazyModel('Auction')
export const CampaignVariant: typeof import('../../../defaults/app/Models/CampaignVariant').default = lazyModel('CampaignVariant')
export const CommunicationSuppression: typeof import('../../../defaults/app/Models/CommunicationSuppression').default = lazyModel('CommunicationSuppression')
export const ConsentEvent: typeof import('../../../defaults/app/Models/ConsentEvent').default = lazyModel('ConsentEvent')
export const SenderDomain: typeof import('../../../defaults/app/Models/SenderDomain').default = lazyModel('SenderDomain')
export const UsageEvent: typeof import('../../../defaults/app/Models/UsageEvent').default = lazyModel('UsageEvent')
export const AuctionItem: typeof import('../../../defaults/app/Models/commerce/AuctionItem').default = lazyModel('AuctionItem')
export const Author: typeof import('../../../defaults/app/Models/Content/Author').default = lazyModel('Author')
export const Bid: typeof import('../../../defaults/app/Models/commerce/Bid').default = lazyModel('Bid')
export const Board: typeof import('../../../defaults/app/Models/Board').default = lazyModel('Board')
export const BoardColumn: typeof import('../../../defaults/app/Models/BoardColumn').default = lazyModel('BoardColumn')
export const Campaign: typeof import('../../../defaults/app/Models/Campaign').default = lazyModel('Campaign')
export const Card: typeof import('../../../defaults/app/Models/Card').default = lazyModel('Card')
export const CardAttachment: typeof import('../../../defaults/app/Models/CardAttachment').default = lazyModel('CardAttachment')
export const CardComment: typeof import('../../../defaults/app/Models/CardComment').default = lazyModel('CardComment')
export const Cart: typeof import('../../../defaults/app/Models/commerce/Cart').default = lazyModel('Cart')
export const CartItem: typeof import('../../../defaults/app/Models/commerce/CartItem').default = lazyModel('CartItem')
export const Category: typeof import('../../../defaults/app/Models/commerce/Category').default = lazyModel('Category')
export const Comment: typeof import('../../../defaults/app/Models/Comment').default = lazyModel('Comment')
export const Coupon: typeof import('../../../defaults/app/Models/commerce/Coupon').default = lazyModel('Coupon')
export const Customer: typeof import('../../../defaults/app/Models/commerce/Customer').default = lazyModel('Customer')
export const DeliveryRoute: typeof import('../../../defaults/app/Models/commerce/DeliveryRoute').default = lazyModel('DeliveryRoute')
export const DeliveryStop: typeof import('../../../defaults/app/Models/commerce/DeliveryStop').default = lazyModel('DeliveryStop')
export const Deployment: typeof import('../../../defaults/app/Models/Deployment').default = lazyModel('Deployment')
export const FeedbackToken: typeof import('../../../defaults/app/Models/FeedbackToken').default = lazyModel('FeedbackToken')
export const DigitalDelivery: typeof import('../../../defaults/app/Models/commerce/DigitalDelivery').default = lazyModel('DigitalDelivery')
export const Courier: typeof import('../../../defaults/app/Models/commerce/Courier').default = lazyModel('Courier')
export const CourierPing: typeof import('../../../defaults/app/Models/commerce/CourierPing').default = lazyModel('CourierPing')
export const CampaignSend: typeof import('../../../defaults/app/Models/CampaignSend').default = lazyModel('CampaignSend')
export const EmailList: typeof import('../../../defaults/app/Models/EmailList').default = lazyModel('EmailList')
export const EmailListSubscriber: typeof import('../../../defaults/app/Models/EmailListSubscriber').default = lazyModel('EmailListSubscriber')
export const Form: typeof import('../../../defaults/app/Models/Forms/Form').default = lazyModel('Form')
export const FormField: typeof import('../../../defaults/app/Models/Forms/FormField').default = lazyModel('FormField')
export const FormSubmission: typeof import('../../../defaults/app/Models/Forms/FormSubmission').default = lazyModel('FormSubmission')
export const MagicLinkToken: typeof import('../../../defaults/app/Models/MagicLinkToken').default = lazyModel('MagicLinkToken')
export const Menu: typeof import('../../../defaults/app/Models/Content/Menu').default = lazyModel('Menu')
export const MenuItem: typeof import('../../../defaults/app/Models/Content/MenuItem').default = lazyModel('MenuItem')
export const PageRevision: typeof import('../../../defaults/app/Models/Content/PageRevision').default = lazyModel('PageRevision')
export const Pledge: typeof import('../../../defaults/app/Models/commerce/Pledge').default = lazyModel('Pledge')
export const Redirect: typeof import('../../../defaults/app/Models/Content/Redirect').default = lazyModel('Redirect')
export const Site: typeof import('../../../defaults/app/Models/Site').default = lazyModel('Site')
export const SiteDomain: typeof import('../../../defaults/app/Models/SiteDomain').default = lazyModel('SiteDomain')
export const SmsOptOut: typeof import('../../../defaults/app/Models/SmsOptOut').default = lazyModel('SmsOptOut')
export const GdprRequest: typeof import('../../../defaults/app/Models/GdprRequest').default = lazyModel('GdprRequest')
export const StorageItem: typeof import('../../../defaults/app/Models/StorageItem').default = lazyModel('StorageItem')
export const StorageItemTask: typeof import('../../../defaults/app/Models/StorageItemTask').default = lazyModel('StorageItemTask')
export const EmailIdempotency: typeof import('../../../defaults/app/Models/EmailIdempotency').default = lazyModel('EmailIdempotency')
export const EmailSuppression: typeof import('../../../defaults/app/Models/EmailSuppression').default = lazyModel('EmailSuppression')
export const EmailWebhookEvent: typeof import('../../../defaults/app/Models/EmailWebhookEvent').default = lazyModel('EmailWebhookEvent')
export const ErrorModel: typeof import('../../../defaults/app/Models/Error').default = lazyModel('Error')
export const GiftCard: typeof import('../../../defaults/app/Models/commerce/GiftCard').default = lazyModel('GiftCard')
export const Label: typeof import('../../../defaults/app/Models/Label').default = lazyModel('Label')
export const LicenseKey: typeof import('../../../defaults/app/Models/commerce/LicenseKey').default = lazyModel('LicenseKey')
export const Log: typeof import('../../../defaults/app/Models/Log').default = lazyModel('Log')
export const LoyaltyPoint: typeof import('../../../defaults/app/Models/commerce/LoyaltyPoint').default = lazyModel('LoyaltyPoint')
export const LoyaltyReward: typeof import('../../../defaults/app/Models/commerce/LoyaltyReward').default = lazyModel('LoyaltyReward')
export const MailPreference: typeof import('../../../defaults/app/Models/MailPreference').default = lazyModel('MailPreference')
export const Manufacturer: typeof import('../../../defaults/app/Models/commerce/Manufacturer').default = lazyModel('Manufacturer')
export const Notification: typeof import('../../../defaults/app/Models/Notification').default = lazyModel('Notification')
export const NotificationDelivery: typeof import('../../../defaults/app/Models/NotificationDelivery').default = lazyModel('NotificationDelivery')
export const Order: typeof import('../../../defaults/app/Models/commerce/Order').default = lazyModel('Order')
export const OrderIdempotency: typeof import('../../../defaults/app/Models/commerce/OrderIdempotency').default = lazyModel('OrderIdempotency')
export const PersonalAccessToken: typeof import('../../../defaults/app/Models/PersonalAccessToken').default = lazyModel('PersonalAccessToken')
export const OrderItem: typeof import('../../../defaults/app/Models/commerce/OrderItem').default = lazyModel('OrderItem')
export const Page: typeof import('../../../defaults/app/Models/Content/Page').default = lazyModel('Page')
export const Payment: typeof import('../../../defaults/app/Models/commerce/Payment').default = lazyModel('Payment')
export const PaymentWebhookEvent: typeof import('../../../defaults/app/Models/commerce/PaymentWebhookEvent').default = lazyModel('PaymentWebhookEvent')
export const PaymentMethod: typeof import('../../../defaults/app/Models/PaymentMethod').default = lazyModel('PaymentMethod')
export const PaymentProduct: typeof import('../../../defaults/app/Models/PaymentProduct').default = lazyModel('PaymentProduct')
export const PaymentTransaction: typeof import('../../../defaults/app/Models/PaymentTransaction').default = lazyModel('PaymentTransaction')
export const Post: typeof import('../../../defaults/app/Models/Content/Post').default = lazyModel('Post')
export const Categorizable: typeof import('../../../defaults/app/Models/Content/Categorizable').default = lazyModel('Categorizable')
export const PrintDevice: typeof import('../../../defaults/app/Models/commerce/PrintDevice').default = lazyModel('PrintDevice')
export const Product: typeof import('../../../defaults/app/Models/commerce/Product').default = lazyModel('Product')
export const ProductUnit: typeof import('../../../defaults/app/Models/commerce/ProductUnit').default = lazyModel('ProductUnit')
export const ProductVariant: typeof import('../../../defaults/app/Models/commerce/ProductVariant').default = lazyModel('ProductVariant')
export const QueryLog: typeof import('../../../defaults/app/Models/QueryLog').default = lazyModel('QueryLog')
export const Receipt: typeof import('../../../defaults/app/Models/commerce/Receipt').default = lazyModel('Receipt')
export const Referral: typeof import('../../../defaults/app/Models/Referral').default = lazyModel('Referral')
export const ReferralCode: typeof import('../../../defaults/app/Models/ReferralCode').default = lazyModel('ReferralCode')
export const Release: typeof import('../../../defaults/app/Models/Release').default = lazyModel('Release')
export const Request: typeof import('../../../defaults/app/Models/Request').default = lazyModel('Request')
export const Review: typeof import('../../../defaults/app/Models/commerce/Review').default = lazyModel('Review')
export const ShippingMethod: typeof import('../../../defaults/app/Models/commerce/ShippingMethod').default = lazyModel('ShippingMethod')
export const ShippingRate: typeof import('../../../defaults/app/Models/commerce/ShippingRate').default = lazyModel('ShippingRate')
export const ShippingZone: typeof import('../../../defaults/app/Models/commerce/ShippingZone').default = lazyModel('ShippingZone')
export const SocialPost: typeof import('../../../defaults/app/Models/SocialPost').default = lazyModel('SocialPost')
export const SocialAccount: typeof import('../../../defaults/app/Models/SocialAccount').default = lazyModel('SocialAccount')
export const Subscriber: typeof import('../../../defaults/app/Models/Subscriber').default = lazyModel('Subscriber')
export const SubscriberEmail: typeof import('../../../defaults/app/Models/SubscriberEmail').default = lazyModel('SubscriberEmail')
export const Subscription: typeof import('../../../defaults/app/Models/Subscription').default = lazyModel('Subscription')
export const Tag: typeof import('../../../defaults/app/Models/Tag').default = lazyModel('Tag')
export const TaxRate: typeof import('../../../defaults/app/Models/commerce/TaxRate').default = lazyModel('TaxRate')
export const Team: typeof import('../../../defaults/app/Models/Team').default = lazyModel('Team')
export const TeamInvitation: typeof import('../../../defaults/app/Models/TeamInvitation').default = lazyModel('TeamInvitation')
export const TeamMember: typeof import('../../../defaults/app/Models/TeamMember').default = lazyModel('TeamMember')
export const Transaction: typeof import('../../../defaults/app/Models/commerce/Transaction').default = lazyModel('Transaction')
export const WaitlistProduct: typeof import('../../../defaults/app/Models/commerce/WaitlistProduct').default = lazyModel('WaitlistProduct')
export const WaitlistRestaurant: typeof import('../../../defaults/app/Models/commerce/WaitlistRestaurant').default = lazyModel('WaitlistRestaurant')
export const Websocket: typeof import('../../../defaults/app/Models/realtime/Websocket').default = lazyModel('Websocket')

// Inject every model Proxy onto globalThis so dashboard `<script server>`
// blocks can reference them as bare names (e.g. `await Order.all()`) without
// having to import. The STX engine evaluates server scripts inside an
// AsyncFunction wrapper, which inherits from globalThis — assigning here
// makes the names visible to every page render. The values are Proxies that
// forward to `_loaded[name]` at access time; until the deferred microtask
// populates `_loaded`, every method access returns undefined. By the time
// any stx page render fires (request time), the microtask queue has long
// drained, so `await Order.all()` resolves transparently.
const _allExports: Record<string, any> = {
  User, Job, FailedJob, QueueWorker,
  Activity, AnalyticsEvent, Automation, AutomationRun, Auction, AuctionItem,
  Author, Bid, Board, BoardColumn, Campaign, CampaignSend, CampaignVariant, Card,
  CardComment, Cart, CartItem, Categorizable, Category, Comment, Coupon, Customer,
  CommunicationSuppression, ConsentEvent,
  DeliveryRoute, DeliveryStop, Deployment, DigitalDelivery, Courier, CourierPing,
  EmailList,
  EmailListSubscriber, EmailIdempotency, EmailSuppression, EmailWebhookEvent,
  ErrorModel, Form, FormField, FormSubmission, GdprRequest, GiftCard, Label, LicenseKey,
  Log, LoyaltyPoint, LoyaltyReward, MailPreference, Manufacturer, Notification,
  MagicLinkToken, Menu, MenuItem, NotificationDelivery, Order, OrderIdempotency,
  OrderItem, Page, PageRevision, Payment, PaymentMethod, PaymentProduct,
  PaymentTransaction, PaymentWebhookEvent, Pledge, Post, PrintDevice, Product, ProductUnit,
  ProductVariant, QueryLog, Receipt, Release, Request, Review, ShippingMethod,
  Redirect, SenderDomain, ShippingRate, ShippingZone, Site, SiteDomain,
  SmsOptOut, SocialAccount, SocialPost, Subscriber,
  SubscriberEmail,
  Subscription, Tag, TaxRate, Team, TeamInvitation, TeamMember, Transaction,
  UsageEvent,
  WaitlistProduct, WaitlistRestaurant, Websocket,
}
const g = globalThis as Record<string, any>
for (const [name, M] of Object.entries(_allExports)) {
  if (M && g[name] === undefined) g[name] = M
}

/**
 * The names this module puts on `globalThis`.
 *
 * Exported so the declaration generator can describe exactly this set rather
 * than guessing at it from the models directory. The two used to be worked out
 * separately - `server-auto-imports.d.ts` scanned the framework's model files,
 * this list is the module's own exports - and separate derivations of one fact
 * are how a global comes to be typed but absent, or present but untyped.
 *
 * Names only. Reading the values would instantiate every lazy proxy, which is
 * the opposite of what they are for.
 */
export const modelGlobalNames: readonly string[] = Object.keys(_allExports)

// Tiny safety helpers that pair with the model globals. They live on
// globalThis too so a page can do `const orders = await safeAll(Order)`
// or `const name = safeGet(user, 'name')` without an import. Assigned
// only if absent so a userland module can override them.
async function _safeAll(M: any): Promise<any[]> {
  if (!M) return []
  try {
    if (typeof M.all === 'function') {
      const rows = await M.all()
      return Array.isArray(rows) ? rows : []
    }
    if (typeof M.get === 'function') {
      const rows = await M.get()
      return Array.isArray(rows) ? rows : []
    }
  }
  catch { /* table missing or schema mismatch — render empty */ }
  return []
}
function _safeGet(row: any, key: string, fallback: any = ''): any {
  if (!row) return fallback
  try {
    if (typeof row.get === 'function') {
      const v = row.get(key)
      if (v !== undefined && v !== null) return v
    }
  }
  catch { /* fall through to direct property access */ }
  const direct = row?.[key]
  return direct !== undefined && direct !== null ? direct : fallback
}

if (g.safeAll === undefined) g.safeAll = _safeAll
if (g.safeGet === undefined) g.safeGet = _safeGet

/**
 * A model record seen only through `get(column)`.
 *
 * Normalizers, dashboard aggregators and report builders all take rows from
 * more than one model and read a handful of shared columns by name. Typing
 * that parameter as the model's own record ties the helper to one model;
 * typing it as `{ get: (key: string) => unknown }` is WIDER than what any real
 * record offers, and contravariance then makes every real record unassignable.
 *
 * Four copies of this interface had grown up in the dashboard scaffold - one
 * each for jobs, kanban, analytics and deployments - all with the same
 * hard-won `any`. This is that type, once.
 */
export interface ReadableRecord {
  get: (key: any) => unknown
}

// Re-export type utilities from bun-query-builder so consumers can infer
// model types directly from defineModel() definitions
export type {
  InferAttributes,
  InferPrimaryKey,
  InferRelationNames,
  InferTableName,
  ModelDefinition,
} from '@stacksjs/query-builder'

// `InferFillableAttributes`, `InferNumericColumns`, `InferColumnNames`,
// `ModelRow`, `ModelRowLoose`, `ModelCreateData`, `ModelCreateDataLoose`,
// `NewModelData`, and `UpdateModelData` are exported via
// `export * from './model-types'` above. They're real conditional types
// over `Def<T>` (the model-definition extracted from a `defineModel()`
// return value) — see `model-types.ts` for the implementations.
// Previously this file re-declared them as `any` stubs which shadowed
// the typed versions; stacksjs/stacks#1863 (T-1) restored the real types.

// ---------------------------------------------------------------------------
// Blessed framework-default model row types.
//
// Most consumer code reaches for `ModelRow<typeof User>` /
// `NewModelData<typeof User>` directly — those are the preferred,
// project-aware patterns and they automatically reflect any
// customisation made to `app/Models/User.ts`.
//
// `UserModel` / `NewUser` are exported as "blessed" aliases for the
// framework's default User model so legacy framework code (~220 call
// sites across the cms / commerce / payments / dashboard packages)
// keeps typechecking against a real shape rather than `any`. Project
// code that ships its own User model with extra columns should
// augment via TypeScript module augmentation:
//
// @example
// // anywhere in your project (e.g. app/types.d.ts)
// declare module '@stacksjs/orm' {
//   interface UserModel extends ModelRow<typeof MyUser> {}
//   interface NewUser extends NewModelData<typeof MyUser> {}
// }
//
// Each is declared as an `interface` (not a `type`) so module
// augmentation can extend it from project code.
// ---------------------------------------------------------------------------

/**
 * Framework-default User row shape. Matches the attributes declared on
 * `storage/framework/defaults/app/Models/User.ts` plus the system
 * fields contributed by `useUuid` / `useTimestamps` / `useAuth` traits.
 *
 * For project-specific narrowing, prefer `ModelRow<typeof User>` so
 * any added attributes flow through automatically.
 */
export interface UserModel {
  id: number
  uuid: string
  name: string
  email: string
  password: string
  avatar?: string | null
  email_verified_at?: string | null
  two_factor_secret?: string | null
  public_key?: string | null
  created_at: string
  updated_at: string | null
  stripe_id?: string | null
  two_factor_enabled?: boolean
  // No `hasStripeId()`. It was declared here and bound nowhere, so every
  // payments call written against it threw "is not a function" on a real
  // user. Ask `manageCustomer.hasStripeId(user)` in `@stacksjs/payments`.
  hasRole: (role: string) => boolean | Promise<boolean>
  assignRole: (role: string) => unknown | Promise<unknown>
  update: (data: Record<string, unknown>) => Promise<UserModel>
  [key: string]: unknown
}

/**
 * Framework-default insertable User shape — fillable attributes from
 * the default User model, all optional (DB-side defaults can fill in
 * the rest). For project-specific narrowing, prefer
 * `NewModelData<typeof User>`.
 */
export interface NewUser {
  name?: string
  email?: string
  password?: string
  avatar?: string | null
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Polymorphic trait table types — used by @stacksjs/cms and database drivers.
// These describe trait-managed tables (categorizable, commentable, taggable)
// that don't have standalone model definitions. Once the trait system in
// bun-query-builder supports schema inference, these can be removed.
// ---------------------------------------------------------------------------

/** Row type for the polymorphic categories table (categorizable trait). */
export interface CategorizableTable {
  id?: number
  name: string
  slug: string
  description?: string
  is_active: boolean
  categorizable_type: string
  created_at?: string
  updated_at?: string
}

/** Row type for the category-model pivot table (categorizable trait). */
export interface CategorizableModelsTable {
  id?: number
  category_id: number
  categorizable_type: string
  categorizable_id: number
  created_at?: string
  updated_at?: string
}

/** Row type for the polymorphic comments table (commentable trait). */
export interface CommentablesTable {
  id?: number
  title: string
  body: string
  status: string
  approved_at: number | null
  rejected_at: number | null
  commentables_id: number
  commentables_type: string
  user_id: number | null
  author_name?: string | null
  author_email?: string | null
  created_at?: string
  updated_at?: string | null
}

/** Row type for the polymorphic tags table (taggable trait). */
export interface TaggableTable {
  id?: number
  name: string
  slug: string
  description?: string
  is_active: boolean
  taggable_type: string
  created_at?: string
  updated_at?: string
}

export * from './messaging'
