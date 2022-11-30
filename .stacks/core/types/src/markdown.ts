import type MarkdownIt from 'markdown-it'
import type { ComponentPluginOptions } from '@mdit-vue/plugin-component'
import type { FrontmatterPluginOptions } from '@mdit-vue/plugin-frontmatter'
import type { MarkdownItEnv } from '@mdit-vue/types'
import type { FilterPattern } from '@rollup/pluginutils'

/** a `<meta />` property in HTML is defined with the following name/values */
export interface MetaProperty {
  key?: string
  /**
   * the "name" property used by Facebook and other providers who
   * use the Open Graph standards
   */
  property?: string
  /**
   * used by google to identify the "name" of the name/value pair
   */
  itemprop?: string
  /**
   * used by Twitter to indicate the "name" field in a meta properties
   * name/value pairing
   */
  name?: string
  /**
   * The value of the meta property
   */
  content?: any
  [key: string]: unknown
}

/**
 * Frontmatter content is represented as key/value dictionary
 */
export interface Frontmatter {
  title?: string
  name?: string
  description?: string
  meta?: MetaProperty[]
  [key: string]: unknown
}

export interface Options {
  /**
   * Explicitly set the Vue version
   *
   * @default auto detected
   */
  vueVersion?: string

  /**
   * Enable head support, need to install @vueuse/head and register to App in main.js
   *
   * @default false
   */
  headEnabled?: boolean

  /**
   * The head field in frontmatter used to be used for @vueuse/head
   *
   * When an empty string is passed, it will use the root properties of the frontmatter
   *
   * @default ''
   */
  headField?: string

  /**
   * Parse for frontmatter
   *
   * @default true
   */
  frontmatter?: boolean

  /**
   * Parse for excerpt
   *
   * If `true`, it will be passed to `frontmatterPreprocess` as `frontmatter.excerpt`, replacing the `excerpt` key in frontmatter, if there's any
   *
   * @default false
   */
  excerpt?: boolean

  /**
   * Remove custom SFC block
   *
   * @default ['route', 'i18n']
   */
  customSfcBlocks?: string[]

  /**
   * Options passed to [@mdit-vue/plugin-component](https://github.com/mdit-vue/mdit-vue/tree/main/packages/plugin-component)
   */
  componentOptions?: ComponentPluginOptions

  /**
   * Options passed to [@mdit-vue/plugin-frontmatter](https://github.com/mdit-vue/mdit-vue/tree/main/packages/plugin-frontmatter)
   */
  frontmatterOptions?: FrontmatterPluginOptions

  /**
   * Custom function to provide defaults to the frontmatter and
   * move certain attributes into the "meta" category.
   *
   * Note: _overriding this will remove built-in functionality setting
   * "meta" properties and the built-in "head" support. Do this only
   * if you know what you're doing._
   */
  frontmatterPreprocess?: (
    frontmatter: Frontmatter,
    options: ResolvedOptions
  ) => {
    head: Record<string, any>
    frontmatter: Frontmatter
  }

  /**
   * Expose frontmatter via expose API
   *
   * @default true
   */
  exposeFrontmatter?: boolean

  /**
   * Expose excerpt via expose API
   *
   * @default false
   */
  exposeExcerpt?: boolean

  /**
   * Add `v-pre` to `<code>` tag to escape curly brackets interpolation
   *
   * @see https://github.com/antfu/vite-plugin-vue-markdown/issues/14
   * @default true
   */
  escapeCodeTagInterpolation?: boolean

  /**
   * Options passed to Markdown It
   */
  markdownItOptions?: MarkdownIt.Options

  /**
   * Plugins for Markdown It
   */
  markdownItUses?: (
    | MarkdownIt.PluginSimple
    | [MarkdownIt.PluginSimple | MarkdownIt.PluginWithOptions<any>, any]
    | any
  )[]

  /**
   * A function providing the Markdown It instance gets the ability to apply custom
   * settings/plugins
   */
  markdownItSetup?: (MarkdownIt: MarkdownIt) => void

  /**
   * Class names for wrapper div
   *
   * @default 'markdown-body'
   */
  wrapperClasses?: string | string[]

  /**
   * Component name to wrapper with
   *
   * @default undefined
   */
  wrapperComponent?: string | undefined | null

  /**
   * Custom transformations apply before and after the markdown transformation
   */
  transforms?: {
    before?: (code: string, id: string) => string
    after?: (code: string, id: string) => string
  }

  include?: FilterPattern
  exclude?: FilterPattern
}

export interface ResolvedOptions extends Required<Options> {
  wrapperClasses: string
}

export interface MarkdownEnv extends MarkdownItEnv {
  id: string
}

/**
 * **Markdown Options**
 *
 * The Markdown options.
 *
 * @see https://github.com/mdit-vue/vite-plugin-vue-markdown/blob/main/src/types.ts
 */
export type MarkdownOptions = Options
