export type { Options as ComponentOptions } from 'unplugin-vue-components'

export interface TagOption {
  /**
   * **Tag Name**
   *
   * This is the name of the component to be included in your library build.
   * When defining a tag, ensure that the name corresponds to a file within
   * root component directory.
   *
   * @example
   * {
   *   tags: [{
   *     name: 'HelloWorld' // results in `<HelloWorld />`
   *   }]
   * }
   *
   * @example
   * {
   *   tags: [{
   *     name: ['HelloWorld', 'AppHelloWorld'] // results in `<AppHelloWorld />`
   *   }]
   * }
   * @see https://stacksjs.org/docs/components
   */
  name: string | string[]

  /**
   * **Tag Description**
   *
   * This is the description of your component. This value is
   * used when to provide additional information to IDEs.
   *
   * @example
   * {
   *   name: 'HelloWorld' // results in `<HelloWorld />`
   * }
   * @see https://stacksjs.org/docs/components
   */
  description?: string

  /**
   * **Tag Attributes**
   *
   * These are your component's attributes. While it’s an optional field, you should aim
   * to define all of your component attributes here, to provide as much context
   * to your IDEs as possible, when actually using the library as an end-user.
   *
   * @example
   * {
   *   attributes: {
   *     name: 'greeting',
   *     description: 'The way to greet the user.',
   *   }
   * }
   * @see https://stacksjs.org/docs/components
   */
  attributes?: {
    name: string
    description: string
  }[]
}

export type TagsOptions = TagOption[]
