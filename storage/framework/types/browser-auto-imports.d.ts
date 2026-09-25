/* eslint-disable */
/* prettier-ignore */
// noinspection JSUnusedGlobalSymbols
// Emptied by Stacks: nothing injects a bare name into a template. See stacksjs/stacks#2585.
// biome-ignore lint: disable
export {}
declare global {
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
