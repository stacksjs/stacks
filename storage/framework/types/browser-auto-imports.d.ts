/* eslint-disable */
/* prettier-ignore */
// noinspection JSUnusedGlobalSymbols
// Pruned by Stacks: every name below is exported by the module beside it.
// biome-ignore lint: disable
export {}
declare global {
  const Fetch: typeof import('../core/browser/src/utils/fetch')['Fetch']
  const Head: typeof import('../core/browser/src/utils/vendors')['Head']
  const and: typeof import('../core/browser/src/utils/math')['and']
  const authGuard: typeof import('../core/browser/src/composables/useAuth')['authGuard']
  const batchInvoke: typeof import('../core/browser/src/utils/function')['batchInvoke']
  const breakpointsMaterialDesign: typeof import('../core/composables/src')['breakpointsMaterialDesign']
  const calculateDelay: typeof import('../core/browser/src/utils/retry')['calculateDelay']
  const clamp: typeof import('../core/browser/src/utils/math')['clamp']
  const confirmCardPayment: typeof import('../core/browser/src/utils/billable')['confirmCardPayment']
  const confirmCardSetup: typeof import('../core/browser/src/utils/billable')['confirmCardSetup']
  const confirmPayment: typeof import('../core/browser/src/utils/billable')['confirmPayment']
  const count: typeof import('../../../resources/functions/counter')['count']
  const createControlledPromise: typeof import('../core/browser/src/utils/promise')['createControlledPromise']
  const createHead: typeof import('../core/browser/src/utils/vendors')['createHead']
  const createPaymentMethod: typeof import('../core/browser/src/utils/billable')['createPaymentMethod']
  const createPromiseLock: typeof import('../core/browser/src/utils/promise')['createPromiseLock']
  const createRegExp: typeof import('../core/browser/src/utils/regex')['createRegExp']
  const createSingletonPromise: typeof import('../core/browser/src/utils/promise')['createSingletonPromise']
  const customAlphabet: typeof import('../core/browser/src/utils/random')['customAlphabet']
  const customRandom: typeof import('../core/browser/src/utils/random')['customRandom']
  const dateFormat: typeof import('../core/datetime/dist/index.js')['dateFormat']
  const debounce: typeof import('../core/browser/src/utils/debounce')['debounce']
  const delay: typeof import('../core/browser/src/utils/sleep')['delay']
  const format: typeof import('../core/datetime/dist/index.js')['format']
  const increment: typeof import('../../../resources/functions/counter')['increment']
  const isDark: typeof import('../../../resources/functions/dark')['isDark']
  const isTruthy: typeof import('../core/browser/src/utils/guards')['isTruthy']
  const lazy: typeof import('../core/browser/src/utils/lazy')['lazy']
  const loadCardElement: typeof import('../core/browser/src/utils/billable')['loadCardElement']
  const loadPaymentElement: typeof import('../core/browser/src/utils/billable')['loadPaymentElement']
  const logicNot: typeof import('../core/browser/src/utils/math')['logicNot']
  const logicOr: typeof import('../core/browser/src/utils/math')['logicOr']
  const loop: typeof import('../core/browser/src/utils/base')['loop']
  const noNull: typeof import('../core/browser/src/utils/guards')['noNull']
  const notNullish: typeof import('../core/browser/src/utils/guards')['notNullish']
  const notUndefined: typeof import('../core/browser/src/utils/guards')['notUndefined']
  const now: typeof import('../core/datetime/dist/index.js')['now']
  const or: typeof import('../core/browser/src/utils/math')['or']
  const parse: typeof import('../core/datetime/dist/index.js')['parse']
  const preferredDark: typeof import('../../../resources/functions/dark')['preferredDark']
  const publishableKey: typeof import('../core/browser/src/utils/billable')['publishableKey']
  const rand: typeof import('../core/browser/src/utils/math')['rand']
  const random: typeof import('../core/browser/src/utils/random')['random']
  const randomNonSecure: typeof import('../core/browser/src/utils/random')['randomNonSecure']
  const readableSize: typeof import('../core/browser/src/utils/vendors')['readableSize']
  const renderHeadToString: typeof import('../core/browser/src/utils/vendors')['renderHeadToString']
  const retry: typeof import('../core/browser/src/utils/retry')['retry']
  const saas: typeof import('../core/browser/src/utils/plans')['saas']
  const sleep: typeof import('../core/browser/src/utils/sleep')['sleep']
  const tap: typeof import('../core/browser/src/utils/function')['tap']
  const throttle: typeof import('../core/browser/src/utils/throttle')['throttle']
  const toString: typeof import('../core/browser/src/utils/base')['toString']
  const toggleDark: typeof import('../../../resources/functions/dark')['toggleDark']
  const useAbs: typeof import('../core/browser/src/utils/math')['useAbs']
  const useAuth: typeof import('../core/browser/src/composables/useAuth')['useAuth']
  const useAverage: typeof import('../core/browser/src/utils/math')['useAverage']
  const useCeil: typeof import('../core/browser/src/utils/math')['useCeil']
  const useClamp: typeof import('../core/browser/src/utils/math')['useClamp']
  const useDark: typeof import('../core/browser/src/utils/vendors')['useDark']
  const useDateFormat: typeof import('../core/browser/src/utils/vendors')['useDateFormat']
  const useFetch: typeof import('../core/browser/src/utils/vendors')['useFetch']
  const useFloor: typeof import('../core/browser/src/utils/math')['useFloor']
  const useForm: typeof import('../core/browser/src/utils/vendors')['useForm']
  const useGitStore: typeof import('../defaults/stores/git')['useGitStore']
  const useMax: typeof import('../core/browser/src/utils/math')['useMax']
  const useMin: typeof import('../core/browser/src/utils/math')['useMin']
  const useNow: typeof import('../core/browser/src/utils/vendors')['useNow']
  const useOnline: typeof import('../core/browser/src/utils/vendors')['useOnline']
  const usePaymentStore: typeof import('../defaults/stores/payment')['usePaymentStore']
  const usePrecision: typeof import('../core/browser/src/utils/math')['usePrecision']
  const usePreferredDark: typeof import('../core/browser/src/utils/vendors')['usePreferredDark']
  const useQueueStore: typeof import('../defaults/stores/queue')['useQueueStore']
  const useRound: typeof import('../core/browser/src/utils/math')['useRound']
  const useScrollLock: typeof import('../core/browser/src/utils/vendors')['useScrollLock']
  const useStorage: typeof import('../core/browser/src/utils/vendors')['useStorage']
  const useSum: typeof import('../core/browser/src/utils/math')['useSum']
  const useTimeoutFn: typeof import('../core/browser/src/utils/vendors')['useTimeoutFn']
  const useToggle: typeof import('../core/browser/src/utils/vendors')['useToggle']
  const useTrunc: typeof import('../core/browser/src/utils/math')['useTrunc']
  const useUserStore: typeof import('../defaults/stores/user')['useUserStore']
  const wait: typeof import('../core/browser/src/utils/sleep')['wait']
  const waitUntil: typeof import('../core/browser/src/utils/sleep')['waitUntil']
  const waitWhile: typeof import('../core/browser/src/utils/sleep')['waitWhile']
}
// for type re-export
declare global {
  // @ts-ignore
  export type { Component, Slot, Slots, ComponentPublicInstance, ComputedRef, DirectiveBinding, ExtractDefaultPropTypes, ExtractPropTypes, ExtractPublicPropTypes, InjectionKey, PropType, Ref, MaybeRef, MaybeRefOrGetter, VNode, WritableComputedRef } from '@stacksjs/stx'
  import('@stacksjs/stx')
  // @ts-ignore
  export type { AuthComposable } from '../defaults/functions/auth'
  import('../defaults/functions/auth')
  // @ts-ignore
  export type { SingletonPromiseReturn, ControlledPromise } from '../core/browser/src/utils/promise'
  import('../core/browser/src/utils/promise')
  // @ts-ignore
  export type { Flag, Input, MagicRegExp, MagicRegExpMatchArray, MapToStringCapturedBy, StringCapturedBy } from '../core/browser/src/utils/regex'
  import('../core/browser/src/utils/regex')
  // @ts-ignore
  export type { RetryOptions } from '../core/browser/src/utils/retry'
  import('../core/browser/src/utils/retry')
  // @ts-ignore
  export type { NonNegativeInteger, WaitOptions } from '../core/browser/src/utils/sleep'
  import('../core/browser/src/utils/sleep')
  // @ts-ignore
  export type { HeadObject, HeadObjectPlain } from '../core/browser/src/utils/vendors'
  import('../core/browser/src/utils/vendors')
}

/*
 * The Vue-shaped `GlobalComponents` / `ComponentCustomProperties` augmentation
 * that used to sit here is gone, along with the `UnwrapRef` import that existed
 * only to type it.
 *
 * `unplugin-auto-import` emits it for Vue, where those interfaces are how a
 * template reaches `this.x`. stx declares neither, so the block was creating
 * two empty interfaces inside stx's module and filling one with 63 properties
 * nothing reads - including the same non-ambient names the global half had
 * wrong. Removing it changes nothing that resolves today.
 */
