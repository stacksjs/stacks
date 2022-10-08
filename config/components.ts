/**
 * This is where you define the components that need to be included in
 * your library. For example, including your `HelloWorld` to be built
 * would require `../components/HelloWorld.vue` to be present.
 */

const tags = [
  {
    name: ['HelloWorld', 'HalloWelt'], // export { default as HalloWelt } from '../components/HelloWorld.vue'
    description: 'The Hello World custom element, built via this framework. (You will want to keep adding to this list of attributes. Soon, this file will be automatically generated. See https://github.com/stacksjs/stacks/issues/103)',
    attributes: [
      {
        name: 'greeting',
        description: 'The greeting.',
      },
    ],
  },
  {
    name: 'Demo', // export { default as Demo } from '../components/Demo.vue'
    description: 'A Demo components.',
  },
]

export { tags }
