import consola from 'consola'
import { packageManager } from '../../package.json'
import { author, componentLibrary, contributors, functionLibrary, repository, webComponentLibrary } from '../../../config/library'
import { writeTextFile } from '../utils'
import { packageJsonPath } from '../helpers'

export async function generatePackageJson(type: 'vue-components' | 'web-components' | 'functions') {
  consola.info(`Creating the ${type} package.json needed to publish package...`)

  let name, description, directory, keywords, config

  if (type === 'vue-components') {
    name = componentLibrary.name
    description = componentLibrary.description
    directory = 'components'
    keywords = componentLibrary.keywords
    config = 'vue-components'
  }

  else if (type === 'web-components') {
    name = webComponentLibrary.name
    description = webComponentLibrary.description
    directory = 'components'
    keywords = webComponentLibrary.keywords
    config = 'web-components'
  }

  else if (type === 'functions') {
    name = functionLibrary.name
    description = functionLibrary.description
    directory = 'functions'
    keywords = functionLibrary.keywords
    config = 'functions'
  }

  try {
    // the version does not have to be set here,
    // it will be set automatically by the release script
    await writeTextFile({
      path: packageJsonPath(type),
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
