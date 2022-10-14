import consola from 'consola'
import { packageJsonPath } from '@stacksjs/framework'
import { componentLibrary, functionLibrary, library, webComponentLibrary } from '@stacksjs/config'
import { writeTextFile } from '@stacksjs/utils'
import { packageManager } from '../../../package.json'

export async function generatePackageJson(type: 'vue-components' | 'web-components' | 'functions') {
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
  "author": "${library.author}",
  "license": "MIT",
  "homepage": "https://github.com/${library.repository}/tree/main/${directory}#readme",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/${library.repository}.git",
    "directory": "${directory}"
  },
  "bugs": {
    "url": "https://github.com/${library.repository}/issues"
  },
  "keywords": ${JSON.stringify(keywords)},
  "contributors": ${JSON.stringify(library.contributors)},
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
    "build": "vite build -c ../build/${config}.ts",
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
