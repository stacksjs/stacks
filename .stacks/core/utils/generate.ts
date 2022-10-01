import consola from 'consola'
import { resolve } from 'pathe'
import fg from 'fast-glob'
import fs from 'fs-extra'
import { packageManager } from '../../package.json'
import { author, components, componentsLibrary, contributors, functions, functionsLibrary, repository, webComponentsLibrary } from '../../../config/library'
import { kebabCase, writeTextFile } from '.'

/**
 * Based on the config values, this method
 * will generate the library entry points.
 * @param type
 */
export async function generateLibEntry(type: 'components' | 'web-components' | 'functions') {
  if (type.includes('components'))
    consola.info('Creating the component library entry points...')
  else
    consola.info('Creating the function library entry point...')

  const path = resolve(process.cwd(), `./.stacks/core/build/entries/${type}.ts`)
  const data = generateEntryPointData(type)

  try {
    await writeTextFile({
      path,
      data,
    })

    if (type === 'components')
      consola.success('Created the component library entry points.')
    else
      consola.success('Created the function library entry point.')
  }
  catch (err) {
    consola.error(err)
  }
}

export async function generatePackageJson(type: string) {
  consola.info(`Creating the ${type} package.json needed to publish package...`)

  let name, description, directory, keywords, config

  if (type === 'components') {
    name = componentsLibrary.name
    description = componentsLibrary.description
    directory = 'components'
    keywords = componentsLibrary.keywords
    config = 'components'
  }

  else if (type === 'web-components') {
    name = webComponentsLibrary.name
    description = webComponentsLibrary.description
    directory = 'components'
    keywords = webComponentsLibrary.keywords
    config = 'components' // TODO: this should be web-components
  }

  else if (type === 'functions') {
    name = functionsLibrary.name
    description = functionsLibrary.description
    directory = 'functions'
    keywords = functionsLibrary.keywords
    config = 'functions'
  }

  const path = resolve(process.cwd(), `./.stacks/${type}/package.json`)

  try {
    // the version does not have to be set here,
    // it will be set automatically by the release script
    await writeTextFile({
      path,
      data: `{
  "name": "${name}",
  "type": "module",
  "version": "",
  "packageManager": "${packageManager}",
  "description": "${description}",
  "author": "${author}",
  "license": "MIT",
  "homepage": "https://github.com/${repository}/tree/main/${directory}#readme",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/${repository}.git",
    "directory": "${directory}"
  },
  "bugs": {
    "url": "https://github.com/${repository}/issues"
  },
  "keywords": ${JSON.stringify(keywords)},
  "contributors": ${JSON.stringify(contributors)},
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "require": "./dist/index.cjs",
      "import": "./dist/index.js"
    }
  },
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "vite build -c ../core/build/${config}.ts",
    "prepublishOnly": "pnpm run build"
  },
  "devDependencies": {
    "@stacksjs/framework": "workspace:*"
  }
}
`,
    })

    consola.success(`Created the ${type} package.json.`)
  }
  catch (err) {
    consola.error(err)
  }
}

function generateEntryPointData(type: 'components' | 'web-components' | 'functions'): string {
  const arr = []

  if (type === 'functions') {
    for (const fx of functions) {
      if (Array.isArray(fx))
        arr.push(`export * as ${fx[1]} from '../../../../functions/${fx[0]}'`)
      else
        arr.push(`export * from '../../../../functions/${fx}'`)
    }

    // join the array into a string with each element being on a new line
    return arr.join('\r\n')
  }

  if (type === 'components') {
    for (const component of components) {
      if (Array.isArray(component))
        arr.push(`export { default as ${component[1]} } from '../../../../components/${component[0]}.vue'`)
      else
        arr.push(`export { default as ${component} } from '../../../../components/${component}.vue'`)
    }

    // join the array into a string with each element being on a new line
    return arr.join('\r\n')
  }

  // else (type === 'web-components') {
  arr.push('import { defineCustomElement } from \'vue\'')

  // first, lets do the imports
  for (const component of components) {
    if (Array.isArray(component))
      arr.push(`import { default as ${component[1]} } from '../../../../components/${component[0]}.vue'`)
    else
      arr.push(`import { default as ${component} } from '../../../../components/${component}.vue'`)
  }

  // next, let's declare the definitions
  for (const component of components) {
    if (Array.isArray(component))
      arr.push(`const ${component[1]}CustomElement = defineCustomElement(${component[1]})`)
    else
      arr.push(`const ${component}CustomElement = defineCustomElement(${component})`)
  }

  // last, let's create the definitions
  for (const component of components) {
    if (Array.isArray(component))
      arr.push(`customElements.define('${kebabCase(component[1])}', ${component[1]}CustomElement)`)
    else
      arr.push(`customElements.define('${kebabCase(component)}', ${component}CustomElement)`)
  }

  // join the array into a string with each element being on a new line
  return arr.join('\r\n')
}

export async function generateVueCompat(paths: string[]) {
  const files = await fg(paths, {
    onlyFiles: true,
  })

  for (const f of files) {
    const raw = await fs.readFile(f, 'utf-8')
    const changed = raw
      .replace(/"@vue\/composition-api"/g, '\'vue-demi\'')
      .replace(/"vue"/g, '\'vue-demi\'')
      .replace(/'vue'/g, '\'vue-demi\'')
    await fs.writeFile(f, changed, 'utf-8')
  }
}
