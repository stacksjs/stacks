/**
 * STX-UI Composables
 * Reusable Vue composition functions.
 */

export {
  useDarkMode,
  type ColorMode,
  type UseDarkModeOptions,
  type UseDarkModeReturn,
} from './useDarkMode'

export {
  useMediaQuery,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  usePrefersReducedMotion,
  usePrefersDark,
  type UseMediaQueryReturn,
} from './useMediaQuery'

export {
  useModal,
  type UseModalOptions,
  type UseModalReturn,
} from './useModal'

export {
  useClipboard,
  type UseClipboardOptions,
  type UseClipboardReturn,
} from './useClipboard'

export {
  useLocalStorage,
  useLocalStorageString,
  useLocalStorageBoolean,
  useLocalStorageNumber,
  type UseLocalStorageOptions,
  type UseLocalStorageReturn,
} from './useLocalStorage'
