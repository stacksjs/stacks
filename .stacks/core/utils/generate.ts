import consola from 'consola'
import { resolve } from 'pathe'
import fg from 'fast-glob'
import fs from 'fs-extra'
import { packageManager } from '../../package.json'
import { author, componentsLibrary, contributors, functionsLibrary, repository, webComponentsLibrary } from '../../../config/library'
import { writeTextFile } from '.'

/**
 * Based on the config values, this method
 * will generate the library entry points.
 * @param type
 */
export async function generateLibEntry(type: 'components' | 'functions') {
  consola.info(`Creating the ${type} entry point/s...`)

  const path = resolve(process.cwd(), `./.stacks/core/build/entries/${type}.ts`)

  try {
    await writeTextFile({
      path,
      data: `export { default as Counter } from '../components/Buttons/Counter.vue'
export { default as ToggleDark } from '../components/Buttons/ToggleDark.vue'
export { default as Logo } from '../components/Logo.vue'
export { default as HelloWorld } from '../components/HelloWorld.vue'
export { default as Demo } from '../components/Demo.vue'
`,
    })

    consola.success(`Created the ${type} library entrypoint/s.`)
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
