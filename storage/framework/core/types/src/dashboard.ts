/**
 * **Dashboard Options**
 *
 * Controls which sections render in the `buddy dev --dashboard` sidebar.
 * Every section defaults to enabled — set a flag to `false` in
 * `config/dashboard.ts` to hide it (for example, projects that don't
 * use commerce features set `commerce.enabled: false`).
 *
 * The `data` section is always visible (it's where every project's
 * userland models live). It exposes per-row toggles for the basic
 * built-in rows so a project can drop, say, the newsletter Subscribers
 * row when there's no newsletter without losing the model viewer.
 */
export interface DashboardOptions {
  /**
   * Top-level feature gate. When `false`, the entire admin SPA + dashboard
   * routes stay un-registered at boot. Missing or `true` keeps the dashboard
   * on — the framework default, since every Stacks app wants it.
   */
  enabled?: boolean
  /** Optional deploy-target gate, e.g. `['production']`. */
  env?: string[]
  /** Per-section visibility toggles. Omit a section to leave it enabled. */
  sections?: {
    library?: { enabled?: boolean }
    content?: { enabled?: boolean }
    commerce?: { enabled?: boolean }
    marketing?: { enabled?: boolean }
    analytics?: { enabled?: boolean }
    management?: { enabled?: boolean }
    utilities?: { enabled?: boolean }
    /**
     * Data section is always rendered (it hosts userland models). These
     * sub-flags hide individual built-in rows. Userland model rows are
     * always shown — they're the whole point of this section.
     */
    data?: {
      dashboard?: { enabled?: boolean }
      activity?: { enabled?: boolean }
      users?: { enabled?: boolean }
      teams?: { enabled?: boolean }
      subscribers?: { enabled?: boolean }
      allModels?: { enabled?: boolean }
    }
  }
  /**
   * CI tracking surface — GitHub Actions health across the configured orgs.
   * Ports the standalone `repo-dashboard` app into the dashboard
   * (stacksjs/stacks#1844). Defaults to off because most projects don't
   * own multiple GitHub orgs; opt in by listing orgs and surfacing a
   * `GITHUB_TOKEN` in the environment.
   */
  ci?: {
    enabled?: boolean
    /** Orgs whose repos appear as per-tab CI cards. */
    orgs?: string[]
    /** Self-hosted runner caps per org. Defaults to {@link runnerCapDefault}. */
    runnerCaps?: Record<string, number>
    /** Fallback cap for orgs missing from `runnerCaps`. Defaults to 20. */
    runnerCapDefault?: number
    /** Repo names to exclude from the CI feed. */
    ignoreRepos?: string[]
    /**
     * Failing-CI notification fan-out (stacksjs/stacks#1849).
     *
     * When enabled, the dashboard fires a notification through the
     * configured channels every time a repo's CI transitions from
     * success → failure (or first-time-seen → failure). Sticky-red
     * repos don't keep firing; same-run-id polls don't re-fire; a
     * 5-minute cooldown silences flap-storms.
     */
    notifications?: {
      enabled?: boolean
      /**
       * Channels to fan out through. Maps to the same values
       * `notify()` from @stacksjs/notifications accepts. Defaults to
       * `['chat']` — Slack via webhook — because that channel
       * doesn't need a recipient list (it's already scoped to a
       * Slack channel via env).
       */
      channels?: Array<'email' | 'sms' | 'chat' | 'database'>
      /**
       * Per-channel recipients for the channels that need one
       * (email/sms/database). Skipped for `chat`. Each entry must
       * carry the field the named channel requires (`email`,
       * `phone`, `userId`).
       */
      recipients?: Array<{ email?: string, phone?: string, userId?: number }>
      /**
       * Minimum delay (minutes) between consecutive notifications for
       * the same repo. Defaults to 5. Set to 0 to disable.
       */
      cooldownMinutes?: number
    }
    /**
     * Runner-pressure alerts (stacksjs/stacks#1850).
     *
     * When an org's queued-job count stays at or above
     * `queuedThreshold` for `windowMinutes`, the dashboard fires a
     * notification through the configured channels. Hysteresis: an
     * already-alerting org doesn't re-fire until the queue drops
     * below threshold for a full window first.
     */
    alerts?: {
      enabled?: boolean
      /** Queue depth at or above counts as pressure. Defaults to 8. */
      queuedThreshold?: number
      /** Duration the threshold must hold in either direction before
       *  the alert fires / clears. Defaults to 10 minutes. */
      windowMinutes?: number
      /** Same channel options as {@link notifications.channels}. */
      channels?: Array<'email' | 'sms' | 'chat' | 'database'>
      /** Same recipient shape as {@link notifications.recipients}. */
      recipients?: Array<{ email?: string, phone?: string, userId?: number }>
      /**
       * How long the runner-sample time-series is kept on disk.
       * Older samples are pruned during each refresh to bound
       * storage. Defaults to 24h.
       */
      retentionHours?: number
    }
  }
}

