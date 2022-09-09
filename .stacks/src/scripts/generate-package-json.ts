import { resolve } from 'node:path'
import consola from 'consola'
import { hasFiles, writeTextFile } from '../core/fs'
import library from '../../../config/library'

export async function generatePackageJson(type: string) {
  consola.info(`Creating the corresponding package.json file needed to publish the ${type} package...`)

  const author = library.author
  const repository = library.repository
  const contributors = library.contributors

  let name, description, directory, keywords

  if (type === 'components') {
    name = library.componentLibraryName
    description = library.componentLibraryDescription
    directory = 'components'
    keywords = library.componentLibraryKeywords
  }

  else if (type === 'elements') {
    name = library.webComponentLibraryName
    description = library.webComponentLibraryDescription
    directory = 'components'
    keywords = library.componentLibraryKeywords
  }

  else if (type === 'functions') {
    name = library.functionLibraryName
    description = library.functionLibraryDescription
    directory = 'functions'
    keywords = library.functionLibraryKeywords
  }

  const path = resolve(process.cwd(), `./.stacks/${type}/package.json`)

  try {
    // the version does not have to be set here,
    // it will be set automatically by the release script
    await writeTextFile({
      path,
      data: `{
  "name": "${name}",
  "version": "",
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
      "import": "./dist/index.mjs"
    }
  },
  "main": "dist/index.cjs",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "files": [
    "dist"
  ]
}
`,
    })

    consola.success('Created the package.json file.')
  }
  catch (err) {
    consola.error(err)
  }
}

export async function generate() {
  if (hasFiles(resolve(process.cwd(), './components'))) {
    await generatePackageJson('components')
    await generatePackageJson('elements')
  }

  if (hasFiles(resolve(process.cwd(), './functions')))
    await generatePackageJson('functions')
}

generate()
