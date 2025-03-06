import type { UserConfig } from '@unocss/core'
import type { UserShortcuts } from 'unocss'

export type Font = 'inter' | 'mona' | 'hubot'
export type Icon = 'heroicons' | 'hugeicons'
export type WebFontsProviders = 'google' | 'bunny' | 'fontshare'
export type Shortcuts = UserShortcuts

export interface FontInfo {
  title: string
  text: string
}

export interface WebFontMeta {
  name: string
  weights?: (string | number)[]
  italic?: boolean
  provider?: WebFontsProviders
}

/**
 * **UI Engine Options**
 *
 * This type defines all of your UI Engine options. Because Stacks is fully-typed, you may
 * hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export interface UiOptions {
  /**
   * **Shortcuts**
   *
   * Shortcuts provide you with the ability to combine
   * utility names for reusability purposes.
   *
   * @example
   * ```
   * config: {
   *   shortcuts: {
   *     'btn': 'px-4 py-2 rounded text-white bg-blue-500',
   *     'btn-lg': 'btn px-6 py-3',
   *   }
   * }
   * ```
   */
  shortcuts: Shortcuts

  /**
   * **Safelist**
   *
   * Use the `safelist` option to ensure the generation of
   * those utility classes. This is useful when certain
   * class names don’t exist in your content files.
   *
   * @example
   * ```ts
   * safelist: [
   *   'btn',
   *   'btn-lg',
   *   'btn-blue',
   *   'btn-blue-500',
   * ]
   */
  safelist: string

  /**
   * **Trigger String**
   *
   * The "trigger string" defines the class name markup
   * you want to add into your components.
   *
   * @default ':stx:'
   *
   * @example
   * ```ts
   * trigger: ':stx:'
   * ```
   */
  trigger?: string

  /**
   * **Class Prefix**
   *
   * The prefix for the compiled class name. When transforming
   * all utility classes into a single class, this prefix
   * will be added to the generated CSS class name.
   *
   * @default 'stx-'
   *
   * @example
   * ```ts
   * prefix: 'stx-'
   * ```
   */
  classPrefix?: string

  /**
   * **Hash Function**
   *
   * The hash function used to generate the class name.
   *
   * @example
   * ```ts
   * hash: (str: string) => {
   *   return str
   *     .split('')
   *     .reduce((a, b) => {
   *       a = ((a << 5) - a) + b.charCodeAt(0)
   *       return a & a
   *     }, 0)
   *     .toString(36)
   * }
   */
  hashFn?: (str: string) => string

  /**
   * **CSS Resets—Preset**
   *
   * Define a standard of reset CSS stylesheets. By default, the Tailwind
   * reset styles are utilized. You may set this value to `null`
   * if you prefer not applying any default stylesheets.
   *
   * @url https://www.npmjs.com/package/@unocss/reset
   * @todo preset needs to be added via a Vite plugin on development & build
   * @example
   * ```ts
   * reset: 'tailwind'
   * ```
   */
  reset?: ResetPreset

  /**
   * **Fonts**
   *
   * Define the fonts you want to use. By default, Stacks provides support
   * for several local font providers. You may set this value to
   * `null` if you prefer not utilize any local fonts.
   *
   * @see https://stacksjs.org/docs/fonts
   * ```
   */
  fonts?: any

  useWebFonts?: boolean | WebFontsProviders

  /**
   * **Icon Sets**
   *
   * This value defines the icon sets you want to use. When using icons, they
   * are displayed utilizing a technique called "icons in pure css."
   * Learn more here https://antfu.me/posts/icons-in-pure-css.
   *
   * @see https://stacksjs.org/config/icons — list of available icon sets
   * @todo implement this into Vite build flow
   * @example
   * ```ts
   * icons: ['heroicons']
   * ```
   * @example
   * ```html
   * <i class="i-hugeicons-outline-book-open w-8 h-8 text-gray-500" aria-hidden="true" />
   * ```
   */
  icons: Icon | Icon[]
  // icons: Record<string, () => Promise<any>>

  theme: UserConfig['theme']
  // plugins: UserConfig['plugins']
  // corePlugins: UserConfig['corePlugins']
  variants: UserConfig['variants']
  layers: UserConfig['layers']
  // darkMode: UserConfig['darkMode']
  // extend: UserConfig['extend']
  // screens: UserConfig['screens']
  // spacing: UserConfig['spacing']
  // backgroundColor: UserConfig['backgroundColor']
  // backgroundImage: UserConfig['backgroundImage']
}

export type UiConfig = Partial<UiOptions>

/**
 * **Style Reset — Preset**
 *
 * This value sets the "reset preset." A preset defines certain
 * CSS defaults to be applied.
 *
 * @default "tailwind"
 */
export type ResetPreset = 'tailwind' | 'normalize' | 'sanitize' | 'eric-meyer' | 'antfu' | null
