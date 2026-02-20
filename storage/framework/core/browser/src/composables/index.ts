export * from './useAuth'
export * from './useApi'

// Re-export browser-relevant composables from @stacksjs/composables
export {
  // Color mode / Theme
  useColorMode,
  useDark,
  usePreferredColorScheme,
  usePreferredContrast,
  usePreferredDark,
  usePreferredReducedMotion,

  // Date / Time
  useDateFormat,
  useNow,
  useTimeAgo,
  useTimestamp,

  // Network / Online
  useFetch,
  useNetwork,
  useOnline,

  // Storage
  useLocalStorage,
  useSessionStorage,
  useStorage,

  // Toggle / State
  useToggle,
  useCounter,
  useStepper,
  useCycleList,

  // DOM / Elements
  useActiveElement,
  useClipboard,
  useClipboardItems,
  useCssVar,
  useDocumentVisibility,
  useElementBounding,
  useElementHover,
  useElementSize,
  useElementVisibility,
  useFocus,
  useFocusWithin,
  useFullscreen,
  useScroll,
  useScrollLock,
  useTitle,
  useWindowFocus,
  useWindowScroll,
  useWindowSize,

  // Events / Interaction
  onClickOutside,
  onKeyDown,
  onKeyStroke,
  onKeyUp,
  onLongPress,
  onStartTyping,
  useEventListener,
  useKeyModifier,
  useMagicKeys,

  // Mouse / Pointer / Swipe
  useDraggable,
  useDropZone,
  useMouse,
  useMouseInElement,
  useMousePressed,
  usePointer,
  usePointerSwipe,
  useSwipe,

  // Sensors
  useBattery,
  useDeviceMotion,
  useDeviceOrientation,
  useDevicePixelRatio,
  useGeolocation,

  // Media
  useBreakpoints,
  useMediaQuery,
  breakpointsTailwind,
  breakpointsBootstrapV5,

  // Page / Navigation
  useBrowserLocation,
  useIdle,
  useInfiniteScroll,
  useNavigatorLanguage,
  usePageLeave,
  usePreferredLanguages,
  useScreenOrientation,
  useTextDirection,
  useTextSelection,
  useUrlSearchParams,

  // Timing
  useDebounceFn,
  useInterval,
  useIntervalFn,
  useRafFn,
  useThrottleFn,
  useTimeout,
  useTimeoutFn,
  useTimeoutPoll,

  // Animations
  useAnimate,
  useTransition,
  TransitionPresets,

  // APIs
  useBase64,
  useBroadcastChannel,
  useConfirmDialog,
  useEventBus,
  useEventSource,
  useEyeDropper,
  useFavicon,
  useFileDialog,
  useImage,
  useObjectUrl,
  usePermission,
  useShare,
  useVibrate,
  useWakeLock,
  useWebNotification,
  useWebSocket,
  useWebWorker,
  useWebWorkerFn,

  // Utilities
  useSupported,
  useMemoize,
  useMounted,
} from '@stacksjs/composables'
