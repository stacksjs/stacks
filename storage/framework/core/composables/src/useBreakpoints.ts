import type { Ref } from '@stacksjs/stx'
import { computed, ref, onUnmounted } from '@stacksjs/stx'
import { defaultWindow } from './_shared'

/**
 * Breakpoints map type: key names to pixel widths.
 */
export type Breakpoints<K extends string = string> = Record<K, number>

export interface UseBreakpointsReturn<K extends string> {
  /** True when viewport width >= breakpoint value. */
  greaterOrEqual: (k: K) => Ref<boolean>
  /** True when viewport width < breakpoint value. */
  smallerOrEqual: (k: K) => Ref<boolean>
  /** True when viewport width >= a AND < b. */
  between: (a: K, b: K) => Ref<boolean>
  /** True when viewport width > breakpoint value. */
  isGreater: (k: K) => Ref<boolean>
  /** True when viewport width < breakpoint value. */
  isSmaller: (k: K) => Ref<boolean>
  /** Returns a ref of active breakpoint names. */
  current: () => Ref<K[]>
}

/**
 * Reactive responsive breakpoints.
 * Observe viewport width changes and query breakpoint states.
 */
export function useBreakpoints<K extends string>(breakpoints: Breakpoints<K>): UseBreakpointsReturn<K> {
  const win = defaultWindow()

  const width = ref(win ? win.innerWidth : 0)

  function updateWidth(): void {
    if (win) {
      width.value = win.innerWidth
    }
  }

  if (win) {
    win.addEventListener('resize', updateWidth)

    try {
      onUnmounted(() => {
        win.removeEventListener('resize', updateWidth)
      })
    }
    catch {
      // Not in a component context
    }
  }

  function getValue(k: K): number {
    return breakpoints[k]
  }

  function greaterOrEqual(k: K): Ref<boolean> {
    return computed(() => width.value >= getValue(k))
  }

  function smallerOrEqual(k: K): Ref<boolean> {
    return computed(() => width.value <= getValue(k))
  }

  function between(a: K, b: K): Ref<boolean> {
    return computed(() => width.value >= getValue(a) && width.value < getValue(b))
  }

  function isGreater(k: K): Ref<boolean> {
    return computed(() => width.value > getValue(k))
  }

  function isSmaller(k: K): Ref<boolean> {
    return computed(() => width.value < getValue(k))
  }

  function current(): Ref<K[]> {
    return computed(() => {
      const sorted = (Object.keys(breakpoints) as K[]).sort(
        (a, b) => breakpoints[a] - breakpoints[b],
      )
      return sorted.filter(k => width.value >= breakpoints[k])
    })
  }

  return {
    greaterOrEqual,
    smallerOrEqual,
    between,
    isGreater,
    isSmaller,
    current,
  }
}

/**
 * Tailwind CSS default breakpoints.
 */
export const breakpointsTailwind = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const

/**
 * Bootstrap default breakpoints.
 */
export const breakpointsBootstrap = {
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1400,
} as const

/** Alias for breakpointsBootstrap */
export const breakpointsBootstrapV5 = breakpointsBootstrap

/**
 * Ant Design breakpoints.
 */
export const breakpointsAntDesign = {
  xs: 480,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1600,
} as const

/**
 * Vuetify breakpoints.
 */
export const breakpointsVuetify = {
  xs: 600,
  sm: 960,
  md: 1264,
  lg: 1904,
} as const

/**
 * Quasar breakpoints.
 */
export const breakpointsQuasar = {
  xs: 600,
  sm: 1024,
  md: 1440,
  lg: 1920,
} as const

/**
 * Master CSS breakpoints.
 */
export const breakpointsMasterCss = {
  '3xs': 360,
  '2xs': 480,
  'xs': 600,
  'sm': 768,
  'md': 1024,
  'lg': 1280,
  'xl': 1440,
  '2xl': 1600,
  '3xl': 1920,
  '4xl': 2560,
} as const

/**
 * Semantic UI breakpoints.
 */
export const breakpointsSematic = {
  mobileS: 320,
  mobileM: 375,
  mobileL: 425,
  tablet: 768,
  laptop: 1024,
  laptopL: 1440,
  desktop: 2560,
} as const
