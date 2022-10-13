import type { Options } from 'unplugin-vue-components'

export interface TagOption {
  /**
   * Tag Name
   *
   * This is the name of the component to be included in your library build.
   *
   * @example
   * {
   *   tags: [{
   *     name: 'HelloWorld' // results in `export { default as HelloWorld } from './components/HelloWorld.vue'`
   *   }]
   * }
   *
   * @example
   * {
   *   tags: [{
   *     name: ['HelloWorld', 'AppHelloWorld'] // results in `export { default as AppHelloWorld } from './components/HelloWorld.vue'`
   *   }]
   * }
   */
  name: string | string[]

  /**
   * Tag Description
   *
   * This is the description of your component. This value is
   * used when to provide additional information to IDEs.
   *
   * @example
   * {
   *   name: 'HelloWorld' // export { default as HelloWorld } from '../components/HelloWorld.vue'
   * }
   */
  description?: string

  /**
   * Tag Attributes
   *
   * This is the description of your component. This value is
   * used when to provide additional information to IDEs.
   *
   * @example
   * {
   *   name: 'HelloWorld' // export { default as HelloWorld } from '../components/HelloWorld.vue'
   * }
   */
  attributes?: {
    name: string
    description: string
  }[]
}

export type TagsOptions = TagOption[]

export type ComponentOptions = Options
