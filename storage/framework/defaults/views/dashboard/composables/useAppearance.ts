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
 * that out. `theme` is a server-rendered prop and this preference is per-viewer
 * and client-side, so switching it would need a round trip — the shell would
 * change on the next navigation rather than under the cursor. And the parts of
 * "Arc" that matter most here — the content pane floating on the sidebar's
 * background, inset and rounded on every side — are the SHELL's business, not
 * the sidebar's; no theme prop can reach them.
 *
 * So the dashboard owns the appearance and skins the shared component. When the
 * package ships `arc`, `sidebarThemeFor()` starts returning it and the row skin
 * in the layout becomes redundant — the shell rules stay either way.
 *
 * localStorage rather than a cookie because none of this needs to reach the
 * server: the skin is CSS, and the layout's native `@appearanceBootstrap`
 * directive stamps the attributes before first paint.
 *
 * @module
 */
import { defineStore, state } from '@stacksjs/stx'

export type SidebarStyle = 'macos' | 'arc'
export type ColorMode = 'light' | 'dark' | 'system'

export interface AppearancePreferences {
  sidebarStyle: SidebarStyle
  colorMode: ColorMode
  /** Section ids the viewer has hidden. Absent means visible. */
  hiddenSections: string[]
}

/** localStorage key. Also read by `@appearanceBootstrap` in the layout. */
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

/**
 * The preferences themselves live in a STORE, not in module state.
 *
 * Module-level signals looked right and were quietly broken: the layout and the
 * settings page are bundled separately, and each bundle inlines its own copy of
 * this module. Two copies means two independent sets of signals — the settings
 * page wrote to its own, the layout's effect stayed subscribed to another, and
 * toggling a section updated storage while the sidebar sat there unchanged.
 * Only a full reload made it look like it had worked.
 *
 * `defineStore` dedupes by id on `window.stx._stores`, so every bundle that
 * imports this module gets the same instance — which is exactly the framework's
 * own rule: state two places share is a store, not module state.
 *
 * Persistence is the store's, keyed and shaped to match what the layout's
 * `@appearanceBootstrap` reads: `{ sidebarStyle, colorMode, hiddenSections }`
 * under `APPEARANCE_STORAGE_KEY`.
 */
export const appearanceStore = defineStore('appearance', () => {
  const sidebarStyle = state<SidebarStyle>(DEFAULT_APPEARANCE.sidebarStyle)
  const colorMode = state<ColorMode>(DEFAULT_APPEARANCE.colorMode)
  const hiddenSections = state<string[]>([...DEFAULT_APPEARANCE.hiddenSections])

  function snapshot(): AppearancePreferences {
    return {
      sidebarStyle: sidebarStyle(),
      colorMode: colorMode(),
      hiddenSections: hiddenSections(),
    }
  }

  /**
   * Write the preferences onto `<html>`, where the shell CSS reads them.
   *
   * `colorMode` also toggles the `dark` class, because Crosswind's `dark:`
   * variants are class-based and the whole dashboard is written against them.
   * `system` defers to the OS query rather than picking a side.
   */
  function apply(): void {
    if (typeof document === 'undefined')
      return
    const root = document.documentElement
    const prefs = snapshot()

    root.dataset.appearance = prefs.sidebarStyle
    root.dataset.colorMode = prefs.colorMode

    const dark = prefs.colorMode === 'system'
      ? window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
      : prefs.colorMode === 'dark'
    root.classList.toggle('dark', dark)

    // Claims ownership of the appearance from the Sidebar component, which
    // otherwise mirrors `prefers-color-scheme` onto the `dark` class and erases
    // an explicit Light/Dark choice the moment it mounts. Its
    // `follow-system-appearance` prop is the primary hand-off; this is the
    // belt-and-braces one, and it is what keeps `system` correct while the
    // component stays out of the way.
    root.dataset.theme = dark ? 'dark' : 'light'
  }

  // Setters validate rather than trust. The store's persistence is restored
  // before this runs, but a hand-edited value would otherwise be applied to the
  // document and written straight back out.
  function setSidebarStyle(style: SidebarStyle): void {
    if (!isSidebarStyle(style))
      return
    sidebarStyle.set(style)
    apply()
  }

  function setColorMode(mode: ColorMode): void {
    if (!isColorMode(mode))
      return
    colorMode.set(mode)
    apply()
  }

  function toggleSection(id: string, visible: boolean): void {
    const next = hiddenSections().filter(entry => entry !== id)
    if (!visible)
      next.push(id)
    hiddenSections.set(next)
  }

  function isSectionHidden(id: string): boolean {
    return hiddenSections().includes(id)
  }

  function reset(): void {
    sidebarStyle.set(DEFAULT_APPEARANCE.sidebarStyle)
    colorMode.set(DEFAULT_APPEARANCE.colorMode)
    hiddenSections.set([])
    apply()
  }

  return {
    sidebarStyle,
    colorMode,
    hiddenSections,
    isSectionHidden,
    setSidebarStyle,
    setColorMode,
    toggleSection,
    reset,
    apply,
  }
}, {
  persist: {
    storage: 'localStorage',
    key: APPEARANCE_STORAGE_KEY,
    pick: ['sidebarStyle', 'colorMode', 'hiddenSections'],
  },
})

/*
 * `defineStore` hands back the store itself, not a factory that makes one —
 * which is why `useAppearance()` below returns `appearanceStore` directly and
 * `appearanceStore.apply()` is a valid call. `ReturnType<>` therefore had
 * nothing to unwrap and failed its own constraint.
 */
export type AppearanceSnapshot = typeof appearanceStore

/**
 * Keep `system` live.
 *
 * Taking `data-theme` means the Sidebar stops mirroring the OS, so the
 * mirroring happens here instead — otherwise `system` would be resolved once,
 * at load, and changing the OS theme would do nothing until a reload.
 */
function installSystemThemeListener(): void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const store = appearanceStore
    if (store.colorMode() === 'system')
      store.apply()
  })
}

installSystemThemeListener()

export function useAppearance(): AppearanceSnapshot {
  return appearanceStore
}

/** Apply the current preferences to the document. */
export function applyAppearance(): void {
  appearanceStore.apply()
}
