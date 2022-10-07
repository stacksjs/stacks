import consola from 'consola'
import { resolve } from 'pathe'
import { packageManager } from '../../package.json'
import { author, componentsLibrary, contributors, functionsLibrary, repository, webComponentsLibrary } from '../../../config/library'
import { writeTextFile } from '../utils'

export async function generatePackageJson(type: 'vue-components' | 'web-components' | 'functions') {
  consola.info(`Creating the ${type} package.json needed to publish package...`)

  let name, description, directory, keywords, config

  if (type === 'vue-components') {
    name = componentsLibrary.name
    description = componentsLibrary.description
    directory = 'components'
    keywords = componentsLibrary.keywords
    config = 'vue-components'
  }

  else if (type === 'web-components') {
    name = webComponentsLibrary.name
    description = webComponentsLibrary.description
    directory = 'components'
    keywords = webComponentsLibrary.keywords
    config = 'web-components'
  }

  else if (type === 'functions') {
    name = functionsLibrary.name
    description = functionsLibrary.description
    directory = 'functions'
    keywords = functionsLibrary.keywords
    config = 'functions'
  }

  let path = process.cwd()
  if (path.includes('.stacks'))
    path = resolve(path, `./${type}/package.json`)
  else
    path = resolve(path, `./.stacks/${type}/package.json`)

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
