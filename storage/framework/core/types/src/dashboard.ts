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
  }
}

export type DashboardConfig = Partial<DashboardOptions>
