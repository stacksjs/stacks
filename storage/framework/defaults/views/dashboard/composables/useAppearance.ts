/**
 * useAppearance — the dashboard's shell appearance preferences.
 *
 * Two settings, both per-viewer rather than per-project, and all applied to
 * the SAME place: attributes on `<html>`. Everything downstream — the sidebar
 * skin, the floating content card, the color palette — is CSS keyed on those
 * attributes, which is what makes switching instant and total instead of
 * per-page.
 *
 *   sidebarStyle   'macos' | 'arc'   the whole shell's look
 *   colorMode      'light' | 'dark' | 'system'
 *
 * Plus per-viewer visibility for each navigation section. `config/dashboard.ts`
 * decides which sections a PROJECT has; this decides which of those a PERSON
 * wants to look at. They compose: hiding a section here can only ever remove a
 * row the project already enabled.
 *
 * ## Why attributes on `<html>`, and why localStorage
 *
 * The alternative was to pass the choice down to `<Sidebar theme>` and let the
 * component render it, which is where a sidebar theme belongs. Two things rule
 * that out today. The installed `@stacksjs/components` predates the `arc`
 * theme, so the component would silently fall back to `macos`. And the parts of
 * "Arc" that matter most here — the content pane floating on the sidebar's
 * background, inset and rounded on three sides — are the SHELL's business, not
 * the sidebar's; no theme prop can reach them.
 *
 * So the dashboard owns the appearance and skins the shared component. When the
 * package ships `arc`, `sidebarThemeFor()` starts returning it and the row skin
 * in the layout becomes redundant — the shell rules stay either way.
 *
 * localStorage rather than a cookie because none of this needs to reach the
 * server: the skin is CSS, and a blocking inline script in the document head
 * stamps the attributes before first paint, so there is no flash to avoid.
 *
 * @module
 */
import { state } from '@stacksjs/stx'

export type SidebarStyle = 'macos' | 'arc'
export type ColorMode = 'light' | 'dark' | 'system'

export interface AppearancePreferences {
  sidebarStyle: SidebarStyle
  colorMode: ColorMode
  /** Section ids the viewer has hidden. Absent means visible. */
  hiddenSections: string[]
}

/** localStorage key. Also read by the pre-paint bootstrap in the layout. */
export const APPEARANCE_STORAGE_KEY = 'stacks-dashboard-appearance'

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  sidebarStyle: 'macos',
  colorMode: 'system',
  hiddenSections: [],
}

/**
 * Sidebar WIDTH is deliberately not a preference here.
 *
 * The Sidebar component owns it: the width is a server-rendered prop, and the
 * controller rewrites both the pane width and the shell's width variable every
 * time the collapse state changes. A viewer preference layered on top would be
 * silently reverted by the next collapse toggle, so it would have been a
 * setting that works until you touch something else. If it is wanted, it
 * belongs in the component as a prop the controller respects.
 */

/**
 * The catalogue the settings UI renders.
 *
 * Descriptions are deliberately about what the viewer will SEE rather than
 * about the implementation — "the content floats on the sidebar's color" is
 * checkable by looking at the screen; "uses the arc theme" is not.
 */
export interface SidebarStyleOption {
  /**
   * Named `id`, not `value`.
   *
   * stx special-cases a `.value` field when unwrapping a loop item — reading
   * `option.value` inside a `:for` hands back the ITEM, not the field. The
   * settings page iterates these, so a field called `value` silently persisted
   * the whole option object as the preference.
   */
  id: SidebarStyle
  label: string
  description: string
}

export const SIDEBAR_STYLE_OPTIONS: SidebarStyleOption[] = [
  {
    id: 'macos',
    label: 'macOS',
    description: 'A Finder-style source list. Rows run edge to edge and the '
      + 'selected one takes the system accent. Content sits flush against the sidebar.',
  },
  {
    id: 'arc',
    label: 'Arc',
    description: 'A tinted panel with rounded rows. The selected row lifts into '
      + 'a white card, and the content floats above the panel, inset on every side.',
  },
]

/** Same `id`-not-`value` rule as above — these are iterated too. */
export const COLOR_MODE_OPTIONS: Array<{ id: ColorMode, label: string, icon: string }> = [
  { id: 'light', label: 'Light', icon: 'i-hugeicons-sun-03' },
  { id: 'dark', label: 'Dark', icon: 'i-hugeicons-moon-02' },
  { id: 'system', label: 'System', icon: 'i-hugeicons-computer' },
]

export function isSidebarStyle(value: unknown): value is SidebarStyle {
  return SIDEBAR_STYLE_OPTIONS.some(option => option.id === value)
}

export function isColorMode(value: unknown): value is ColorMode {
  return COLOR_MODE_OPTIONS.some(option => option.id === value)
}

/**
 * Coerce anything read back out of storage into a valid preference set.
 *
 * Defensive on every field: this parses data a previous version of the
 * dashboard wrote, that a user may have edited by hand, and that a half-shipped
 * release may have left in a shape this build has never seen. A bad value has
 * to degrade to the default, never to a broken shell.
 */
export function normalizeAppearance(raw: unknown): AppearancePreferences {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<AppearancePreferences>

  const sidebarStyle = isSidebarStyle(input.sidebarStyle)
    ? input.sidebarStyle
    : DEFAULT_APPEARANCE.sidebarStyle

  const colorMode = isColorMode(input.colorMode)
    ? input.colorMode
    : DEFAULT_APPEARANCE.colorMode

  return {
    sidebarStyle,
    colorMode,
    hiddenSections: Array.isArray(input.hiddenSections)
      ? input.hiddenSections.filter((id): id is string => typeof id === 'string')
      : [],
  }
}

