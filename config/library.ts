/**
 * Your component & function library variables.
 *
 * These values may be updated at any time, but if you update
 * the "library name," it will create a new npm package for
 * future releases. Read more in its documentation:
 */

import type { LibraryBuildOptions as BuildOptions, LibraryOptions as Options, StackName } from 'stacks'

export const library: Options = {
  name: 'hello-world',
  parentName: '@stacksjs',
  repository: 'stacksjs/stacks',
  license: 'MIT',
  author: 'Chris Breuer',
  contributors: ['Chris Breuer <chris@ow3.org>'],
  defaultLanguage: 'en',
}

export const stackName: StackName = library.parentName
  ? `${library.parentName}/${library.name}`
  : library.name

export const componentLibrary: BuildOptions = {
  name: `${stackName}-vue`,
  description: 'Your Vue component library description',
  keywords: ['component', 'library', 'vue', 'vite', 'typescript', 'javascript'],
}

export const webComponentLibrary: BuildOptions = {
  name: `${stackName}-elements`,
  description: 'Your framework agnostic web component library description.',
  keywords: ['custom-elements', 'web-components', 'library', 'framework-agnostic', 'typescript', 'javascript'],
}

export const functionLibrary: BuildOptions = {
  name: `${stackName}-fx`,
  description: 'Your function library description.',
  keywords: ['functions', 'composables', 'library', 'typescript', 'javascript'],
  shouldBuildIife: false,
  shouldGenerateSourcemap: false,
}
