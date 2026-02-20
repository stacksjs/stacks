// Shared utilities & types
export { defaultDocument, defaultNavigator, defaultWindow, isRef, noop, toValue, unref } from './_shared'
export type { ConfigurableDocument, ConfigurableWindow, MaybeRef, MaybeRefOrGetter } from './_shared'
export { getSSRHandler, setSSRHandler, customStorageEventName } from './ssrHandlers'

// Storage
export { useStorage } from './useStorage'
export { useLocalStorage } from './useLocalStorage'
export { useSessionStorage } from './useSessionStorage'

// Color mode / Dark mode
export { useDark, usePreferredDark } from './useDark'
export { useColorMode } from './useColorMode'
export { usePreferredColorScheme } from './usePreferredColorScheme'
export { usePreferredContrast } from './usePreferredContrast'
export { usePreferredReducedMotion } from './usePreferredReducedMotion'

// Online / Network
export { useOnline } from './useOnline'
export { useNetwork } from './useNetwork'

// Toggle
export { useToggle } from './useToggle'

// Fetch
export { useFetch } from './useFetch'
export { createFetch } from './createFetch'

// Date / Time
export { useDateFormat } from './useDateFormat'
export { useNow } from './useNow'
export { useTimestamp } from './useTimestamp'
export { useTimeAgo } from './useTimeAgo'

// Event listeners
export { useEventListener } from './useEventListener'
export { useEventBus } from './useEventBus'
export { createEventHook } from './createEventHook'

// Debounce / Throttle
export { useDebounceFn } from './useDebounceFn'
export { useThrottleFn } from './useThrottleFn'
export { useDebouncedRef } from './useDebouncedRef'
export { useThrottledRef } from './useThrottledRef'
export { useDebounce } from './useDebounce'
export { useThrottle } from './useThrottle'

// Timing
export { useInterval } from './useInterval'
export { useIntervalFn } from './useIntervalFn'
export { useTimeout } from './useTimeout'
export { useTimeoutFn } from './useTimeoutFn'
export { useTimeoutPoll } from './useTimeoutPoll'
export { useRafFn } from './useRafFn'
export { useFps } from './useFps'

// Clipboard
export { useClipboard } from './useClipboard'
export { useClipboardItems } from './useClipboardItems'

// Media / Responsive
export { useMediaQuery } from './useMediaQuery'
export {
  breakpointsAntDesign,
  breakpointsBootstrap,
  breakpointsBootstrapV5,
  breakpointsMasterCss,
  breakpointsQuasar,
  breakpointsSematic,
  breakpointsTailwind,
  breakpointsVuetify,
  useBreakpoints,
} from './useBreakpoints'

// Document / Page
export { useTitle } from './useTitle'
export { useFavicon } from './useFavicon'
export { useDocumentVisibility } from './useDocumentVisibility'
export { useTextDirection } from './useTextDirection'
export { useTextSelection } from './useTextSelection'

// URL / Location
export { useUrlSearchParams } from './useUrlSearchParams'
export { useBrowserLocation } from './useBrowserLocation'

// Window
export { useWindowSize } from './useWindowSize'
export { useWindowFocus } from './useWindowFocus'
export { useWindowScroll } from './useWindowScroll'

// Scroll
export { useScroll } from './useScroll'
export { useScrollLock } from './useScrollLock'
export { useInfiniteScroll } from './useInfiniteScroll'

// Fullscreen
export { useFullscreen } from './useFullscreen'

// Click / Keyboard / Interaction
export { onClickOutside } from './onClickOutside'
export { onKeyStroke, onKeyDown, onKeyUp } from './onKeyStroke'
export { onLongPress } from './onLongPress'
export { onStartTyping } from './onStartTyping'
export { useKeyModifier } from './useKeyModifier'
export { useMagicKeys } from './useMagicKeys'

// Math / Logic
export {
  and,
  logicNot,
  logicOr,
  or,
  useAbs,
  useAverage,
  useCeil,
  useClamp,
  useFloor,
  useMax,
  useMin,
  usePrecision,
  useRound,
  useSum,
  useTrunc,
} from './useMath'

// State / Counter / History
export { useCounter } from './useCounter'
export { usePrevious } from './usePrevious'
export { useLastChanged } from './useLastChanged'
export { useStepper } from './useStepper'
export { useCycleList } from './useCycleList'
export { useSorted } from './useSorted'
export { useCloned } from './useCloned'
export { useManualRefHistory } from './useManualRefHistory'
export { useRefHistory } from './useRefHistory'
export { useDebouncedRefHistory } from './useDebouncedRefHistory'
export { useThrottledRefHistory } from './useThrottledRefHistory'

// Async
export { useAsyncState } from './useAsyncState'
export { useAsyncQueue } from './useAsyncQueue'

// Watchers
export { whenever } from './whenever'
export { watchOnce } from './watchOnce'
export { watchDebounced } from './watchDebounced'
export { watchThrottled } from './watchThrottled'
export { watchPausable, pausableWatch } from './watchPausable'
export { watchIgnorable, ignorableWatch } from './watchIgnorable'
export { watchArray } from './watchArray'
export { watchAtMost } from './watchAtMost'
export { watchDeep } from './watchDeep'
export { watchImmediate } from './watchImmediate'
export { watchTriggerable } from './watchTriggerable'
export { watchWithFilter } from './watchWithFilter'

