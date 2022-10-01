/**
 * Your component & function library variables.
 *
 * These values may be updated at any time, but if you update
 * the "library name," it will create a new npm package for
 * future releases. Read more in its documentation:
 */

import type { Author, Contributors, Hosts, LanguageCode, LibraryName, LibraryOptions, LicenseType, OrganizationName, Repository, StackName } from 'stacks'

const libraryName: LibraryName = 'hello-world'
const organizationName: OrganizationName = '@stacksjs'
const stackName: StackName = organizationName ? `${organizationName}/${libraryName}` : libraryName
const repository: Repository = 'stacksjs/stacks'
const host: Hosts = 'netlify'

const license: LicenseType = 'MIT'
const author: Author = 'Chris Breuer'
const contributors: Contributors = ['Chris Breuer <chris@ow3.org>']
const defaultLanguage: LanguageCode = 'en'

const componentsLibrary: LibraryOptions = {
  name: `${stackName}-vue`,
  description: 'Your Vue component library description',
  keywords: ['component', 'library', 'vue', 'vite', 'typescript', 'javascript'],
}

const webComponentsLibrary: LibraryOptions = {
  name: `${stackName}-elements`,
  description: 'Your framework agnostic web component library description.',
  keywords: ['custom-elements', 'web-components', 'library', 'framework-agnostic', 'typescript', 'javascript'],
}

/**
 * This is where you define the components that need to be included in
 * your library. For example, including your `HelloWorld` to be built
 * would require `../components/HelloWorld.vue` to be present.
 */
const components = [
  ['HelloWorld', 'HalloWelt'], // export { default as HalloWelt } from '../components/HelloWorld.vue'
  'Demo', // // export { default as Demo } from '../components/Demo.vue'
]

const functionsLibrary: LibraryOptions = {
  name: `${stackName}-fx`,
  description: 'Your function library description.',
  keywords: ['functions', 'composables', 'library', 'typescript', 'javascript'],
  shouldBuildIife: false,
  shouldGenerateSourcemap: false,
}

/**
 * This is where you define the functions/composables that need to be included
 * in your library. For example, including your `counter` function to be built
 * would require `../functions/counter.ts` to be present.
 */
const functions = [
  'counter',
  'dark',
]

export { defaultLanguage, license, author, contributors, organizationName, libraryName, host, stackName, repository, components, functions, componentsLibrary, functionsLibrary, webComponentsLibrary }
