/**
 * **Dashboard Options**
 *
 * Controls which sections render in the `buddy dev --dashboard` sidebar.
 * Every section defaults to enabled — set a flag to `false` in
 * `config/dashboard.ts` to hide it (for example, projects that don't
 * use commerce features set `commerce.enabled: false`).
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
  }
}

export type DashboardConfig = Partial<DashboardOptions>