export function readStoredAppearance(): AppearancePreferences {
  if (typeof window === 'undefined')
    return { ...DEFAULT_APPEARANCE }
  try {
    return normalizeAppearance(JSON.parse(window.localStorage?.getItem(APPEARANCE_STORAGE_KEY) || '{}'))
  }
  catch {
    return { ...DEFAULT_APPEARANCE }
  }
}

/**
 * The `<Sidebar theme>` value for a style.
 *
 * Falls back to `macos` when the installed component does not know the theme,
 * so an older `@stacksjs/components` renders sane rows for the layout's Arc
 * skin to restyle instead of an unstyled list. Pass the package's theme
 * registry in; this stays a pure function so it is testable without the import.
 */
export function sidebarThemeFor(style: SidebarStyle, knownThemes: Record<string, unknown>): string {
  return style in knownThemes ? style : 'macos'
}

// One signal per preference, shared by every consumer for the lifetime of the
// module. Seeded from storage at load so the first read is already correct.
const stored = readStoredAppearance()
const sidebarStyleSignal = state<SidebarStyle>(stored.sidebarStyle)
const colorModeSignal = state<ColorMode>(stored.colorMode)
const hiddenSectionsSignal = state<string[]>(stored.hiddenSections)

function persist(): void {
  if (typeof window === 'undefined')
    return
  try {
    window.localStorage?.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(snapshot()))
  }
  catch {
    // Private browsing / quota. The in-memory signals stay authoritative for
    // this session; only persistence across reloads is lost.
  }
}

function snapshot(): AppearancePreferences {
  return {
    sidebarStyle: sidebarStyleSignal(),
    colorMode: colorModeSignal(),
    hiddenSections: hiddenSectionsSignal(),
  }
}

/**
 * Write the preferences onto `<html>`, where the shell CSS reads them.
 *
 * `colorMode` also toggles the `dark` class, because Crosswind's `dark:`
 * variants are class-based and the whole dashboard is written against them.
 * `system` defers to the OS query rather than picking a side.
 */
export function applyAppearance(prefs: AppearancePreferences = snapshot()): void {
  if (typeof document === 'undefined')
    return
  const root = document.documentElement

  root.dataset.appearance = prefs.sidebarStyle
  root.dataset.colorMode = prefs.colorMode

  const dark = prefs.colorMode === 'system'
    ? window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
    : prefs.colorMode === 'dark'
  root.classList.toggle('dark', dark)

  // Claims ownership of the appearance from the Sidebar component, which
  // otherwise mirrors `prefers-color-scheme` straight onto the `dark` class and
  // erases an explicit Light/Dark choice on the next repaint. Its
  // `followSystemAppearance` bails when the root carries `data-theme`, which is
  // exactly the hand-off this is for — and `system` still tracks the OS,
  // through the listener installed below rather than through the component.
  root.dataset.theme = dark ? 'dark' : 'light'
}

/**
 * Keep `system` live.
 *
 * Taking `data-theme` above means the component stops mirroring the OS, so the
 * mirroring has to happen here instead — otherwise `system` would only be
 * resolved once, at load, and changing the OS theme would do nothing until a
 * reload. Installed once per module load; the window guard keeps it SSR-safe.
 */
function installSystemThemeListener(): void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (colorModeSignal() === 'system')
      applyAppearance()
  })
}

export interface AppearanceSnapshot {
  sidebarStyle: () => SidebarStyle
  colorMode: () => ColorMode
  hiddenSections: () => string[]
  isSectionHidden: (id: string) => boolean
  setSidebarStyle: (style: SidebarStyle) => void
  setColorMode: (mode: ColorMode) => void
  toggleSection: (id: string, visible: boolean) => void
  reset: () => void
  /** Re-read storage and re-apply. For the `storage` event across tabs. */
  sync: () => void
}

installSystemThemeListener()

export function useAppearance(): AppearanceSnapshot {
  function commit(): void {
    persist()
    applyAppearance()
  }

  return {
    sidebarStyle: () => sidebarStyleSignal(),
    colorMode: () => colorModeSignal(),
    hiddenSections: () => hiddenSectionsSignal(),
    isSectionHidden: (id: string) => hiddenSectionsSignal().includes(id),

    // Setters validate rather than trust. Storage is already normalized on
    // read, but that only catches a bad value on the NEXT load — by which
    // point it has been applied to the document and written back out.
    setSidebarStyle(style: SidebarStyle) {
      if (!isSidebarStyle(style))
        return
      sidebarStyleSignal.set(style)
      commit()
    },
    setColorMode(mode: ColorMode) {
      if (!isColorMode(mode))
        return
      colorModeSignal.set(mode)
      commit()
    },
    toggleSection(id: string, visible: boolean) {
      const next = hiddenSectionsSignal().filter(entry => entry !== id)
      if (!visible)
        next.push(id)
      hiddenSectionsSignal.set(next)
      commit()
    },
    reset() {
      sidebarStyleSignal.set(DEFAULT_APPEARANCE.sidebarStyle)
      colorModeSignal.set(DEFAULT_APPEARANCE.colorMode)
      hiddenSectionsSignal.set([])
      commit()
    },
    sync() {
      const next = readStoredAppearance()
      sidebarStyleSignal.set(next.sidebarStyle)
      colorModeSignal.set(next.colorMode)
      hiddenSectionsSignal.set(next.hiddenSections)
      applyAppearance(next)
    },
  }
}
