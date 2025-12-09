/**
 * useDarkMode Composable
 * Reactive dark mode state with system preference detection.
 */
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'

export type ColorMode = 'light' | 'dark' | 'system'

export interface UseDarkModeOptions {
  /**
   * Initial mode. Defaults to 'system'.
   */
  initialMode?: ColorMode
  /**
   * Storage key for persisting preference. Set to false to disable.
   */
  storageKey?: string | false
  /**
   * Attribute to set on document element. Defaults to 'data-theme'.
   */
  attribute?: string
  /**
   * Class to toggle on document element for dark mode.
   */
  darkClass?: string
}

export interface UseDarkModeReturn {
  /**
   * Whether dark mode is currently active.
   */
  isDark: ReturnType<typeof computed<boolean>>
  /**
   * Current color mode setting.
   */
  mode: ReturnType<typeof ref<ColorMode>>
  /**
   * Set mode to light.
   */
  setLight: () => void
  /**
   * Set mode to dark.
   */
  setDark: () => void
  /**
   * Set mode to follow system preference.
   */
  setSystem: () => void
  /**
   * Toggle between light and dark (ignores system).
   */
  toggle: () => void
}

export function useDarkMode(options: UseDarkModeOptions = {}): UseDarkModeReturn {
  const {
    initialMode = 'system',
    storageKey = 'stx-color-mode',
    attribute = 'data-theme',
    darkClass = 'dark',
  } = options

  const mode = ref<ColorMode>(initialMode)
  const systemPrefersDark = ref(false)

  const isDark = computed(() => {
    if (mode.value === 'system') {
      return systemPrefersDark.value
    }
    return mode.value === 'dark'
  })

  let mediaQuery: MediaQueryList | null = null

  function updateSystemPreference() {
    if (typeof window !== 'undefined') {
      systemPrefersDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    }
  }

  function applyMode() {
    if (typeof document === 'undefined') return

    const html = document.documentElement
    const effectiveMode = isDark.value ? 'dark' : 'light'

    // Set attribute
    if (attribute) {
      html.setAttribute(attribute, effectiveMode)
    }

    // Toggle class
    if (darkClass) {
      html.classList.toggle(darkClass, isDark.value)
    }
  }

  function savePreference() {
    if (storageKey && typeof localStorage !== 'undefined') {
      localStorage.setItem(storageKey, mode.value)
    }
  }

  function loadPreference() {
    if (storageKey && typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(storageKey) as ColorMode | null
      if (saved && ['light', 'dark', 'system'].includes(saved)) {
        mode.value = saved
      }
    }
  }

  function setLight() {
    mode.value = 'light'
  }

  function setDark() {
    mode.value = 'dark'
  }

  function setSystem() {
    mode.value = 'system'
  }

  function toggle() {
    mode.value = isDark.value ? 'light' : 'dark'
  }

  // Watch for mode changes
  watch(mode, () => {
    applyMode()
    savePreference()
  })

  // Watch for system preference changes
  watch(systemPrefersDark, () => {
    if (mode.value === 'system') {
      applyMode()
    }
  })

  onMounted(() => {
    // Load saved preference
    loadPreference()

    // Setup system preference detection
    updateSystemPreference()
    if (typeof window !== 'undefined') {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      mediaQuery.addEventListener('change', updateSystemPreference)
    }

    // Apply initial mode
    applyMode()
  })

  onUnmounted(() => {
    if (mediaQuery) {
      mediaQuery.removeEventListener('change', updateSystemPreference)
    }
  })

  return {
    isDark,
    mode,
    setLight,
    setDark,
    setSystem,
    toggle,
  }
}
