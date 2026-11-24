export const DASHBOARD_THEME_STORAGE_KEY = 'stacks-dashboard-themes'
export const ORIGINAL_DASHBOARD_THEME = 'original'
export const MAX_THEME_FILE_SIZE = 16_384
const MAX_INSTALLED_THEMES = 24

const paletteKeys = [
  'window', 'canvas', 'surface', 'surfaceMuted', 'text', 'muted', 'border',
  'accent', 'accentFill', 'accentText', 'heroStart', 'heroEnd', 'heroText',
] as const

type ThemePalette = Record<typeof paletteKeys[number], string>

export interface DashboardTheme {
  version: 1
  id: string
  name: string
  description?: string
  layout: 'flush' | 'inset'
  navigation: 'plain' | 'tiles' | 'sections'
  overview: 'panel' | 'immersive'
  radius: number
  light: ThemePalette
  dark: ThemePalette
}

export interface DashboardThemePreferences {
  active: string
  installed: DashboardTheme[]
}

export const SYSTEM_CLEANER_THEME: DashboardTheme = {
  version: 1,
  id: 'system-cleaner',
  name: 'System Cleaner',
  description: 'A violet overview, a flat sidebar, and color-coded section pages.',
  layout: 'inset',
  navigation: 'sections',
  overview: 'immersive',
  radius: 14,
  light: {
    window: '#e7e7ec',
    canvas: '#f5f5f7',
    surface: '#ffffff',
    surfaceMuted: '#eeeef1',
    text: '#1d1d1f',
    muted: '#55555b',
    border: '#d9d9e0',
    accent: '#692bc7',
    accentFill: '#6d28d9',
    accentText: '#ffffff',
    heroStart: '#6a2fb8',
    heroEnd: '#27114e',
    heroText: '#ffffff',
  },
  dark: {
    window: '#111113',
    canvas: '#1a1a1c',
    surface: '#242426',
    surfaceMuted: '#2c2c2e',
    text: '#f5f5f7',
    muted: '#b8b8bf',
    border: '#3b3b42',
    accent: '#c48bff',
    accentFill: '#7a2fe0',
    accentText: '#ffffff',
    heroStart: '#542593',
    heroEnd: '#200d3b',
    heroText: '#ffffff',
  },
}

export const BUNDLED_DASHBOARD_THEMES: readonly DashboardTheme[] = [SYSTEM_CLEANER_THEME]

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function readPalette(value: unknown, mode: string): ThemePalette {
  const input = record(value)
  const palette = {} as ThemePalette
  for (const key of paletteKeys) {
    const color = input[key]
    if (typeof color !== 'string' || color.length !== 7 || !/^#[\da-f]{6}$/i.test(color))
      throw new Error(`Use a six-digit hex color for ${mode}.${key}.`)
    palette[key] = color.toLowerCase()
  }
  return palette
}

export function parseDashboardTheme(value: unknown): DashboardTheme {
  const { version, id, name, description, layout, navigation, overview = 'panel', radius, light, dark } = record(value)
  if (version !== 1)
    throw new Error('Set the theme version to 1.')
  if (typeof id !== 'string' || id !== id.trim() || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id) || id.length > 48)
    throw new Error('Use a theme ID of up to 48 lowercase letters, digits, and hyphens. Start with a letter.')
  if (id === ORIGINAL_DASHBOARD_THEME || BUNDLED_DASHBOARD_THEMES.some(theme => theme.id === id))
    throw new Error('Choose a new ID. That ID belongs to a bundled theme.')
  if (typeof name !== 'string' || !name.trim() || name.length > 64)
    throw new Error('Enter a theme name of up to 64 characters.')
  if (description !== undefined && (typeof description !== 'string' || description.length > 180))
    throw new Error('Keep the description to 180 characters or fewer.')
  if (layout !== 'flush' && layout !== 'inset')
    throw new Error('Choose either flush or inset for layout.')
  if (navigation !== 'plain' && navigation !== 'tiles' && navigation !== 'sections')
    throw new Error('Choose plain, tiles, or sections for navigation.')
  if (overview !== 'panel' && overview !== 'immersive')
    throw new Error('Choose either panel or immersive for overview.')
  if (typeof radius !== 'number' || !Number.isInteger(radius) || radius < 0 || radius > 24)
    throw new Error('Set the radius to a whole number from 0 to 24.')
  return { version, id, name: name.trim(), description: description?.trim(), layout, navigation, overview, radius, light: readPalette(light, 'light'), dark: readPalette(dark, 'dark') }
}

export function resolveDashboardTheme(id: unknown, installed: readonly DashboardTheme[]): DashboardTheme | undefined {
  return BUNDLED_DASHBOARD_THEMES.find(theme => theme.id === id) ?? installed.find(theme => theme.id === id)
}

export function readDashboardThemes(storage: Pick<Storage, 'getItem'>): DashboardThemePreferences {
  const installed = new Map<string, DashboardTheme>()
  try {
    const saved = record(JSON.parse(storage.getItem(DASHBOARD_THEME_STORAGE_KEY) || '{}'))
    if (Array.isArray(saved.installed)) {
      for (const input of saved.installed.slice(0, MAX_INSTALLED_THEMES)) {
        try {
          const theme = parseDashboardTheme(input)
          installed.set(theme.id, theme)
        }
        catch {
          // An outdated or damaged installation should not hide valid themes.
        }
      }
    }
    const themes = [...installed.values()]
    return { active: resolveDashboardTheme(saved.active, themes)?.id ?? ORIGINAL_DASHBOARD_THEME, installed: themes }
  }
  catch {
    return { active: ORIGINAL_DASHBOARD_THEME, installed: [] }
  }
}

export function installDashboardTheme(prefs: DashboardThemePreferences, theme: DashboardTheme): DashboardThemePreferences {
  const index = prefs.installed.findIndex(installed => installed.id === theme.id)
  const installed = [...prefs.installed]
  if (index === -1) {
    if (installed.length >= MAX_INSTALLED_THEMES)
      throw new Error(`Remove an installed theme first. This browser can store ${MAX_INSTALLED_THEMES} themes.`)
    installed.push(theme)
  }
  else {
    installed[index] = theme
  }
  return { active: theme.id, installed }
}

function colorProperty(key: string): string {
  return `--dashboard-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`
}

export function dashboardThemeColor(theme: DashboardTheme, key: keyof ThemePalette): string {
  return `light-dark(${theme.light[key]}, ${theme.dark[key]})`
}

export function applyDashboardTheme(root: HTMLElement, theme?: DashboardTheme): void {
  root.dataset.dashboardTheme = theme?.id ?? ORIGINAL_DASHBOARD_THEME
  if (theme) {
    root.dataset.dashboardLayout = theme.layout
    root.dataset.dashboardNavigation = theme.navigation
    root.dataset.dashboardOverview = theme.overview
    root.style.setProperty('--dashboard-radius', `${theme.radius}px`)
    for (const key of paletteKeys)
      root.style.setProperty(colorProperty(key), dashboardThemeColor(theme, key))
  }
  else {
    delete root.dataset.dashboardLayout
    delete root.dataset.dashboardNavigation
    delete root.dataset.dashboardOverview
    root.style.removeProperty('--dashboard-radius')
    for (const key of paletteKeys)
      root.style.removeProperty(colorProperty(key))
  }
}
