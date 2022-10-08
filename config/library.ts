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

const components: LibraryOptions = {
  name: `${stackName}-vue`,
  description: 'Your Vue component library description',
  keywords: ['component', 'library', 'vue', 'vite', 'typescript', 'javascript'],
}

const webComponents: LibraryOptions = {
  name: `${stackName}-elements`,
  description: 'Your framework agnostic web component library description.',
  keywords: ['custom-elements', 'web-components', 'library', 'framework-agnostic', 'typescript', 'javascript'],
}

const functions: LibraryOptions = {
  name: `${stackName}-fx`,
  description: 'Your function library description.',
  keywords: ['functions', 'composables', 'library', 'typescript', 'javascript'],
  shouldBuildIife: false,
  shouldGenerateSourcemap: false,
}

export { defaultLanguage, license, author, contributors, organizationName, libraryName, host, stackName, repository, components as componentLibrary, functions as functionLibrary, webComponents as webComponentLibrary }
