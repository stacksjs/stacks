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
}

export type DashboardConfig = Partial<DashboardOptions>