// WebSocket / EventSource
export { useWebSocket } from './useWebSocket'
export { useEventSource } from './useEventSource'
export { useBroadcastChannel } from './useBroadcastChannel'

// Computed
export { computedAsync } from './computedAsync'
export { computedEager } from './computedEager'

// Observers
export { useIntersectionObserver } from './useIntersectionObserver'
export { useResizeObserver } from './useResizeObserver'
export { useMutationObserver } from './useMutationObserver'

// Element
export { useElementSize } from './useElementSize'
export { useElementBounding } from './useElementBounding'
export { useElementVisibility } from './useElementVisibility'
export { useElementHover } from './useElementHover'
export { useElementByPoint } from './useElementByPoint'
export { useCssVar } from './useCssVar'
export { unrefElement } from './unrefElement'

// Mouse / Pointer
export { useMouse } from './useMouse'
export { useMouseInElement } from './useMouseInElement'
export { useMousePressed } from './useMousePressed'
export { usePointer } from './usePointer'
export { useSwipe } from './useSwipe'
export { usePointerSwipe } from './usePointerSwipe'
export { usePointerLock } from './usePointerLock'
export { useParallax } from './useParallax'

// Sensors / Device
export { useGeolocation } from './useGeolocation'
export { useDeviceMotion } from './useDeviceMotion'
export { useDeviceOrientation } from './useDeviceOrientation'
export { useDevicePixelRatio } from './useDevicePixelRatio'
export { useBattery } from './useBattery'

// Focus
export { useFocus } from './useFocus'
export { useFocusWithin } from './useFocusWithin'
export { useActiveElement } from './useActiveElement'

// Idle / Page
export { useIdle } from './useIdle'
export { usePageLeave } from './usePageLeave'
export { useMounted } from './useMounted'

// Drag / Drop
export { useDraggable } from './useDraggable'
export { useDropZone } from './useDropZone'

// Navigation
export { useNavigatorLanguage } from './useNavigatorLanguage'
export { usePreferredLanguages } from './usePreferredLanguages'
export { useScreenOrientation } from './useScreenOrientation'
export { useScreenSafeArea } from './useScreenSafeArea'
export { useParentElement } from './useParentElement'

// Permissions / Share
export { usePermission } from './usePermission'
export { useShare } from './useShare'

// Object / Blob
export { useObjectUrl } from './useObjectUrl'
export { useImage } from './useImage'
export { useBase64 } from './useBase64'

// Animate / Transition
export { useAnimate } from './useAnimate'
export { useTransition, executeTransition, TransitionPresets } from './useTransition'

// Script / Style
export { useScriptTag } from './useScriptTag'
export { useStyleTag } from './useStyleTag'

// Dialogs / Files
export { useConfirmDialog } from './useConfirmDialog'
export { useFileDialog } from './useFileDialog'
export { useEyeDropper } from './useEyeDropper'
export { useTextareaAutosize } from './useTextareaAutosize'

// Notifications / Vibration / Wake
export { useWebNotification } from './useWebNotification'
export { useVibrate } from './useVibrate'
export { useWakeLock } from './useWakeLock'

// Workers
export { useWebWorker, useWebWorkerFn } from './useWebWorker'

// Virtual list / Pagination
export { useVirtualList } from './useVirtualList'
export { useOffsetPagination } from './useOffsetPagination'

// Utility composables
export { isDefined } from './isDefined'
export { useSupported } from './useSupported'
export { useToNumber } from './useToNumber'
export { useToString } from './useToString'
export { refDefault } from './refDefault'
export { refAutoReset, autoResetRef } from './refAutoReset'
export { cloneFnJSON } from './cloneFnJSON'
export { formatTimeAgo } from './formatTimeAgo'
export { until } from './until'
export { resolveRef } from './resolveRef'
export { extendRef } from './extendRef'
export { useMemoize } from './useMemoize'
export { makeDestructurable } from './makeDestructurable'
export { syncRef, syncRefs } from './syncRef'
export { createGlobalState } from './createGlobalState'
export { createSharedComposable } from './createSharedComposable'
export { tryOnMounted, tryOnBeforeMount, tryOnUnmounted, tryOnBeforeUnmount, tryOnScopeDispose } from './tryOnMounted'

// Array utilities
export {
  useArrayDifference,
  useArrayEvery,
  useArrayFilter,
  useArrayFind,
  useArrayFindIndex,
  useArrayIncludes,
  useArrayMap,
  useArrayReduce,
  useArraySome,
  useArrayUnique,
} from './useArrayUtils'

// Aliases (matching VueUse naming)
export { computedAsync as asyncComputed } from './computedAsync'
export { computedEager as eagerComputed } from './computedEager'
export { useDebouncedRef as debouncedRef } from './useDebouncedRef'
export { useDebouncedRef as refDebounced } from './useDebouncedRef'
export { useThrottledRef as throttledRef } from './useThrottledRef'
export { useThrottledRef as refThrottled } from './useThrottledRef'
export { watchDebounced as debouncedWatch } from './watchDebounced'
export { watchThrottled as throttledWatch } from './watchThrottled'