export type DashboardConfig = Partial<DashboardOptions>

/**
 * Per-model dashboard configuration (stacksjs/stacks#1843).
 *
 * Attach to a model definition to influence how the model surfaces in the
 * dashboard sidebar without touching the framework's dashboard internals:
 *
 * ```ts
 * defineModel({
 *   name: 'AuditLog',
 *   table: 'audit_logs',
 *   dashboard: {
 *     section: 'management',
 *     icon: 'shield',
 *     roles: ['admin'],
 *     description: 'Append-only audit trail (admin-only)',
 *   },
 *   attributes: { … },
 * })
 * ```
 *
 * Resolution chain (most specific → fallback):
 *
 *   1. `dashboard.enabled === false` → model is hidden from the sidebar
 *      entirely. The dynamic ORM viewer (`/models/<id>`) still works for
 *      direct navigation, but the row is suppressed.
 *   2. `dashboard.section` → pins the model to that section, overriding
 *      the path-based auto-categorisation (commerce/, Content/, etc.).
 *   3. `dashboard.label` / `dashboard.icon` → display overrides; fall back
 *      to the model name and `iconMap` lookup.
 *   4. `dashboard.roles` → role-gates the sidebar row. The server-side
 *      sidebar builder emits the row with role metadata; the client filters
 *      it out for users who lack a matching role. Permissive default
 *      (unauthenticated viewers see everything — see `useRole.ts`).
 */
export interface DashboardModelOptions {
  /**
   * Hide this model from the dashboard sidebar entirely. Direct
   * navigation to `/models/<id>` still works — this only suppresses the
   * sidebar row.
   *
   * Defaults to `true` (model is shown).
   */
  enabled?: boolean

  /**
   * Override the display name in the sidebar. Defaults to the model name.
   */
  label?: string

  /**
   * Override the icon. Defaults to the auto-derived one in `iconMap`.
   * The string is whatever the active sidebar icon set expects
   * (e.g., SF Symbol name for the native sidebar; Lucide-style name for
   * the web sidebar).
   */
  icon?: string

  /**
   * Pin this model to a specific sidebar section instead of the
   * auto-derived category. Useful when a "logs" model lives under
   * `app/Models/` (userland) but should appear under Management rather
   * than Data.
   */
  section?:
    | 'home'
    | 'library'
    | 'content'
    | 'commerce'
    | 'marketing'
    | 'analytics'
    | 'management'
    | 'utilities'
    | 'data'
    | 'app'

  /**
   * Role-gate the sidebar row. The row is rendered server-side with
   * `data-required-roles="…"`; the client filters it out via
   * `useRole()` if the viewer doesn't hold any of the listed roles.
   *
   * The dev-mode default in `useRole()` means unauthenticated viewers
   * (e.g., the local dev dashboard) see role-gated rows as if they
   * were a dev — see `composables/useRole.ts` for the full chain.
   */
  roles?: string[]

  /**
   * Short tooltip / hover description for the sidebar row. Optional —
   * sidebars that don't support tooltips ignore it.
   */
  description?: string
}
