import type { ComponentOptions as Options } from 'stacks'

/**
 * This is where you define the components that need to be included in
 * your library. For example, including your `HelloWorld` to be built
 * would require `../components/HelloWorld.vue` to be present.
 */
export const tags: Options = [{
  name: ['HelloWorld', 'AppHelloWorld'], // export { default as AppHelloWorld } from '../components/HelloWorld.vue'
  description: 'The Hello World custom element, built via this framework.',
  attributes: [{
    name: 'greeting',
    description: 'The greeting.',
  }],
}, {
  name: 'Demo', // export { default as Demo } from '../components/Demo.vue'
  description: 'A Demo components.',
}]
