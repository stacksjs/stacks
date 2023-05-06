import { defineLibrary } from '@stacksjs/config'

/**
 * **Library Configuration**
 *
 * This configuration defines all of your library options. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default defineLibrary({
  name: 'hello-world',
  packageRegistry: 'npm',
  parentName: '@stacksjs', // hmm... maybe orgName?
  repository: 'stacksjs/stacks',
  license: 'MIT',
  author: 'Chris Breuer',
  contributors: ['Chris Breuer <chris@ow3.org>'],
  defaultLanguage: 'en',

  vueComponents: {
    name: 'hello-world-vue',
    description: 'Your Vue component library description',
    keywords: ['component', 'library', 'vue', 'vite', 'typescript', 'javascript'],
    tags: [{
      name: ['HelloWorld', 'AppHelloWorld'],
      description: 'The Hello World custom element, built via this framework.',
      attributes: [{
        name: 'greeting',
        description: 'The greeting.',
      }],
    }],
  },

  webComponents: {
    name: 'hello-world-elements',
    description: 'Your framework agnostic web component library description.',
    keywords: ['custom-elements', 'web-components', 'library', 'framework-agnostic', 'typescript', 'javascript'],
    tags: [{
      name: ['HelloWorld', 'AppHelloWorld'],
      description: 'The Hello World custom element, built via this framework.',
      attributes: [{
        name: 'greeting',
        description: 'The greeting.',
      }],
    }],
  },

  functions: {
    name: 'hello-world-fx',
    description: 'Your function library description.',
    keywords: ['functions', 'composables', 'library', 'typescript', 'javascript'],
    shouldBuildIife: false,
    shouldGenerateSourcemap: false,
    functions: [
      'counter',
      'dark',
    ],
  },
})
